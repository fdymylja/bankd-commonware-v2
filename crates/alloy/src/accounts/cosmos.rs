//! Local Cosmos style secp256k1 signing for Tempo primitive signatures.

use alloy_primitives::{Address, B256, ChainId};
use alloy_signer::{Signer, SignerSync};
use alloy_signer_local::PrivateKeySigner;
use tempo_cosmos_address::{address_from_compressed_pubkey, private_key_from_mnemonic};
use tempo_primitives::transaction::PrimitiveSignature;

/// Signs as a Cosmos account, so the signer address is ripemd160(sha256(pubkey)).
#[derive(Debug, Clone)]
pub struct CosmosSigner {
    inner: PrivateKeySigner,
    address: Address,
}

impl CosmosSigner {
    /// Creates a signer from a 32 byte secp256k1 private key.
    pub fn from_bytes(private_key: &B256) -> alloy_signer::Result<Self> {
        let inner = PrivateKeySigner::from_bytes(private_key)?;
        let pubkey: [u8; 33] = inner
            .credential()
            .verifying_key()
            .to_encoded_point(true)
            .as_bytes()
            .try_into()
            .expect("compressed point is 33 bytes");
        Ok(Self {
            address: address_from_compressed_pubkey(&pubkey),
            inner,
        })
    }

    /// Creates a signer from a mnemonic at `m/44'/118'/0'/0/{index}`.
    pub fn from_mnemonic(phrase: &str, index: u32) -> Result<Self, Box<dyn std::error::Error>> {
        let key = private_key_from_mnemonic(phrase, index)?;
        Ok(Self::from_bytes(&B256::from(key))?)
    }
}

#[async_trait::async_trait]
impl Signer<PrimitiveSignature> for CosmosSigner {
    async fn sign_hash(&self, hash: &B256) -> alloy_signer::Result<PrimitiveSignature> {
        self.sign_hash_sync(hash)
    }

    fn address(&self) -> Address {
        self.address
    }

    fn chain_id(&self) -> Option<ChainId> {
        self.inner.chain_id()
    }

    fn set_chain_id(&mut self, chain_id: Option<ChainId>) {
        self.inner.set_chain_id(chain_id);
    }
}

impl SignerSync<PrimitiveSignature> for CosmosSigner {
    fn sign_hash_sync(&self, hash: &B256) -> alloy_signer::Result<PrimitiveSignature> {
        self.inner
            .sign_hash_sync(hash)
            .map(PrimitiveSignature::CosmosSecp256k1)
    }

    fn chain_id_sync(&self) -> Option<ChainId> {
        self.inner.chain_id()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy_consensus::transaction::SignerRecoverable;
    use alloy_primitives::{Bytes, TxKind, U256};
    use tempo_primitives::{
        TempoTxEnvelope,
        transaction::{Call, TempoSignature, TempoTransaction},
    };

    const MNEMONIC: &str = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    #[test]
    fn signs_and_recovers_cosmos_address() {
        let signer = CosmosSigner::from_mnemonic(MNEMONIC, 0).unwrap();
        let bech32 = tempo_cosmos_address::to_bech32("juno", &signer.address()).unwrap();
        assert_eq!(bech32, "juno19rl4cm2hmr8afy4kldpxz3fka4jguq0a2jwxcf");

        let hash = B256::repeat_byte(0x42);
        let sig = signer.sign_hash_sync(&hash).unwrap();
        assert!(matches!(sig, PrimitiveSignature::CosmosSecp256k1(_)));
        assert_eq!(sig.recover_signer(&hash).unwrap(), signer.address());
    }

    #[test]
    fn signed_aa_tx_recovers_cosmos_address() {
        let signer = CosmosSigner::from_mnemonic(MNEMONIC, 0).unwrap();
        let tx = TempoTransaction {
            chain_id: 42431,
            max_priority_fee_per_gas: 1,
            max_fee_per_gas: 1,
            gas_limit: 21_000,
            calls: vec![Call {
                to: TxKind::Call(Address::repeat_byte(0x11)),
                value: U256::ZERO,
                input: Bytes::new(),
            }],
            ..Default::default()
        };
        let sig = signer.sign_hash_sync(&tx.signature_hash()).unwrap();
        let envelope = TempoTxEnvelope::AA(tx.into_signed(TempoSignature::Primitive(sig)));
        assert_eq!(envelope.recover_signer().unwrap(), signer.address());
    }
}
