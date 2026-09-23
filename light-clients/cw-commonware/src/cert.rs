//! Tempo's `Finalization` certificate, as returned hex encoded by `consensus_getFinalization`.
//!
//! Layout: `varint(epoch) varint(view) varint(parent) payload[32] vote_sig[48] seed_sig[48]`.
//! Signatures are compressed G1 (MinSig). The seed signature is only for the VRF, finality ignores it.

use crate::Error;

pub const G1_COMPRESSED: usize = 48;

/// A decoded finalization certificate.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Finalization {
    pub epoch: u64,
    pub view: u64,
    pub parent: u64,
    pub payload: [u8; 32],
    pub vote_signature: [u8; G1_COMPRESSED],
}

impl Finalization {
    pub fn decode(raw: &[u8]) -> Result<Self, Error> {
        let mut off = 0;
        let epoch = read_varint(raw, &mut off).ok_or(Error::MalformedCertificate("epoch"))?;
        let view = read_varint(raw, &mut off).ok_or(Error::MalformedCertificate("view"))?;
        let parent = read_varint(raw, &mut off).ok_or(Error::MalformedCertificate("parent"))?;
        if raw.len() != off + 32 + 2 * G1_COMPRESSED {
            return Err(Error::MalformedCertificate("length"));
        }
        let payload = raw[off..off + 32].try_into().expect("checked length");
        off += 32;
        let vote_signature = raw[off..off + G1_COMPRESSED]
            .try_into()
            .expect("checked length");
        Ok(Self {
            epoch,
            view,
            parent,
            payload,
            vote_signature,
        })
    }
}

/// LEB128 varint, as commonware's codec writes u64s. Rejects overlong encodings.
pub fn read_varint(data: &[u8], off: &mut usize) -> Option<u64> {
    let mut value = 0u64;
    let mut shift = 0u32;
    loop {
        let b = *data.get(*off)?;
        *off += 1;
        if shift == 63 && b > 1 {
            return None;
        }
        value |= u64::from(b & 0x7f) << shift;
        if b & 0x80 == 0 {
            // A trailing zero byte means the encoding wasn't minimal.
            if b == 0 && shift > 0 {
                return None;
            }
            return Some(value);
        }
        shift += 7;
        if shift > 63 {
            return None;
        }
    }
}

pub fn write_varint(mut value: u64, out: &mut Vec<u8>) {
    loop {
        let b = (value & 0x7f) as u8;
        value >>= 7;
        if value == 0 {
            out.push(b);
            return;
        }
        out.push(b | 0x80);
    }
}
