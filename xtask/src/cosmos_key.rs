use alloy_primitives::hex;
use tempo_cosmos_address::{
    JUNO_HRP, address_from_compressed_pubkey, compressed_pubkey, generate_mnemonic,
    private_key_from_mnemonic, to_bech32,
};

/// Prints the Cosmos (m/44'/118') key for a mnemonic. Generates one if none is given.
#[derive(Debug, clap::Args)]
pub(crate) struct CosmosKey {
    #[arg(short, long)]
    mnemonic: Option<String>,

    #[arg(long, default_value_t = 0)]
    index: u32,

    #[arg(long, default_value = JUNO_HRP)]
    hrp: String,
}

impl CosmosKey {
    pub(crate) fn run(self) -> eyre::Result<()> {
        let mnemonic = self.mnemonic.unwrap_or_else(generate_mnemonic);
        let private_key = private_key_from_mnemonic(&mnemonic, self.index)?;
        let pubkey = compressed_pubkey(&private_key)?;
        let address = address_from_compressed_pubkey(&pubkey);

        println!("mnemonic:    {mnemonic}");
        println!(
            "path:        {}",
            tempo_cosmos_address::derivation_path(self.index)
        );
        println!("bech32:      {}", to_bech32(&self.hrp, &address)?);
        println!("address:     {address}");
        println!("pubkey:      {}", hex::encode(pubkey));
        println!("private key: {}", hex::encode(private_key));
        Ok(())
    }
}
