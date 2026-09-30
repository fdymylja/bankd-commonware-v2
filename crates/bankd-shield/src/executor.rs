use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::Arc,
};

use alloy_primitives::{B256, keccak256};
use cnidarium::Storage;
use serde::{Deserialize, Serialize};
use shieldd_sdk_app::{
    SUBSTORE_PREFIXES,
    app::{BlockChanges, HostBlock, HostExecution, HostWithdrawal},
    app_version::check_app_version,
    genesis::AppState,
};
use shieldd_sdk_proto::execution_client::v1::{DepositRequest, HostSource};
use shieldd_sdk_sct::component::clock::EpochRead as _;
use shieldd_sdk_shielded_pool::HostWithdrawalDestination;
use shieldd_sdk_transaction::Transaction;
use tokio::runtime::{Builder, Runtime};

use crate::records::CommitRecords;

/// `block_on` on the executor's runtime, borrowing only the `runtime` field so the future
/// can borrow other fields mutably.
macro_rules! run {
    ($s:ident, $fut:expr) => {
        block_on($s.runtime.as_ref().expect("runtime lives until drop"), $fut)
    };
}

/// Runs `fut` to completion on `runtime`. Callers inside another tokio runtime (the txpool
/// validates inside `Handle::block_on`) can't nest a `block_on`, so hop to a scoped thread.
fn block_on<F>(runtime: &Runtime, fut: F) -> F::Output
where
    F: std::future::Future + Send,
    F::Output: Send,
{
    if tokio::runtime::Handle::try_current().is_err() {
        return runtime.block_on(fut);
    }
    std::thread::scope(|scope| {
        scope
            .spawn(|| runtime.block_on(fut))
            .join()
            .unwrap_or_else(|panic| std::panic::resume_unwind(panic))
    })
}

/// Errors from [`ShieldExecutor`].
#[derive(Debug, thiserror::Error)]
pub enum ShieldError {
    /// Shieldd state has no genesis yet.
    #[error("shieldd state is not initialized")]
    NotInitialized,
    /// The parent root is neither the finalized root nor a sealed candidate.
    #[error("unknown parent shieldd root {parent} for block at height {height}")]
    UnknownParent {
        /// Height of the block being opened.
        height: u64,
        /// Shieldd root the parent block left in reth state.
        parent: B256,
    },
    /// `finalize` named a root that was never sealed.
    #[error("unknown shieldd candidate root {0}")]
    UnknownBlock(B256),
    /// Committing a finalized block gave a different root than staging it.
    /// Means shieldd execution is not deterministic, the node must stop.
    #[error("shieldd root mismatch at height {height}: staged {staged}, committed {committed}")]
    RootMismatch {
        /// Height being committed.
        height: u64,
        /// Root returned by `seal`.
        staged: B256,
        /// Root the disk commit produced.
        committed: B256,
    },
    /// Replaying a finalized block with different inputs than the original run.
    #[error("replay of shieldd height {0} diverged from the recorded run")]
    ReplayDiverged(u64),
    /// A lifecycle call arrived with no open block.
    #[error("no shieldd block is open")]
    NoOpenBlock,
    /// The tx was rejected by shieldd (bad proof, fee, nullifier, ...).
    #[error("shieldd rejected tx: {0}")]
    Rejected(String),
    /// Anything shieldd itself reported.
    #[error("{0:#}")]
    Shieldd(#[from] anyhow::Error),
}

/// Fee a shielded tx pays inside the pool. No EOA is charged.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ShieldFee {
    /// Base units of `asset_id`.
    pub amount: u128,
    /// Shieldd asset id (decaf377 Fq, 32 bytes).
    pub asset_id: [u8; 32],
}

/// Result of delivering one shielded tx.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum TxOutcome {
    /// Applied. Withdrawals are host side effects core must perform (credit BRL).
    Accepted {
        /// Host-chain payouts from shielded withdrawals.
        withdrawals: Vec<HostWithdrawal>,
    },
    /// Included but failed, no shieldd state change.
    Rejected {
        /// Shieldd error text.
        log: String,
    },
}

impl TxOutcome {
    /// `(recipient, amount)` for every plain transfer withdrawal of `denom`. Execution
    /// withdrawals and other denoms are left out (the host has no handler for them yet).
    pub fn transfers(&self, denom: &str) -> Vec<(String, u128)> {
        let TxOutcome::Accepted { withdrawals } = self else {
            return Vec::new();
        };
        withdrawals
            .iter()
            .filter(|w| w.denom == denom)
            .filter_map(|w| match &w.destination {
                HostWithdrawalDestination::Transfer(t) => {
                    Some((t.recipient.clone(), w.amount.value()))
                }
                HostWithdrawalDestination::Execution(_) => None,
            })
            .collect()
    }
}

/// Host-side deposit, what the SHLD precompile hands over after escrowing BRL.
#[derive(Clone, Debug)]
pub struct ShieldDeposit {
    /// Shieldd denom string of the asset, [`crate::system::BRL_DENOM`] for BRL.
    pub denom: String,
    /// Base units.
    pub amount: u128,
    /// Shieldd (bech32m) recipient address.
    pub recipient: String,
    /// Host tx hash, part of the replay-protected deposit identity.
    pub tx_hash: B256,
    /// Tx index within the host block.
    pub tx_index: u32,
    /// Call index within the host tx, lets one tx deposit more than once.
    pub msg_index: u32,
}

impl ShieldDeposit {
    fn digest(&self) -> B256 {
        keccak256(format!(
            "{}|{}|{}|{}|{}|{}",
            self.denom, self.amount, self.recipient, self.tx_hash, self.tx_index, self.msg_index
        ))
    }
}

/// How the open block runs.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BlockMode {
    /// Candidate, executes against shieldd.
    Live(u64),
    /// Height is already finalized: nothing runs and the recorded outputs of the
    /// original run are handed back, so reth re-executes to the same state.
    Replay(u64),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
enum Output {
    // `None` means shieldd refused the deposit and the host refunds it.
    Deposit(Option<B256>),
    Tx(TxOutcome),
}

type Outputs = Vec<(B256, Output)>;

#[derive(Debug)]
struct Pending {
    height: u64,
    parent: B256,
    changes: Arc<BlockChanges>,
    outputs: Outputs,
}

#[derive(Debug)]
struct Open {
    mode: BlockMode,
    parent: B256,
    outputs: Outputs,
    // Recorded outputs of a finalized height, consumed in order on replay.
    replay: Outputs,
}

/// Embedded shieldd state machine for a host that executes candidate blocks
/// before they're final.
///
/// Candidates are keyed by the shieldd root they seal to, and link to their
/// parent by the root the parent left in reth state (the SHLD root slot). So
/// the host never needs the block hash, which the payload builder doesn't have
/// until after execution. Identical shieldd inputs on the same parent give the
/// same root and the same changes, so sharing one entry is safe.
///
/// Lifecycle per candidate: `begin_block -> (deposit | deliver_tx)* -> end_block
/// -> seal`. `seal` returns the app hash but writes nothing. Only `finalize`
/// writes to disk.
///
/// Calls block on an owned tokio runtime, so they must not run on a tokio worker
/// thread (use `spawn_blocking` / `block_in_place`). Same model as the cgo handle.
pub struct ShieldExecutor {
    execution: HostExecution,
    // Same store `execution` owns, kept for checkpoints.
    storage: Storage,
    checkpoints_dir: PathBuf,
    records: CommitRecords,
    outputs_dir: PathBuf,
    last_committed: Option<u64>,
    tip_root: B256,
    pending: HashMap<B256, Pending>,
    open: Option<Open>,
    // Always `Some` until drop. Shut down in the background on drop, since a plain drop
    // panics when the node drops us from inside its async runtime.
    runtime: Option<Runtime>,
}

impl Drop for ShieldExecutor {
    fn drop(&mut self) {
        if let Some(runtime) = self.runtime.take() {
            runtime.shutdown_background();
        }
    }
}

impl std::fmt::Debug for ShieldExecutor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ShieldExecutor")
            .field("last_committed", &self.last_committed)
            .field("tip_root", &self.tip_root)
            .field("pending", &self.pending.len())
            .field("open", &self.open.as_ref().map(|o| o.mode))
            .finish_non_exhaustive()
    }
}

impl ShieldExecutor {
    /// Opens (or creates) shieldd state under `home`: RocksDB in `home/state`,
    /// the commit root log in `home/commit-roots.bin` and per-height outputs in
    /// `home/outputs/`.
    pub fn open(home: impl AsRef<Path>) -> Result<Self, ShieldError> {
        let home = home.as_ref();
        let outputs_dir = home.join("outputs");
        std::fs::create_dir_all(&outputs_dir).map_err(anyhow::Error::from)?;
        let mut records = CommitRecords::open(&home.join("commit-roots.bin"))
            .map_err(|e| anyhow::anyhow!("open commit records: {e}"))?;
        let db = home.join("state");
        let runtime = Builder::new_multi_thread()
            .enable_all()
            .thread_name("shieldd")
            .build()
            .map_err(|e| anyhow::anyhow!("build shieldd runtime: {e}"))?;
        let (storage, last_committed) = block_on(&runtime, async {
            let storage = Storage::load(db.clone(), SUBSTORE_PREFIXES.to_vec())
                .await
                .map_err(|e| anyhow::anyhow!("open shieldd db {}: {e:#}", db.display()))?;
            check_app_version(&storage).await?;
            let last = if storage.latest_version() == u64::MAX {
                None
            } else {
                Some(storage.latest_snapshot().get_block_height().await?)
            };
            Ok::<_, anyhow::Error>((storage, last))
        })?;
        let mut tip_root = B256::ZERO;
        if let Some(h) = last_committed {
            tip_root = latest_root(&runtime, &storage)?;
            // Only the newest record can be missing (crash after shieldd commit).
            if records.len() == h {
                records.append(h, tip_root).map_err(anyhow::Error::from)?;
            }
            if records.len() != h + 1 {
                return Err(anyhow::anyhow!(
                    "commit records hold {} heights but shieldd is at {h}",
                    records.len()
                )
                .into());
            }
        }
        let execution = HostExecution::new(storage.clone());
        Ok(Self {
            execution,
            storage,
            checkpoints_dir: home.join("checkpoints"),
            records,
            outputs_dir,
            last_committed,
            tip_root,
            pending: HashMap::new(),
            open: None,
            runtime: Some(runtime),
        })
    }

    /// Last finalized shieldd height and root, `None` before genesis.
    pub fn committed(&self) -> Option<(u64, B256)> {
        self.last_committed.map(|h| (h, self.tip_root))
    }

    /// Reads only finalized state, never a staged execution candidate.
    pub fn query(&self, method: &str, request: &[u8]) -> Result<Vec<Vec<u8>>, ShieldError> {
        self.committed().ok_or(ShieldError::NotInitialized)?;
        run!(
            self,
            crate::query::query(self.storage.latest_snapshot(), method, request)
        )
        .map_err(ShieldError::from)
    }

    /// Writes a RocksDB checkpoint of finalized state under `home/checkpoints/` and returns
    /// its dir and height. Only finalized blocks are on disk, so a wallet syncing from it
    /// never sees a candidate that could still be dropped.
    pub fn checkpoint(&self) -> Result<(PathBuf, u64), ShieldError> {
        let height = self.last_committed.ok_or(ShieldError::NotInitialized)?;
        std::fs::create_dir_all(&self.checkpoints_dir).map_err(anyhow::Error::from)?;
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(anyhow::Error::from)?
            .as_nanos();
        let dir = self.checkpoints_dir.join(format!("{height:020}-{nanos}"));
        self.storage.checkpoint(&dir)?;
        Ok((dir, height))
    }

    /// Number of sealed, unfinalized candidates held in memory.
    pub fn pending_len(&self) -> usize {
        self.pending.len()
    }

    /// Runs genesis and commits it as height 0 (genesis is final by
    /// definition). Idempotent: an initialized store returns its genesis root.
    pub fn init_genesis(&mut self, genesis: AppState) -> Result<B256, ShieldError> {
        if self.last_committed.is_some() {
            return self.root_at(0);
        }
        let root = run!(self, async {
            self.execution.init_genesis(genesis).await?;
            self.execution.commit().await
        })?;
        let root = to_b256(&root.root_hash)?;
        self.record(0, root, &Vec::new())?;
        Ok(root)
    }

    /// Stateless + stateful validation for the txpool against the latest
    /// finalized state. Returns the in-pool fee.
    pub fn check_tx(&self, tx: &[u8]) -> Result<ShieldFee, ShieldError> {
        if self.last_committed.is_none() {
            return Err(ShieldError::NotInitialized);
        }
        let response = run!(self, self.execution.check_tx(tx))?;
        if response.code != 0 {
            return Err(ShieldError::Rejected(response.log));
        }
        // check_tx already decoded it, so this cannot fail on valid bytes.
        let fee = Transaction::decode_canonical(tx)?
            .transaction_parameters()
            .fee
            .0;
        Ok(ShieldFee {
            amount: fee.amount.value(),
            asset_id: fee.asset_id.to_bytes(),
        })
    }

    /// Opens block `height` on top of `parent_root`, the shieldd root the parent
    /// block wrote into reth state (zero for the first block). Any block left
    /// open is abandoned.
    ///
    /// A finalized height becomes a replay (the v1 crash loop fix). Otherwise
    /// the block runs on the finalized state plus its unfinalized ancestors.
    pub fn begin_block(
        &mut self,
        parent_root: B256,
        height: u64,
        unix_secs: i64,
    ) -> Result<BlockMode, ShieldError> {
        if self.open.take().is_some() {
            self.execution.rollback();
        }
        let committed = self.last_committed.ok_or(ShieldError::NotInitialized)?;
        let (mode, replay) = if height <= committed {
            (BlockMode::Replay(height), self.load_outputs(height)?)
        } else {
            let ancestors = self.ancestors(parent_root, height, committed)?;
            let time = tendermint::Time::from_unix_timestamp(unix_secs, 0)
                .map_err(|e| anyhow::anyhow!("block time {unix_secs}: {e}"))?;
            let block = HostBlock {
                height: i64::try_from(height).map_err(anyhow::Error::from)?,
                time,
            };
            run!(
                self,
                self.execution.begin_block_on_pending(block, &ancestors)
            )?;
            (BlockMode::Live(height), Vec::new())
        };
        self.open = Some(Open {
            mode,
            parent: parent_root,
            outputs: Vec::new(),
            replay,
        });
        Ok(mode)
    }

    /// Mints a shielded note for BRL the SHLD precompile already escrowed.
    /// Returns the deposit id, or `None` when shieldd refused it (bad recipient,
    /// unregistered regulated asset, ...) and the host must refund the escrow.
    pub fn deposit(&mut self, deposit: ShieldDeposit) -> Result<Option<B256>, ShieldError> {
        let digest = deposit.digest();
        let open = self.open.as_ref().ok_or(ShieldError::NoOpenBlock)?;
        let out = match open.mode {
            BlockMode::Replay(h) => self.replayed(digest, h)?,
            BlockMode::Live(height) => {
                let request = DepositRequest {
                    denom: deposit.denom,
                    amount: deposit.amount.to_string(),
                    recipient: deposit.recipient,
                    source: Some(HostSource {
                        height,
                        tx_hash: deposit.tx_hash.to_vec(),
                        msg_index: deposit.msg_index,
                        tx_index: deposit.tx_index,
                    }),
                };
                // A failed deposit leaves shieldd state untouched (its delta is
                // only applied on success), so it's safe to keep going.
                match run!(self, self.execution.deposit(request)) {
                    Ok(result) => Output::Deposit(Some(to_b256(&result.response.deposit_id)?)),
                    Err(error) => {
                        tracing::warn!(%error, "shieldd refused deposit, refunding");
                        Output::Deposit(None)
                    }
                }
            }
        };
        let Output::Deposit(id) = out else {
            return Err(self.diverged());
        };
        self.push_output(digest, out);
        Ok(id)
    }

    /// Applies one shielded tx. A rejected tx is a normal outcome, not an error.
    pub fn deliver_tx(&mut self, tx: &[u8]) -> Result<TxOutcome, ShieldError> {
        let digest = keccak256(tx);
        let open = self.open.as_ref().ok_or(ShieldError::NoOpenBlock)?;
        let out = match open.mode {
            BlockMode::Replay(h) => self.replayed(digest, h)?,
            BlockMode::Live(_) => {
                let response = run!(self, self.execution.deliver_tx(tx))?;
                Output::Tx(if response.code == 0 {
                    TxOutcome::Accepted {
                        withdrawals: response.withdrawals,
                    }
                } else {
                    TxOutcome::Rejected { log: response.log }
                })
            }
        };
        let Output::Tx(outcome) = &out else {
            return Err(self.diverged());
        };
        let outcome = outcome.clone();
        self.push_output(digest, out);
        Ok(outcome)
    }

    /// Closes the open block.
    pub fn end_block(&mut self) -> Result<(), ShieldError> {
        let open = self.open.as_ref().ok_or(ShieldError::NoOpenBlock)?;
        if let BlockMode::Live(h) = open.mode {
            let height = i64::try_from(h).map_err(anyhow::Error::from)?;
            run!(self, self.execution.end_block(height))?;
        }
        Ok(())
    }

    /// Seals the open block and returns its shieldd app hash. Nothing is written
    /// to disk; the block waits in memory for [`ShieldExecutor::finalize`].
    pub fn seal(&mut self) -> Result<B256, ShieldError> {
        let open = self.open.take().ok_or(ShieldError::NoOpenBlock)?;
        match open.mode {
            BlockMode::Replay(h) => {
                if open.outputs.len() != open.replay.len() {
                    return Err(ShieldError::ReplayDiverged(h));
                }
                self.root_at(h)
            }
            BlockMode::Live(height) => {
                let staged = run!(self, self.execution.stage())?;
                let root = to_b256(&staged.root_hash)?;
                self.pending.insert(
                    root,
                    Pending {
                        height,
                        parent: open.parent,
                        changes: staged.changes,
                        outputs: open.outputs,
                    },
                );
                Ok(root)
            }
        }
    }

    /// Persists the finalized block whose shieldd root is `root`, plus any
    /// unfinalized ancestors, oldest first. Then drops every candidate that
    /// doesn't build on it. A height that's already final is a no-op, so the
    /// consensus layer can re-deliver finalized blocks after a restart.
    pub fn finalize(&mut self, root: B256, height: u64) -> Result<B256, ShieldError> {
        let committed = self.last_committed.ok_or(ShieldError::NotInitialized)?;
        if height <= committed {
            return self.root_at(height);
        }
        // An abandoned open block would keep shieldd out of its idle phase.
        if self.open.take().is_some() {
            self.execution.rollback();
        }
        let mut chain = Vec::new();
        let mut cur = root;
        loop {
            let p = self
                .pending
                .get(&cur)
                .ok_or(ShieldError::UnknownBlock(cur))?;
            chain.push(cur);
            if p.height == committed + 1 {
                break;
            }
            cur = p.parent;
        }
        for block in chain.into_iter().rev() {
            let p = self.pending.remove(&block).expect("walked above");
            let commit = run!(self, self.execution.commit_staged(&p.changes))?;
            let committed_root = to_b256(&commit.root_hash)?;
            if committed_root != block {
                return Err(ShieldError::RootMismatch {
                    height: p.height,
                    staged: block,
                    committed: committed_root,
                });
            }
            self.record(p.height, block, &p.outputs)?;
        }
        self.prune();
        Ok(root)
    }

    /// Pending ancestors of a block at `height` on `parent`, oldest first.
    fn ancestors(
        &self,
        parent: B256,
        height: u64,
        committed: u64,
    ) -> Result<Vec<Arc<BlockChanges>>, ShieldError> {
        let unknown = || ShieldError::UnknownParent { height, parent };
        let mut chain = Vec::new();
        let (mut cur, mut h) = (parent, height);
        while h - 1 > committed {
            let p = self.pending.get(&cur).ok_or_else(unknown)?;
            if p.height != h - 1 {
                return Err(unknown());
            }
            chain.push(p.changes.clone());
            cur = p.parent;
            h -= 1;
        }
        // Genesis leaves the root slot at zero, every later block writes it.
        let tip_ok = cur == self.tip_root || (committed == 0 && cur.is_zero());
        if !tip_ok {
            return Err(unknown());
        }
        chain.reverse();
        Ok(chain)
    }

    /// Keeps only candidates that build on the finalized tip.
    fn prune(&mut self) {
        let committed = self.last_committed.unwrap_or_default();
        let mut by_height: Vec<(u64, B256, B256)> = self
            .pending
            .iter()
            .map(|(root, p)| (p.height, *root, p.parent))
            .collect();
        by_height.sort();
        let mut live = HashSet::from([self.tip_root]);
        for (height, root, parent) in by_height {
            if height > committed && live.contains(&parent) {
                live.insert(root);
            }
        }
        self.pending.retain(|root, _| live.contains(root));
    }

    fn replayed(&self, digest: B256, height: u64) -> Result<Output, ShieldError> {
        let open = self.open.as_ref().ok_or(ShieldError::NoOpenBlock)?;
        match open.replay.get(open.outputs.len()) {
            Some((d, out)) if *d == digest => Ok(out.clone()),
            _ => Err(ShieldError::ReplayDiverged(height)),
        }
    }

    fn diverged(&self) -> ShieldError {
        let height = match self.open.as_ref().map(|o| o.mode) {
            Some(BlockMode::Live(h) | BlockMode::Replay(h)) => h,
            None => 0,
        };
        ShieldError::ReplayDiverged(height)
    }

    fn push_output(&mut self, digest: B256, out: Output) {
        if let Some(open) = self.open.as_mut() {
            open.outputs.push((digest, out));
        }
    }

    fn outputs_path(&self, height: u64) -> PathBuf {
        self.outputs_dir.join(format!("{height:020}.json"))
    }

    fn load_outputs(&self, height: u64) -> Result<Outputs, ShieldError> {
        let path = self.outputs_path(height);
        match std::fs::read(&path) {
            Ok(bytes) => Ok(serde_json::from_slice(&bytes).map_err(anyhow::Error::from)?),
            // Genesis and blocks with no shieldd work have nothing to replay.
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
            Err(e) => Err(anyhow::anyhow!("read {}: {e}", path.display()).into()),
        }
    }

    /// Persists outputs, then the root record. Outputs go first so a replay
    /// never sees a committed height without them.
    fn record(&mut self, height: u64, root: B256, outputs: &Outputs) -> Result<(), ShieldError> {
        if !outputs.is_empty() {
            let bytes = serde_json::to_vec(outputs).map_err(anyhow::Error::from)?;
            std::fs::write(self.outputs_path(height), bytes).map_err(anyhow::Error::from)?;
        }
        self.last_committed = Some(height);
        self.tip_root = root;
        self.records
            .append(height, root)
            .map_err(|e| anyhow::anyhow!("append commit record {height}: {e}").into())
    }

    /// Root committed at `height`, from the commit record log.
    fn root_at(&mut self, height: u64) -> Result<B256, ShieldError> {
        self.records
            .get(height)
            .map_err(anyhow::Error::from)?
            .ok_or_else(|| anyhow::anyhow!("no commit record for height {height}").into())
    }
}

fn latest_root(runtime: &Runtime, storage: &Storage) -> Result<B256, ShieldError> {
    let root = block_on(runtime, storage.latest_snapshot().root_hash())?;
    Ok(B256::from(root.0))
}

fn to_b256(bytes: &[u8]) -> Result<B256, ShieldError> {
    B256::try_from(bytes)
        .map_err(|_| anyhow::anyhow!("expected 32 byte hash, got {}", bytes.len()).into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use shieldd_sdk_app::genesis::Content;

    const T0: i64 = 1_700_000_000;

    fn genesis() -> AppState {
        AppState::Content(Content::default().with_chain_id("bankd-v2-test".to_owned()))
    }

    fn deposit(tx_index: u32) -> ShieldDeposit {
        ShieldDeposit {
            denom: crate::system::BRL_DENOM.to_owned(),
            amount: 1_000_000_000_000_000_000,
            recipient: shieldd_sdk_keys::test_keys::ADDRESS_0_STR.to_owned(),
            tx_hash: B256::repeat_byte(0xab),
            tx_index,
            msg_index: 0,
        }
    }

    fn fresh() -> (tempfile::TempDir, ShieldExecutor) {
        let dir = tempfile::tempdir().unwrap();
        let mut exec = ShieldExecutor::open(dir.path()).unwrap();
        exec.init_genesis(genesis()).unwrap();
        (dir, exec)
    }

    /// Runs one candidate with `deposits` host deposits and seals it.
    fn run(exec: &mut ShieldExecutor, parent: B256, height: u64, deposits: u32) -> B256 {
        exec.begin_block(parent, height, T0 + height as i64)
            .unwrap();
        for i in 0..deposits {
            assert!(exec.deposit(deposit(i)).unwrap().is_some());
        }
        exec.end_block().unwrap();
        exec.seal().unwrap()
    }

    #[test]
    fn wallet_queries_only_serve_finalized_compact_blocks() {
        use prost::Message;
        use shieldd_sdk_proto::core::{
            app::v1::AppParametersResponse,
            component::compact_block::v1::{CompactBlockRangeRequest, CompactBlockRangeResponse},
        };
        let (_dir, mut exec) = fresh();
        let params = exec.query("AppParameters", &[]).unwrap();
        let params = AppParametersResponse::decode(params[0].as_slice()).unwrap();
        assert_eq!(params.app_parameters.unwrap().chain_id, "bankd-v2-test");
        let root = run(&mut exec, B256::ZERO, 1, 1);
        let request = CompactBlockRangeRequest {
            start_height: 1,
            end_height: 1,
            keep_alive: false,
        }
        .encode_to_vec();
        assert!(
            exec.query("CompactBlockRange", &request)
                .unwrap()
                .is_empty()
        );
        exec.finalize(root, 1).unwrap();
        let blocks = exec.query("CompactBlockRange", &request).unwrap();
        assert_eq!(blocks.len(), 1);
        assert_eq!(
            CompactBlockRangeResponse::decode(blocks[0].as_slice())
                .unwrap()
                .compact_block
                .unwrap()
                .height,
            1
        );
    }

    #[test]
    fn wallet_queries_are_bounded_and_read_only() {
        use prost::Message;
        use shieldd_sdk_proto::core::component::compact_block::v1::CompactBlockRangeRequest;
        let (_dir, exec) = fresh();
        assert!(exec.query("DeliverTx", &[]).is_err());
        assert!(exec.query("AppParameters", &vec![0; 1_048_577]).is_err());
        let request = CompactBlockRangeRequest {
            start_height: 0,
            end_height: 0,
            keep_alive: true,
        }
        .encode_to_vec();
        assert!(exec.query("CompactBlockRange", &request).is_err());
    }

    #[test]
    fn wallet_key_queries_include_committed_proofs() {
        use prost::Message;
        use shieldd_sdk_proto::cnidarium::v1::{KeyValueRequest, KeyValueResponse};
        let (_dir, exec) = fresh();
        let request = KeyValueRequest {
            key: "application/data/chain_id".into(),
            proof: true,
        }
        .encode_to_vec();
        let response = exec.query("KeyValue", &request).unwrap();
        let response = KeyValueResponse::decode(response[0].as_slice()).unwrap();
        assert_eq!(response.value.unwrap().value, b"bankd-v2-test");
        assert!(response.proof.is_some());
    }

    #[test]
    fn competing_candidates_only_finalized_persists() {
        let (dir, mut exec) = fresh();
        let genesis = exec.committed().unwrap();
        let root_a = run(&mut exec, B256::ZERO, 1, 0);
        let root_b = run(&mut exec, B256::ZERO, 1, 1);
        assert_ne!(root_a, root_b);
        assert_eq!(exec.committed(), Some(genesis), "sealing writes nothing");

        assert_eq!(exec.finalize(root_b, 1).unwrap(), root_b);
        assert_eq!(exec.committed(), Some((1, root_b)));
        assert_eq!(exec.pending_len(), 0, "losing sibling is discarded");
        assert!(matches!(
            exec.finalize(root_a, 2),
            Err(ShieldError::UnknownBlock(_))
        ));

        // Restart after finalize: same state, next block builds on it.
        drop(exec);
        let mut exec = ShieldExecutor::open(dir.path()).unwrap();
        assert_eq!(exec.committed(), Some((1, root_b)));
        let root_c = run(&mut exec, root_b, 2, 0);
        exec.finalize(root_c, 2).unwrap();
        assert_eq!(exec.committed(), Some((2, root_c)));
    }

    #[test]
    fn child_of_unfinalized_parent_matches_sequential_commit() {
        let (_d1, mut exec) = fresh();
        let root_p = run(&mut exec, B256::ZERO, 1, 1);
        let root_c = run(&mut exec, root_p, 2, 2);
        // A dead fork next to p must not survive finalization.
        run(&mut exec, B256::ZERO, 1, 0);
        assert_eq!(exec.finalize(root_c, 2).unwrap(), root_c);
        assert_eq!(exec.pending_len(), 0);
        assert_eq!(exec.root_at(1).unwrap(), root_p);

        // A second node that finalizes every block right away agrees.
        let (_d2, mut other) = fresh();
        assert_eq!(run(&mut other, B256::ZERO, 1, 1), root_p);
        other.finalize(root_p, 1).unwrap();
        assert_eq!(run(&mut other, root_p, 2, 2), root_c);
        other.finalize(root_c, 2).unwrap();
        assert_eq!(other.committed(), exec.committed());
    }

    #[test]
    fn re_executing_a_candidate_gives_the_same_root() {
        let (_dir, mut exec) = fresh();
        let first = run(&mut exec, B256::ZERO, 1, 1);
        assert_eq!(run(&mut exec, B256::ZERO, 1, 1), first);
        assert_eq!(exec.pending_len(), 1);
    }

    #[test]
    fn replay_guard_returns_recorded_outputs() {
        let (dir, mut exec) = fresh();
        let root = run(&mut exec, B256::ZERO, 1, 1);
        exec.finalize(root, 1).unwrap();

        // Restarted node replays block 1: same outputs, same root, nothing written.
        drop(exec);
        let mut exec = ShieldExecutor::open(dir.path()).unwrap();
        assert_eq!(
            exec.begin_block(B256::ZERO, 1, T0).unwrap(),
            BlockMode::Replay(1)
        );
        assert!(exec.deposit(deposit(0)).unwrap().is_some());
        assert!(matches!(
            exec.deposit(deposit(5)),
            Err(ShieldError::ReplayDiverged(1))
        ));
        exec.begin_block(B256::ZERO, 1, T0).unwrap();
        exec.deposit(deposit(0)).unwrap();
        exec.end_block().unwrap();
        assert_eq!(exec.seal().unwrap(), root);
        assert_eq!(exec.finalize(root, 1).unwrap(), root);
        assert_eq!(exec.committed(), Some((1, root)));
    }

    #[test]
    fn refused_deposit_is_recorded_for_refund() {
        let (_dir, mut exec) = fresh();
        exec.begin_block(B256::ZERO, 1, T0 + 1).unwrap();
        let mut bad = deposit(0);
        bad.recipient = "not-an-address".to_owned();
        assert_eq!(exec.deposit(bad).unwrap(), None);
        exec.end_block().unwrap();
        let root = exec.seal().unwrap();
        // Same root as an empty block, the refused deposit changed nothing.
        assert_eq!(run(&mut exec, B256::ZERO, 1, 0), root);
    }

    #[test]
    fn recovers_record_lost_after_shieldd_commit() {
        let (dir, mut exec) = fresh();
        let root = run(&mut exec, B256::ZERO, 1, 1);
        exec.finalize(root, 1).unwrap();
        drop(exec);
        // Simulate a crash between shieldd commit and the record append.
        let log = dir.path().join("commit-roots.bin");
        let len = std::fs::metadata(&log).unwrap().len();
        std::fs::OpenOptions::new()
            .write(true)
            .open(&log)
            .unwrap()
            .set_len(len - 40)
            .unwrap();
        let mut exec = ShieldExecutor::open(dir.path()).unwrap();
        exec.begin_block(B256::ZERO, 1, T0).unwrap();
        exec.deposit(deposit(0)).unwrap();
        exec.end_block().unwrap();
        assert_eq!(exec.seal().unwrap(), root);
    }

    #[test]
    fn calls_work_inside_another_tokio_runtime() {
        let (_dir, mut exec) = fresh();
        let outer = tokio::runtime::Builder::new_current_thread()
            .build()
            .unwrap();
        let root = outer.block_on(async { run(&mut exec, B256::ZERO, 1, 1) });
        assert_eq!(exec.finalize(root, 1).unwrap(), root);
    }

    #[test]
    fn rejects_unknown_parent_and_bad_tx() {
        let dir = tempfile::tempdir().unwrap();
        let mut exec = ShieldExecutor::open(dir.path()).unwrap();
        assert!(matches!(
            exec.check_tx(b"x"),
            Err(ShieldError::NotInitialized)
        ));
        exec.init_genesis(genesis()).unwrap();
        assert!(matches!(
            exec.begin_block(B256::repeat_byte(0x54), 5, T0),
            Err(ShieldError::UnknownParent { height: 5, .. })
        ));
        assert!(matches!(
            exec.begin_block(B256::repeat_byte(0x54), 1, T0),
            Err(ShieldError::UnknownParent { height: 1, .. })
        ));
        assert!(matches!(
            exec.check_tx(b"not a shielded tx"),
            Err(ShieldError::Rejected(_))
        ));
        exec.begin_block(B256::ZERO, 1, T0).unwrap();
        assert!(matches!(
            exec.deliver_tx(b"not a shielded tx").unwrap(),
            TxOutcome::Rejected { .. }
        ));
        exec.end_block().unwrap();
        exec.seal().unwrap();
    }
}
