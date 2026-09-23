//! Shielded transaction (type 0x77): an opaque shieldd tx carried in a block.
//!
//! It has no ECDSA signer and pays its fee inside the shielded pool, so no EOA gets linked to
//! the shielded action. The block executor hands the payload to shieldd instead of the EVM.

use alloc::vec::Vec;
use alloy_consensus::{Sealable, Sealed, Transaction, Typed2718};
use alloy_eips::{
    eip2718::{Decodable2718, Eip2718Error, Eip2718Result, Encodable2718},
    eip2930::AccessList,
    eip7702::SignedAuthorization,
};
use alloy_primitives::{Address, B256, Bytes, ChainId, TxKind, U256, keccak256};
use alloy_rlp::{Decodable, Encodable, Header};

pub use tempo_contracts::precompiles::SHIELD_ADDRESS;

/// Shielded transaction type byte.
pub const SHIELDED_TX_TYPE_ID: u8 = 0x77;

/// Fixed gas a shielded tx counts against the block gas limit. Nobody pays it, it only
/// bounds how many shielded txs fit in a block.
pub const SHIELDED_TX_GAS: u64 = 250_000;

/// Nominal fee cap reported to the txpool. It's never charged (the executor skips the EVM and
/// `effective_gas_price` is 0), it only keeps the tx above reth's min protocol base fee and out
/// of the base-fee subpool. The priority fee stays 0, so shielded txs sort after every EVM tx.
pub const SHIELDED_TX_FEE_CAP: u128 = u64::MAX as u128;

/// Domain separator for [`shielded_sender`].
const SHIELDED_SENDER_DOMAIN: &[u8] = b"bankd-shielded-sender";

/// Pseudo sender of a shielded tx. Unique per tx so reth's pool treats every shielded tx as its
/// own sender at nonce 0, and no real account is linked to it.
pub fn shielded_sender(tx_hash: B256) -> Address {
    let mut buf = Vec::with_capacity(SHIELDED_SENDER_DOMAIN.len() + 32);
    buf.extend_from_slice(SHIELDED_SENDER_DOMAIN);
    buf.extend_from_slice(tx_hash.as_slice());
    Address::from_slice(&keccak256(buf)[12..])
}

/// Opaque shieldd transaction bytes. Encoded as `0x77 || rlp([input])`.
#[derive(Clone, Debug, Default, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "camelCase"))]
#[cfg_attr(any(test, feature = "arbitrary"), derive(arbitrary::Arbitrary))]
pub struct TxShielded {
    /// Shieldd protobuf transaction.
    pub input: Bytes,
}

impl TxShielded {
    /// Wraps shieldd tx bytes.
    pub const fn new(input: Bytes) -> Self {
        Self { input }
    }

    fn rlp_payload_len(&self) -> usize {
        self.input.length()
    }

    fn rlp_header(&self) -> Header {
        Header {
            list: true,
            payload_length: self.rlp_payload_len(),
        }
    }

    fn rlp_decode(buf: &mut &[u8]) -> alloy_rlp::Result<Self> {
        let header = Header::decode(buf)?;
        if !header.list {
            return Err(alloy_rlp::Error::UnexpectedString);
        }
        let started = buf.len();
        let input = Bytes::decode(buf)?;
        if started - buf.len() != header.payload_length {
            return Err(alloy_rlp::Error::ListLengthMismatch {
                expected: header.payload_length,
                got: started - buf.len(),
            });
        }
        Ok(Self { input })
    }

    /// Hash of the 2718 encoding, the tx hash.
    pub fn tx_hash(&self) -> B256 {
        keccak256(self.encoded_2718())
    }

    /// Seals with the tx hash.
    pub fn seal(self) -> Sealed<Self> {
        self.seal_slow()
    }
}

impl Sealable for TxShielded {
    fn hash_slow(&self) -> B256 {
        self.tx_hash()
    }
}

impl Typed2718 for TxShielded {
    fn ty(&self) -> u8 {
        SHIELDED_TX_TYPE_ID
    }
}

impl Encodable2718 for TxShielded {
    fn encode_2718_len(&self) -> usize {
        1 + self.rlp_header().length_with_payload()
    }

    fn encode_2718(&self, out: &mut dyn alloy_rlp::BufMut) {
        out.put_u8(SHIELDED_TX_TYPE_ID);
        self.rlp_header().encode(out);
        self.input.encode(out);
    }
}

impl Decodable2718 for TxShielded {
    fn typed_decode(ty: u8, buf: &mut &[u8]) -> Eip2718Result<Self> {
        if ty != SHIELDED_TX_TYPE_ID {
            return Err(Eip2718Error::UnexpectedType(ty));
        }
        Self::rlp_decode(buf).map_err(Into::into)
    }

    fn fallback_decode(_: &mut &[u8]) -> Eip2718Result<Self> {
        Err(Eip2718Error::UnexpectedType(0))
    }
}

impl Transaction for TxShielded {
    fn chain_id(&self) -> Option<ChainId> {
        None
    }

    fn nonce(&self) -> u64 {
        0
    }

    fn gas_limit(&self) -> u64 {
        SHIELDED_TX_GAS
    }

    fn gas_price(&self) -> Option<u128> {
        None
    }

    fn max_fee_per_gas(&self) -> u128 {
        SHIELDED_TX_FEE_CAP
    }

    fn max_priority_fee_per_gas(&self) -> Option<u128> {
        Some(0)
    }

    fn max_fee_per_blob_gas(&self) -> Option<u128> {
        None
    }

    fn priority_fee_or_price(&self) -> u128 {
        0
    }

    fn effective_gas_price(&self, _base_fee: Option<u64>) -> u128 {
        0
    }

    fn is_dynamic_fee(&self) -> bool {
        true
    }

    fn kind(&self) -> TxKind {
        TxKind::Call(SHIELD_ADDRESS)
    }

    fn is_create(&self) -> bool {
        false
    }

    fn value(&self) -> U256 {
        U256::ZERO
    }

    fn input(&self) -> &Bytes {
        &self.input
    }

    fn access_list(&self) -> Option<&AccessList> {
        None
    }

    fn blob_versioned_hashes(&self) -> Option<&[B256]> {
        None
    }

    fn authorization_list(&self) -> Option<&[SignedAuthorization]> {
        None
    }
}

// Only so the typed-tx enum can hold it; there's nothing to sign.
impl alloy_consensus::SignableTransaction<alloy_primitives::Signature> for TxShielded {
    fn set_chain_id(&mut self, _chain_id: ChainId) {}

    fn encode_for_signing(&self, out: &mut dyn alloy_rlp::BufMut) {
        self.encode_2718(out);
    }

    fn payload_len_for_signature(&self) -> usize {
        self.encode_2718_len()
    }
}

impl alloy_consensus::transaction::SignerRecoverable for TxShielded {
    fn recover_signer(&self) -> Result<Address, alloy_consensus::crypto::RecoveryError> {
        Ok(shielded_sender(self.tx_hash()))
    }

    fn recover_signer_unchecked(&self) -> Result<Address, alloy_consensus::crypto::RecoveryError> {
        self.recover_signer()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tx(bytes: &[u8]) -> TxShielded {
        TxShielded::new(Bytes::copy_from_slice(bytes))
    }

    #[test]
    fn shielded_2718_roundtrip() {
        let t = tx(b"shieldd tx bytes");
        let enc = t.encoded_2718();
        assert_eq!(enc[0], SHIELDED_TX_TYPE_ID);
        let dec = TxShielded::decode_2718_exact(&enc).unwrap();
        assert_eq!(dec, t);
        assert_eq!(t.tx_hash(), keccak256(&enc));
        assert_eq!(t.clone().seal().hash(), t.tx_hash());
    }

    #[test]
    fn shielded_rejects_other_types() {
        let mut enc = tx(b"x").encoded_2718();
        enc[0] = 0x76;
        assert!(TxShielded::decode_2718_exact(&enc).is_err());
    }

    #[test]
    fn shielded_envelope_roundtrip_and_sender() {
        use crate::TempoTxEnvelope;
        use alloy_consensus::transaction::{SignerRecoverable, TxHashRef};

        let t = tx(b"payload");
        let env = TempoTxEnvelope::from(t.clone());
        let enc = env.encoded_2718();
        assert_eq!(enc, t.encoded_2718());
        let dec = TempoTxEnvelope::decode_2718_exact(&enc).unwrap();
        assert!(dec.is_shielded());
        assert_eq!(dec.shielded_payload(), Some(&t.input));
        assert_eq!(*dec.tx_hash(), t.tx_hash());
        assert_eq!(dec.recover_signer().unwrap(), shielded_sender(t.tx_hash()));
        assert_eq!(dec.tx_type(), crate::TempoTxType::Shielded);
        assert_eq!(dec.max_priority_fee_per_gas(), Some(0));
    }

    #[test]
    fn shielded_sender_is_unique_per_tx() {
        let (a, b) = (tx(b"a"), tx(b"b"));
        assert_ne!(shielded_sender(a.tx_hash()), shielded_sender(b.tx_hash()));
        assert_eq!(shielded_sender(a.tx_hash()), shielded_sender(a.tx_hash()));
        assert_ne!(shielded_sender(a.tx_hash()), Address::ZERO);
    }
}
