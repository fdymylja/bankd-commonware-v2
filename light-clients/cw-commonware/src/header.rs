//! TempoHeader RLP decoding. Mirrors `TempoHeaderLib.sol`: only the fields the client needs.

use alloy_rlp::{Decodable, Header};

use crate::Error;

// Indices into the inner (ethereum style) header list.
const STATE_ROOT: usize = 3;
const NUMBER: usize = 8;
const TIMESTAMP: usize = 11;
const EXTRA_DATA: usize = 12;

/// Simplex round the block was proposed in, present on newer tempo headers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConsensusContext {
    pub epoch: u64,
    pub view: u64,
    pub parent_view: u64,
}

/// The fields of a TempoHeader the light client uses.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TempoHeader {
    pub number: u64,
    pub timestamp: u64,
    pub state_root: [u8; 32],
    pub extra_data: Vec<u8>,
    pub context: Option<ConsensusContext>,
}

impl TempoHeader {
    /// Decodes `rlp([.., .., .., inner_header, context?])`.
    pub fn decode(rlp: &[u8]) -> Result<Self, Error> {
        let outer = list_items(rlp)?;
        if outer.len() != 4 && outer.len() != 5 {
            return Err(Error::MalformedHeader("outer list length"));
        }
        let inner = list_items(outer[3])?;
        if inner.len() <= EXTRA_DATA {
            return Err(Error::MalformedHeader("inner list length"));
        }
        let state_root: [u8; 32] = bytes(inner[STATE_ROOT])?
            .try_into()
            .map_err(|_| Error::MalformedHeader("state root"))?;
        let context = match outer.get(4) {
            Some(ctx) => {
                let ctx = list_items(ctx)?;
                if ctx.len() != 4 {
                    return Err(Error::MalformedHeader("context length"));
                }
                Some(ConsensusContext {
                    epoch: uint(ctx[0])?,
                    view: uint(ctx[1])?,
                    parent_view: uint(ctx[2])?,
                })
            }
            None => None,
        };
        Ok(Self {
            number: uint(inner[NUMBER])?,
            timestamp: uint(inner[TIMESTAMP])?,
            state_root,
            extra_data: bytes(inner[EXTRA_DATA])?.to_vec(),
            context,
        })
    }
}

/// Splits an RLP list into its raw encoded items. The list must span all of `buf`.
fn list_items(mut buf: &[u8]) -> Result<Vec<&[u8]>, Error> {
    let h = Header::decode(&mut buf).map_err(|_| Error::MalformedHeader("rlp"))?;
    if !h.list || h.payload_length != buf.len() {
        return Err(Error::MalformedHeader("expected list"));
    }
    let mut items = Vec::new();
    while !buf.is_empty() {
        let start = buf;
        let item = Header::decode(&mut buf).map_err(|_| Error::MalformedHeader("rlp item"))?;
        if item.payload_length > buf.len() {
            return Err(Error::MalformedHeader("rlp item length"));
        }
        buf = &buf[item.payload_length..];
        items.push(&start[..start.len() - buf.len()]);
    }
    Ok(items)
}

fn bytes(mut item: &[u8]) -> Result<&[u8], Error> {
    Header::decode_bytes(&mut item, false).map_err(|_| Error::MalformedHeader("rlp bytes"))
}

fn uint(mut item: &[u8]) -> Result<u64, Error> {
    u64::decode(&mut item).map_err(|_| Error::MalformedHeader("rlp uint"))
}
