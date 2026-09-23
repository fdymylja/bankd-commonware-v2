//! Dev wallet for the shieldd pool embedded in bankd v2.
//!
//! Syncs a test wallet from a shieldd state checkpoint (see `bankd_shieldCheckpoint`), then
//! builds and proves a transfer or a withdrawal to an EVM address and prints it as a raw
//! `0x77 || rlp([tx])` envelope ready for `eth_sendRawTransaction`. Keys come from shieldd's
//! public test seed phrase, so this is for localnets only.

use std::path::PathBuf;

use alloy_rlp::{Encodable, Header};
use anyhow::{Context, Result, anyhow};
use clap::{Parser, Subcommand};
use cnidarium::Storage;
use decaf377::Fr;
use rand_core::OsRng;
use shieldd_sdk_app::SUBSTORE_PREFIXES;
use shieldd_sdk_asset::{Value, asset};
use shieldd_sdk_keys::{Address, keys::Bip44Path, keys::SpendKey, test_keys};
use shieldd_sdk_mock_client::{
    ActionIntent, MockClient, TransactionIntent, TransferIntent, WithdrawalIntent,
};
use shieldd_sdk_num::Amount;
use shieldd_sdk_proto::DomainType;
use shieldd_sdk_shielded_pool::{
    HostTransfer, HostWithdrawal, HostWithdrawalDestination, Note, ShieldedInputPlan,
    ShieldedOutputPlan,
};
use shieldd_sdk_transaction::{TransactionParameters, memo::MemoPlaintext, plan::MemoPlan};

/// Shieldd denom of native BRL in bankd v2 (atto-BRL, 1:1 with wei).
const BRL_DENOM: &str = "abrl";

/// Type byte of the bankd shielded tx envelope.
const SHIELDED_TX_TYPE: u8 = 0x77;

#[derive(Parser)]
#[command(about = "Build and prove shieldd txs for a bankd v2 localnet")]
struct Cli {
    /// BIP44 account of shieldd's test seed phrase. 0 is shieldd's usual test wallet.
    #[arg(long, global = true, default_value_t = 0)]
    account: u32,
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Print the wallet's shieldd address (index 0).
    Address,
    /// Print unspent abrl the wallet holds, synced from a checkpoint.
    Balance {
        #[arg(long)]
        db: PathBuf,
    },
    /// Private transfer of abrl to a shieldd address, with change back to the sender.
    Transfer {
        #[arg(long)]
        db: PathBuf,
        #[arg(long)]
        chain_id: String,
        #[arg(long)]
        to: String,
        #[arg(long)]
        amount: u128,
    },
    /// Withdraw abrl out of the pool to an EVM address.
    Withdraw {
        #[arg(long)]
        db: PathBuf,
        #[arg(long)]
        chain_id: String,
        /// `0x` EVM recipient.
        #[arg(long)]
        to: String,
        #[arg(long)]
        amount: u128,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let sk = spend_key(cli.account)?;
    match cli.cmd {
        Cmd::Address => println!("{}", self_address(&sk)),
        Cmd::Balance { db } => {
            let (client, _) = sync(&sk, &db).await?;
            let brl = brl_id();
            let notes: Vec<_> = unspent(&client, brl).collect();
            let total: u128 = notes.iter().map(|n| u128::from(n.amount())).sum();
            println!("{BRL_DENOM} {total} notes={}", notes.len());
        }
        Cmd::Transfer {
            db,
            chain_id,
            to,
            amount,
        } => {
            let to: Address = to.parse().context("invalid shieldd recipient")?;
            let (client, storage) = sync(&sk, &db).await?;
            let (spend, note, change) = pick_note(&client, amount.into())?;
            let value = Value {
                amount: amount.into(),
                asset_id: note.asset_id(),
            };
            let change = Value {
                amount: change,
                asset_id: note.asset_id(),
            };
            let transfer = TransferIntent {
                spends: vec![spend],
                outputs: vec![
                    ShieldedOutputPlan::new(&mut OsRng, value, to),
                    ShieldedOutputPlan::new(&mut OsRng, change, note.address()),
                ],
                value_blinding: Fr::from(1u64),
            };
            let tx = build(&client, &storage, &chain_id, &note, transfer.into()).await?;
            println!("{}", envelope(&tx));
        }
        Cmd::Withdraw {
            db,
            chain_id,
            to,
            amount,
        } => {
            anyhow::ensure!(
                to.starts_with("0x") && to.len() == 42,
                "--to must be a 0x address"
            );
            let (client, storage) = sync(&sk, &db).await?;
            let (spend, note, change) = pick_note(&client, amount.into())?;
            // Zero change would be a zero-value output, just skip it.
            let change_output = (change != Amount::zero()).then(|| {
                let value = Value {
                    amount: change,
                    asset_id: note.asset_id(),
                };
                ShieldedOutputPlan::new(&mut OsRng, value, note.address())
            });
            let withdrawal = WithdrawalIntent {
                spends: vec![spend],
                change_output,
                withdrawal: HostWithdrawal {
                    value: Value {
                        amount: amount.into(),
                        asset_id: note.asset_id(),
                    },
                    destination: HostWithdrawalDestination::Transfer(HostTransfer {
                        recipient: to,
                    }),
                },
                value_blinding: Fr::from(1u64),
            };
            let tx = build(&client, &storage, &chain_id, &note, withdrawal.into()).await?;
            println!("{}", envelope(&tx));
        }
    }
    Ok(())
}

fn spend_key(account: u32) -> Result<SpendKey> {
    let seed = test_keys::SEED_PHRASE
        .parse()
        .map_err(|e| anyhow!("test seed phrase: {e}"))?;
    SpendKey::from_seed_phrase_bip44(seed, &Bip44Path::new(account))
        .map_err(|e| anyhow!("derive spend key for account {account}: {e}"))
}

fn self_address(sk: &SpendKey) -> Address {
    sk.full_viewing_key().payment_address(0u32.into())
}

fn brl_id() -> asset::Id {
    asset::REGISTRY
        .parse_denom(BRL_DENOM)
        .expect("abrl parses as a base denom")
        .id()
}

async fn sync(sk: &SpendKey, db: &PathBuf) -> Result<(MockClient, Storage)> {
    let storage = Storage::load(db.clone(), SUBSTORE_PREFIXES.to_vec())
        .await
        .with_context(|| format!("open shieldd checkpoint {}", db.display()))?;
    let client = MockClient::new(sk.clone())
        .with_sync_to_storage(&storage)
        .await
        .context("sync wallet to checkpoint")?;
    Ok((client, storage))
}

fn unspent(client: &MockClient, asset_id: asset::Id) -> impl Iterator<Item = &Note> + '_ {
    client.spendable_notes_by_asset(asset_id)
}

/// First unspent abrl note covering `amount`, its spend plan and the change left over.
fn pick_note(client: &MockClient, amount: Amount) -> Result<(ShieldedInputPlan, Note, Amount)> {
    let note = unspent(client, brl_id())
        .find(|n| n.amount() >= amount)
        .cloned()
        .ok_or_else(|| anyhow!("no unspent {BRL_DENOM} note covers {amount}"))?;
    let position = client
        .position(note.commit())
        .ok_or_else(|| anyhow!("note commitment unknown to the wallet's tree"))?;
    let spend = ShieldedInputPlan::new(&mut OsRng, note.clone(), position);
    let change = note
        .amount()
        .checked_sub(&amount)
        .context("note must cover amount")?;
    Ok((spend, note, change))
}

async fn build(
    client: &MockClient,
    storage: &Storage,
    chain_id: &str,
    note: &Note,
    action: ActionIntent,
) -> Result<Vec<u8>> {
    // Fees stay unset: bankd v2 runs shieldd with zero gas prices.
    let intent = TransactionIntent {
        actions: vec![action],
        memo: Some(MemoPlan::new(
            &mut OsRng,
            MemoPlaintext::blank_memo(note.address()),
        )),
        fee_funding: None,
        transaction_parameters: TransactionParameters {
            chain_id: chain_id.to_owned(),
            ..Default::default()
        },
        nullifier_window: None,
    };
    let plan = client
        .complete_intent(intent, storage.latest_snapshot())
        .await?;
    let tx = client
        .witness_auth_build(&plan)
        .await
        .context("build and prove shieldd tx")?;
    Ok(tx.encode_to_vec())
}

/// `0x77 || rlp([tx])`, the same bytes `TxShielded` encodes.
fn envelope(tx: &[u8]) -> String {
    let mut out = vec![SHIELDED_TX_TYPE];
    Header {
        list: true,
        payload_length: tx.length(),
    }
    .encode(&mut out);
    tx.encode(&mut out);
    const_hex::encode_prefixed(out)
}
