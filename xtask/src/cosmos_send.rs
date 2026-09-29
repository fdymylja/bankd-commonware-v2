use alloy::{
    network::ReceiptResponse,
    providers::{Provider, ProviderBuilder},
    signers::SignerSync,
};
use alloy_eips::Encodable2718;
use alloy_primitives::{Address, Bytes, TxKind, U256, hex};
use eyre::{Context, bail};
use tempo_alloy::{TempoNetwork, accounts::CosmosSigner};
use tempo_primitives::{
    TempoTxEnvelope,
    transaction::{Call, TempoSignature, TempoTransaction},
};

/// 1 ujuno is 1e12 wei (18 decimals vs 6).
const WEI_PER_UJUNO: u128 = 1_000_000_000_000;

/// Sends a Tempo AA tx signed by a Cosmos (juno) key. Plain transfer or contract call.
#[derive(Debug, clap::Args)]
pub(crate) struct CosmosSend {
    #[arg(short, long)]
    mnemonic: String,

    #[arg(long, default_value_t = 0)]
    index: u32,

    #[arg(long)]
    rpc_url: String,

    #[arg(long)]
    to: Address,

    /// Native value in ujuno (converted to wei).
    #[arg(long, conflicts_with = "value_wei")]
    value_ujuno: Option<u128>,

    #[arg(long)]
    value_wei: Option<U256>,

    /// Calldata hex for a contract call.
    #[arg(long)]
    data: Option<String>,

    #[arg(long, default_value_t = 1_000_000)]
    gas_limit: u64,

    /// Don't fail the command on a reverted receipt.
    #[arg(long)]
    allow_revert: bool,
}

impl CosmosSend {
    pub(crate) async fn run(self) -> eyre::Result<()> {
        let signer = CosmosSigner::from_mnemonic(&self.mnemonic, self.index)
            .map_err(|e| eyre::eyre!("signer: {e}"))?;
        let provider =
            ProviderBuilder::new_with_network::<TempoNetwork>().connect_http(self.rpc_url.parse()?);
        let from = alloy::signers::Signer::address(&signer);
        let chain_id = provider.get_chain_id().await?;
        let nonce = provider.get_transaction_count(from).await?;
        let value = match (self.value_ujuno, self.value_wei) {
            (Some(u), _) => U256::from(u) * U256::from(WEI_PER_UJUNO),
            (_, Some(w)) => w,
            _ => U256::ZERO,
        };
        let input: Bytes = match &self.data {
            Some(d) => hex::decode(d.trim_start_matches("0x"))?.into(),
            None => Bytes::new(),
        };

        // Base fee is 20 gwei on localnet, leave headroom.
        let tx = TempoTransaction {
            chain_id,
            max_priority_fee_per_gas: 1_000_000_000,
            max_fee_per_gas: 100_000_000_000,
            gas_limit: self.gas_limit,
            nonce,
            calls: vec![Call {
                to: TxKind::Call(self.to),
                value,
                input,
            }],
            ..Default::default()
        };
        let sig = signer.sign_hash_sync(&tx.signature_hash())?;
        let envelope = TempoTxEnvelope::AA(tx.into_signed(TempoSignature::Primitive(sig)));
        let raw = envelope.encoded_2718();

        println!("from:   {from}");
        let pending = provider
            .send_raw_transaction(&raw)
            .await
            .wrap_err("send raw tx")?;
        let receipt = pending.get_receipt().await.wrap_err("wait receipt")?;
        println!("hash:   {}", receipt.transaction_hash);
        println!("status: {}", receipt.status());
        println!("gas:    {}", receipt.gas_used);
        if !receipt.status() && !self.allow_revert {
            bail!("tx reverted");
        }
        Ok(())
    }
}
