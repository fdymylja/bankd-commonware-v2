//! Append-only height -> root log next to the shieldd db.
//!
//! cnidarium only keeps recent snapshots in memory, so after a restart the root
//! of an old height is gone. Replayed blocks still need it (reth rewrites the
//! same root slot), so every commit appends it here. Same idea as v1's commit
//! records in `app/shieldd_commit_record.go`.

use std::{
    fs::{File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    path::Path,
};

use alloy_primitives::B256;

const ENTRY: u64 = 40;

#[derive(Debug)]
pub(crate) struct CommitRecords {
    file: File,
    len: u64,
}

impl CommitRecords {
    pub(crate) fn open(path: &Path) -> std::io::Result<Self> {
        let file = OpenOptions::new()
            .read(true)
            .append(true)
            .create(true)
            .open(path)?;
        // A torn trailing entry from a crash mid write is dropped.
        let len = file.metadata()?.len() / ENTRY;
        file.set_len(len * ENTRY)?;
        Ok(Self { file, len })
    }

    /// Number of heights recorded, heights are contiguous from 0.
    pub(crate) fn len(&self) -> u64 {
        self.len
    }

    /// Appends `height`, which must be the next one. Re-appending the last
    /// height is a no-op so a retried commit stays idempotent.
    pub(crate) fn append(&mut self, height: u64, root: B256) -> std::io::Result<()> {
        if height + 1 == self.len {
            return Ok(());
        }
        if height != self.len {
            return Err(std::io::Error::other(format!(
                "commit record gap: have {} heights, got {height}",
                self.len
            )));
        }
        let mut buf = [0u8; ENTRY as usize];
        buf[..8].copy_from_slice(&height.to_be_bytes());
        buf[8..].copy_from_slice(root.as_slice());
        self.file.write_all(&buf)?;
        self.file.sync_data()?;
        self.len += 1;
        Ok(())
    }

    pub(crate) fn get(&mut self, height: u64) -> std::io::Result<Option<B256>> {
        if height >= self.len {
            return Ok(None);
        }
        let mut buf = [0u8; ENTRY as usize];
        self.file.seek(SeekFrom::Start(height * ENTRY))?;
        self.file.read_exact(&mut buf)?;
        let stored = u64::from_be_bytes(buf[..8].try_into().expect("8 bytes"));
        if stored != height {
            return Err(std::io::Error::other(format!(
                "commit record {height} holds height {stored}"
            )));
        }
        Ok(Some(B256::from_slice(&buf[8..])))
    }
}
