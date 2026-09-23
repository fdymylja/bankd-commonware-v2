use std::{collections::HashMap, path::Path, sync::Arc};

use alloy_primitives::{B256, keccak256};
use cnidarium::Storage;
use shieldd_sdk_app::{
    SUBSTORE_PREFIXES,
    app::{BlockChanges, HostBlock, HostExecution, HostWithdrawal},
    app_version::check_app_version,
    genesis::AppState,
};
use shieldd_sdk_proto::execution_client::v1::{DepositRequest, HostSource};
use shieldd_sdk_sct::component::clock::EpochRead as _;
use shieldd_sdk_transaction::Transaction;
use tokio::runtime::{Builder, Runtime};

use crate::records::CommitRecords;

/// Errors from [`ShieldExecutor`].
#[derive(Debug, thiserror::Error)]
pub enum ShieldError {
    /// Shieldd state has no genesis yet.
    #[error("shieldd state is not initialized")]
    NotInitialized,
    /// The parent of a candidate is neither finalized nor a known candidate.
    #[error("unknown parent {parent} for shieldd block at height {height}")]
    UnknownParent {
        /// Height of the block being opened.
        height: u64,
        /// Its parent hash.
        parent: B256,
    },
    /// `finalize` named a block that was never sealed.
    #[error("unknown shieldd candidate {0}")]
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
    /// A re-executed candidate got different inputs than the first run.
    #[error("re-execution of shieldd block {0} diverged from its first run")]
    CachedDiverged(B256),
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
#[derive(Clone, Debug)]
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
    /// Block is already finalized (replay), nothing ran.
    Replayed,
}

/// Host-side deposit, what the SHLD precompile hands over after debiting BRL.
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

/// Identity of a host (reth) block.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BlockId {
    /// Block hash.
    pub hash: B256,
    /// Parent block hash.
    pub parent: B256,
    /// Block number.
    pub height: u64,
}

/// How the open block runs.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BlockMode {
    /// Fresh candidate, executes against shieldd.
    Live(u64),
    /// Same block hash was already sealed, recorded results are handed back.
    Cached(u64),
    /// Height is already finalized, everything is a no-op.
    Replay(u64),
}

#[derive(Clone, Debug)]
enum Output {
    Deposit(Option<B256>),
    Tx(TxOutcome),
}

#[derive(Debug)]
struct Pending {
    height: u64,
    parent: B256,
    changes: Arc<BlockChanges>,
    root: B256,
    // (input digest, output) per call, so re-executing the same block (payload
    // build then validation) returns identical results without running shieldd.
    outputs: Vec<(B256, Output)>,
}

#[derive(Debug)]
struct Open {
    id: BlockId,
    mode: BlockMode,
    outputs: Vec<(B256, Output)>,
}

/// Embedded shieldd state machine for a host that executes candidate blocks
/// before they're final.
///
/// Lifecycle per candidate: `begin_block -> (deposit | deliver_tx)* -> end_block
/// -> seal`. `seal` returns the app hash but writes nothing. Only `finalize`
/// writes to disk, so competing candidates at one height are free to run.
///
/// Calls block on an owned tokio runtime, so they must not run on a tokio worker
/// thread (use `spawn_blocking` / `block_in_place`). Same model as the cgo handle.
pub struct ShieldExecutor {
    // Field order matters: execution and storage drop before the runtime.
    execution: HostExecution,
    storage: Storage,
    records: CommitRecords,
    last_committed: Option<u64>,
    // Hash of the last finalized block, unknown right after a restart.
    tip_hash: Option<B256>,
    pending: HashMap<B256, Pending>,
    open: Option<Open>,
    runtime: Runtime,
}

impl std::fmt::Debug for ShieldExecutor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ShieldExecutor")
            .field("last_committed", &self.last_committed)
            .field("tip_hash", &self.tip_hash)
            .field("pending", &self.pending.len())
            .field("open", &self.open.as_ref().map(|o| o.mode))
            .finish_non_exhaustive()
    }
}

impl ShieldExecutor {
    /// Opens (or creates) shieldd state under `home`: RocksDB in `home/state`,
    /// the commit root log in `home/commit-roots.bin`.
    pub fn open(home: impl AsRef<Path>) -> Result<Self, ShieldError> {
        let home = home.as_ref();
        std::fs::create_dir_all(home).map_err(anyhow::Error::from)?;
        let mut records = CommitRecords::open(&home.join("commit-roots.bin"))
            .map_err(|e| anyhow::anyhow!("open commit records: {e}"))?;
        let db = home.join("state");
        let runtime = Builder::new_multi_thread()
            .enable_all()
            .thread_name("shieldd")
            .build()
            .map_err(|e| anyhow::anyhow!("build shieldd runtime: {e}"))?;
        let (storage, last_committed) = runtime.block_on(async {
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
        if let Some(h) = last_committed {
            // Only the newest record can be missing (crash after shieldd commit).
            if records.len() == h {
                let root = latest_root(&runtime, &storage)?;
                records.append(h, root).map_err(anyhow::Error::from)?;
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
            records,
            last_committed,
            tip_hash: None,
            pending: HashMap::new(),
            open: None,
            runtime,
        })
    }

    /// Last finalized shieldd height and root, `None` before genesis.
    pub fn committed(&self) -> Result<Option<(u64, B256)>, ShieldError> {
        let Some(height) = self.last_committed else {
            return Ok(None);
        };
        Ok(Some((height, latest_root(&self.runtime, &self.storage)?)))
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
        let root = self.runtime.block_on(async {
            self.execution.init_genesis(genesis).await?;
            self.execution.commit().await
        })?;
        let root = to_b256(&root.root_hash)?;
        self.record(0, root)?;
        Ok(root)
    }

    /// Stateless + stateful validation for the txpool against the latest
    /// finalized state. Returns the in-pool fee.
    pub fn check_tx(&self, tx: &[u8]) -> Result<ShieldFee, ShieldError> {
        if self.last_committed.is_none() {
            return Err(ShieldError::NotInitialized);
        }
        let response = self.runtime.block_on(self.execution.check_tx(tx))?;
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

    /// Opens a candidate block. Any block left open is abandoned.
    ///
    /// A finalized height becomes a replay (the v1 crash loop fix). A hash that
    /// was already sealed becomes cached. Otherwise the block runs on the
    /// finalized state plus its unfinalized ancestors.
    pub fn begin_block(&mut self, id: BlockId, unix_secs: i64) -> Result<BlockMode, ShieldError> {
        if self.open.take().is_some() {
            self.execution.rollback();
        }
        let committed = self.last_committed.ok_or(ShieldError::NotInitialized)?;
        let mode = if id.height <= committed {
            BlockMode::Replay(id.height)
        } else if self.pending.contains_key(&id.hash) {
            BlockMode::Cached(id.height)
        } else {
            let ancestors = self.ancestors(&id, committed)?;
            let time = tendermint::Time::from_unix_timestamp(unix_secs, 0)
                .map_err(|e| anyhow::anyhow!("block time {unix_secs}: {e}"))?;
            let block = HostBlock {
                height: i64::try_from(id.height).map_err(anyhow::Error::from)?,
                time,
            };
            self.runtime
                .block_on(self.execution.begin_block_on_pending(block, &ancestors))?;
            BlockMode::Live(id.height)
        };
        self.open = Some(Open {
            id,
            mode,
            outputs: Vec::new(),
        });
        Ok(mode)
    }

    /// Mints a shielded note for BRL the SHLD precompile already escrowed.
    /// Returns the deterministic deposit id, `None` on replay.
    pub fn deposit(&mut self, deposit: ShieldDeposit) -> Result<Option<B256>, ShieldError> {
        let digest = deposit.digest();
        let open = self.open.as_ref().ok_or(ShieldError::NoOpenBlock)?;
        let out = match open.mode {
            BlockMode::Replay(_) => return Ok(None),
            BlockMode::Cached(_) => self.cached_output(digest)?,
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
                let result = self.runtime.block_on(self.execution.deposit(request))?;
                Output::Deposit(Some(to_b256(&result.response.deposit_id)?))
            }
        };
        let id = match &out {
            Output::Deposit(id) => *id,
            Output::Tx(_) => return Err(self.diverged()),
        };
        self.push_output(digest, out);
        Ok(id)
    }

    /// Applies one shielded tx. A rejected tx is a normal outcome, not an error.
    pub fn deliver_tx(&mut self, tx: &[u8]) -> Result<TxOutcome, ShieldError> {
        let digest = keccak256(tx);
        let open = self.open.as_ref().ok_or(ShieldError::NoOpenBlock)?;
        let out = match open.mode {
            BlockMode::Replay(_) => return Ok(TxOutcome::Replayed),
            BlockMode::Cached(_) => self.cached_output(digest)?,
            BlockMode::Live(_) => {
                let response = self.runtime.block_on(self.execution.deliver_tx(tx))?;
                Output::Tx(if response.code == 0 {
                    TxOutcome::Accepted {
                        withdrawals: response.withdrawals,
                    }
                } else {
                    TxOutcome::Rejected { log: response.log }
                })
            }
        };
        let outcome = match &out {
            Output::Tx(outcome) => outcome.clone(),
            Output::Deposit(_) => return Err(self.diverged()),
        };
        self.push_output(digest, out);
        Ok(outcome)
    }

    /// Closes the open block.
    pub fn end_block(&mut self) -> Result<(), ShieldError> {
        let open = self.open.as_ref().ok_or(ShieldError::NoOpenBlock)?;
        if let BlockMode::Live(h) = open.mode {
            let height = i64::try_from(h).map_err(anyhow::Error::from)?;
            self.runtime.block_on(self.execution.end_block(height))?;
        }
        Ok(())
    }

    /// Seals the open block and returns its shieldd app hash. Nothing is written
    /// to disk; the block waits in memory for [`ShieldExecutor::finalize`].
    pub fn seal(&mut self) -> Result<B256, ShieldError> {
        let open = self.open.take().ok_or(ShieldError::NoOpenBlock)?;
        match open.mode {
            BlockMode::Replay(h) => self.root_at(h),
            BlockMode::Cached(_) => {
                let pending = &self.pending[&open.id.hash];
                if pending.outputs.len() != open.outputs.len() {
                    return Err(ShieldError::CachedDiverged(open.id.hash));
                }
                Ok(pending.root)
            }
            BlockMode::Live(height) => {
                let staged = self.runtime.block_on(self.execution.stage())?;
                let root = to_b256(&staged.root_hash)?;
                self.pending.insert(
                    open.id.hash,
                    Pending {
                        height,
                        parent: open.id.parent,
                        changes: staged.changes,
                        root,
                        outputs: open.outputs,
                    },
                );
                Ok(root)
            }
        }
    }

    /// Persists finalized block `hash` and any unfinalized ancestors, oldest
    /// first, then drops every candidate that doesn't descend from it. A height
    /// that is already finalized is a no-op (e.g. a notification after restart).
    pub fn finalize(&mut self, hash: B256, height: u64) -> Result<B256, ShieldError> {
        let committed = self.last_committed.ok_or(ShieldError::NotInitialized)?;
        if height <= committed {
            return self.root_at(height);
        }
        let mut chain = Vec::new();
        let mut cur = hash;
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
        let mut root = B256::ZERO;
        for block in chain.into_iter().rev() {
            let p = self.pending.remove(&block).expect("walked above");
            let commit = self
                .runtime
                .block_on(self.execution.commit_staged(&p.changes))?;
            root = to_b256(&commit.root_hash)?;
            if root != p.root {
                return Err(ShieldError::RootMismatch {
                    height: p.height,
                    staged: p.root,
                    committed: root,
                });
            }
            self.record(p.height, root)?;
            self.tip_hash = Some(block);
        }
        self.prune();
        Ok(root)
    }

    /// Pending ancestors of `id`, oldest first.
    fn ancestors(
        &self,
        id: &BlockId,
        committed: u64,
    ) -> Result<Vec<Arc<BlockChanges>>, ShieldError> {
        let unknown = || ShieldError::UnknownParent {
            height: id.height,
            parent: id.parent,
        };
        let mut chain = Vec::new();
        let (mut cur, mut height) = (id.parent, id.height);
        while height - 1 > committed {
            let p = self.pending.get(&cur).ok_or_else(unknown)?;
            if p.height != height - 1 {
                return Err(unknown());
            }
            chain.push(p.changes.clone());
            cur = p.parent;
            height -= 1;
        }
        // After a restart the tip hash is unknown, then the height is all we check.
        if self.tip_hash.is_some_and(|tip| tip != cur) {
            return Err(unknown());
        }
        chain.reverse();
        Ok(chain)
    }

    /// Keeps only candidates that build on the finalized tip.
    fn prune(&mut self) {
        let committed = self.last_committed.unwrap_or_default();
        let Some(tip) = self.tip_hash else { return };
        let mut by_height: Vec<(u64, B256, B256)> = self
            .pending
            .iter()
            .map(|(hash, p)| (p.height, *hash, p.parent))
            .collect();
        by_height.sort();
        let mut live = std::collections::HashSet::from([tip]);
        for (height, hash, parent) in by_height {
            if height > committed && live.contains(&parent) {
                live.insert(hash);
            }
        }
        self.pending.retain(|hash, _| live.contains(hash));
    }

    fn cached_output(&self, digest: B256) -> Result<Output, ShieldError> {
        let open = self.open.as_ref().ok_or(ShieldError::NoOpenBlock)?;
        let recorded = &self.pending[&open.id.hash].outputs;
        match recorded.get(open.outputs.len()) {
            Some((d, out)) if *d == digest => Ok(out.clone()),
            _ => Err(self.diverged()),
        }
    }

    fn diverged(&self) -> ShieldError {
        ShieldError::CachedDiverged(self.open.as_ref().map(|o| o.id.hash).unwrap_or_default())
    }

    fn push_output(&mut self, digest: B256, out: Output) {
        if let Some(open) = self.open.as_mut() {
            open.outputs.push((digest, out));
        }
    }

    fn record(&mut self, height: u64, root: B256) -> Result<(), ShieldError> {
        self.last_committed = Some(height);
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
    let root = runtime.block_on(storage.latest_snapshot().root_hash())?;
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
    const GENESIS: B256 = B256::ZERO;

    fn genesis() -> AppState {
        AppState::Content(Content::default().with_chain_id("bankd-v2-test".to_owned()))
    }

    fn id(hash: u8, parent: B256, height: u64) -> BlockId {
        BlockId {
            hash: B256::repeat_byte(hash),
            parent,
            height,
        }
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
    fn run(exec: &mut ShieldExecutor, block: BlockId, deposits: u32) -> B256 {
        exec.begin_block(block, T0 + block.height as i64).unwrap();
        for i in 0..deposits {
            exec.deposit(deposit(i)).unwrap();
        }
        exec.end_block().unwrap();
        exec.seal().unwrap()
    }

    #[test]
    fn competing_candidates_only_finalized_persists() {
        let (dir, mut exec) = fresh();
        let genesis_root = exec.committed().unwrap().unwrap().1;
        let a = id(0xa1, GENESIS, 1);
        let b = id(0xb1, GENESIS, 1);
        let root_a = run(&mut exec, a, 0);
        let root_b = run(&mut exec, b, 1);
        assert_ne!(root_a, root_b);
        // Sealing wrote nothing.
        assert_eq!(exec.committed().unwrap(), Some((0, genesis_root)));

        assert_eq!(exec.finalize(b.hash, 1).unwrap(), root_b);
        assert_eq!(exec.committed().unwrap(), Some((1, root_b)));
        assert_eq!(exec.pending_len(), 0, "losing sibling is discarded");
        assert!(matches!(
            exec.finalize(B256::repeat_byte(0xa1), 2),
            Err(ShieldError::UnknownBlock(_))
        ));

        // Restart after finalize: same state, next block builds on it.
        drop(exec);
        let mut exec = ShieldExecutor::open(dir.path()).unwrap();
        assert_eq!(exec.committed().unwrap(), Some((1, root_b)));
        let c = id(0xc2, b.hash, 2);
        run(&mut exec, c, 0);
        exec.finalize(c.hash, 2).unwrap();
        assert_eq!(exec.committed().unwrap().unwrap().0, 2);
    }

    #[test]
    fn child_of_unfinalized_parent_matches_sequential_commit() {
        let (_d1, mut exec) = fresh();
        let p = id(0x01, GENESIS, 1);
        let c = id(0x02, p.hash, 2);
        let root_p = run(&mut exec, p, 1);
        let root_c = run(&mut exec, c, 2);
        // A dead fork off p's sibling must not survive finalization.
        run(&mut exec, id(0x0f, GENESIS, 1), 0);
        assert_eq!(exec.finalize(c.hash, 2).unwrap(), root_c);
        assert_eq!(exec.pending_len(), 0);
        assert_eq!(exec.root_at(1).unwrap(), root_p);

        // A second node that finalizes every block right away agrees.
        let (_d2, mut other) = fresh();
        assert_eq!(run(&mut other, p, 1), root_p);
        other.finalize(p.hash, 1).unwrap();
        assert_eq!(run(&mut other, c, 2), root_c);
        other.finalize(c.hash, 2).unwrap();
        assert_eq!(other.committed().unwrap(), exec.committed().unwrap());
    }

    #[test]
    fn re_executing_a_sealed_block_is_cached() {
        let (_dir, mut exec) = fresh();
        let b = id(0x11, GENESIS, 1);
        let root = run(&mut exec, b, 1);
        assert_eq!(exec.begin_block(b, T0).unwrap(), BlockMode::Cached(1));
        assert!(exec.deposit(deposit(0)).unwrap().is_some());
        assert!(matches!(
            exec.deposit(deposit(9)),
            Err(ShieldError::CachedDiverged(_))
        ));
        exec.begin_block(b, T0).unwrap();
        exec.deposit(deposit(0)).unwrap();
        exec.end_block().unwrap();
        assert_eq!(exec.seal().unwrap(), root);
    }

    #[test]
    fn replay_guard_after_finalize() {
        let (dir, mut exec) = fresh();
        let b = id(0x21, GENESIS, 1);
        let root = run(&mut exec, b, 1);
        exec.finalize(b.hash, 1).unwrap();

        // Restarted node replays block 1: no-op, same root, nothing written.
        drop(exec);
        let mut exec = ShieldExecutor::open(dir.path()).unwrap();
        assert_eq!(exec.begin_block(b, T0).unwrap(), BlockMode::Replay(1));
        assert!(exec.deposit(deposit(0)).unwrap().is_none());
        assert!(matches!(
            exec.deliver_tx(b"junk").unwrap(),
            TxOutcome::Replayed
        ));
        exec.end_block().unwrap();
        assert_eq!(exec.seal().unwrap(), root);
        assert_eq!(exec.finalize(b.hash, 1).unwrap(), root);
        assert_eq!(exec.committed().unwrap(), Some((1, root)));
    }

    #[test]
    fn recovers_record_lost_after_shieldd_commit() {
        let (dir, mut exec) = fresh();
        let b = id(0x31, GENESIS, 1);
        let root = run(&mut exec, b, 1);
        exec.finalize(b.hash, 1).unwrap();
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
        exec.begin_block(b, T0).unwrap();
        exec.end_block().unwrap();
        assert_eq!(exec.seal().unwrap(), root);
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
            exec.begin_block(id(0x55, B256::repeat_byte(0x54), 5), T0),
            Err(ShieldError::UnknownParent { height: 5, .. })
        ));
        assert!(matches!(
            exec.check_tx(b"not a shielded tx"),
            Err(ShieldError::Rejected(_))
        ));
        exec.begin_block(id(0x41, GENESIS, 1), T0).unwrap();
        assert!(matches!(
            exec.deliver_tx(b"not a shielded tx").unwrap(),
            TxOutcome::Rejected { .. }
        ));
        exec.end_block().unwrap();
        exec.seal().unwrap();
    }
}
