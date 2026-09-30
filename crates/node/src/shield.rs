//! Plugs the embedded shieldd engine (`bankd-shield`) into block execution and finality.
//!
//! One [`ShieldExecutor`] per node, shared by the payload builder, the engine's block
//! validation and the consensus finalization hook. Blocks take turns through a session
//! lock because shieldd holds a single open block.

use std::{
    path::Path,
    str::FromStr,
    sync::{Arc, Condvar, Mutex, MutexGuard},
};

use alloy_primitives::{Address, B256, U256};
use bankd_shield::{
    AppState, Content, ShieldDeposit, ShieldError, ShieldExecutor, TxOutcome, system::BRL_DENOM,
};
use tempo_evm::shield::{
    ShieldDepositInput, ShieldEngine, ShieldHandle, ShieldSession, ShieldTxOutcome,
};

/// Env var that turns the embedded shieldd engine off (any value).
pub const SHIELD_DISABLE_ENV: &str = "BANKD_SHIELD_DISABLE";

#[derive(Debug)]
struct Shared {
    exec: Mutex<ShieldExecutor>,
    busy: Mutex<bool>,
    free: Condvar,
}

impl Shared {
    fn exec(&self) -> MutexGuard<'_, ShieldExecutor> {
        // A panic mid-call leaves shieldd state unknown, surfacing it beats hiding it.
        self.exec.lock().expect("shieldd executor lock poisoned")
    }

    fn acquire(&self) {
        let mut busy = self.busy.lock().expect("shieldd session lock poisoned");
        while *busy {
            busy = self.free.wait(busy).expect("shieldd session lock poisoned");
        }
        *busy = true;
    }

    fn release(&self) {
        *self.busy.lock().expect("shieldd session lock poisoned") = false;
        self.free.notify_one();
    }
}

/// [`ShieldEngine`] backed by a [`ShieldExecutor`].
#[derive(Debug, Clone)]
pub struct BankdShield(Arc<Shared>);

impl BankdShield {
    /// Opens shieldd state under `home` and runs genesis if it's fresh.
    pub fn open(home: &Path, chain_id: u64) -> eyre::Result<Self> {
        let mut exec = ShieldExecutor::open(home)?;
        let genesis =
            AppState::Content(Content::default().with_chain_id(format!("bankd-{chain_id}")));
        let root = exec.init_genesis(genesis)?;
        tracing::info!(target: "bankd::shield", home = %home.display(), %root, committed = ?exec.committed(), "shieldd ready");
        Ok(Self(Arc::new(Shared {
            exec: Mutex::new(exec),
            busy: Mutex::new(false),
            free: Condvar::new(),
        })))
    }

    /// As a [`ShieldHandle`] for the EVM config.
    pub fn handle(&self) -> ShieldHandle {
        Arc::new(self.clone())
    }
}

impl ShieldEngine for BankdShield {
    fn session(&self) -> Box<dyn ShieldSession> {
        self.0.acquire();
        Box::new(Session {
            shared: self.0.clone(),
        })
    }

    fn finalize(&self, root: B256, height: u64) -> Result<(), String> {
        // Wait out any block mid-execution, shieldd can only commit while idle.
        self.0.acquire();
        let result = self.0.exec().finalize(root, height);
        self.0.release();
        result.map(|_| ()).map_err(|e| e.to_string())
    }

    fn check_tx(&self, payload: &[u8]) -> Result<(), String> {
        self.0
            .exec()
            .check_tx(payload)
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    fn checkpoint(&self) -> Result<(std::path::PathBuf, u64), String> {
        // The exec lock keeps finalize out, so the checkpoint matches the height.
        self.0.exec().checkpoint().map_err(err)
    }

    fn query(&self, method: &str, request: &[u8]) -> Result<Vec<Vec<u8>>, String> {
        self.0.exec().query(method, request).map_err(err)
    }
}

struct Session {
    shared: Arc<Shared>,
}

impl Drop for Session {
    fn drop(&mut self) {
        self.shared.release();
    }
}

fn err(e: ShieldError) -> String {
    e.to_string()
}

impl ShieldSession for Session {
    fn begin_block(
        &mut self,
        parent_root: B256,
        height: u64,
        timestamp: u64,
    ) -> Result<(), String> {
        let secs = i64::try_from(timestamp).map_err(|e| e.to_string())?;
        self.shared
            .exec()
            .begin_block(parent_root, height, secs)
            .map(|_| ())
            .map_err(err)
    }

    fn deposit(&mut self, deposit: ShieldDepositInput) -> Result<bool, String> {
        let amount = u128::try_from(deposit.amount).map_err(|e| e.to_string())?;
        let id = self
            .shared
            .exec()
            .deposit(ShieldDeposit {
                denom: BRL_DENOM.to_owned(),
                amount,
                recipient: deposit.recipient,
                tx_hash: deposit.tx_hash,
                tx_index: deposit.tx_index,
                msg_index: deposit.msg_index,
            })
            .map_err(err)?;
        Ok(id.is_some())
    }

    fn deliver_tx(&mut self, payload: &[u8]) -> Result<ShieldTxOutcome, String> {
        let outcome = self.shared.exec().deliver_tx(payload).map_err(err)?;
        Ok(match &outcome {
            TxOutcome::Rejected { log } => ShieldTxOutcome::Rejected(log.clone()),
            TxOutcome::Accepted { .. } => {
                let mut payouts = Vec::new();
                for (recipient, amount) in outcome.transfers(BRL_DENOM) {
                    match Address::from_str(&recipient) {
                        Ok(to) => payouts.push((to, U256::from(amount))),
                        // Deterministic on every node; the BRL stays in escrow.
                        Err(_) => {
                            tracing::warn!(target: "bankd::shield", %recipient, "withdrawal to a non-EVM recipient left in escrow")
                        }
                    }
                }
                ShieldTxOutcome::Accepted { payouts }
            }
        })
    }

    fn finish(&mut self) -> Result<B256, String> {
        let mut exec = self.shared.exec();
        exec.end_block().map_err(err)?;
        exec.seal().map_err(err)
    }
}

/// Persists shieldd state for a block consensus just finalized. The block's shieldd root is
/// read back from its post-state (the SHLD root slot), which is how candidates are keyed.
pub fn finalize_block<P>(
    provider: &P,
    shield: &ShieldHandle,
    block_hash: B256,
    height: u64,
) -> eyre::Result<()>
where
    P: reth_storage_api::StateProviderFactory,
{
    let state = provider.state_by_block_hash(block_hash)?;
    let root = state
        .storage(tempo_contracts::precompiles::SHIELD_ADDRESS, B256::ZERO)?
        .unwrap_or_default();
    shield
        .finalize(B256::from(root), height)
        .map_err(|e| eyre::eyre!("shieldd finalize at height {height}: {e}"))
}

/// txpool check for 0x77 txs.
#[derive(Debug, Clone)]
pub struct PoolChecker(ShieldHandle);

impl PoolChecker {
    /// Shares the node's engine with the pool.
    pub fn new(
        shield: ShieldHandle,
    ) -> Arc<dyn tempo_transaction_pool::validator::ShieldedTxChecker> {
        Arc::new(Self(shield))
    }
}

impl tempo_transaction_pool::validator::ShieldedTxChecker for PoolChecker {
    fn check(&self, payload: &[u8]) -> Result<(), String> {
        self.0.check_tx(payload)
    }
}
