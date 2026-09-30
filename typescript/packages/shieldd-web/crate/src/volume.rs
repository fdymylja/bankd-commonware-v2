use anyhow::{ensure, Result};
use decaf377::Fq;
use serde::{Deserialize, Serialize};
use shieldd_keys::FullViewingKey;
use shieldd_sct::Nullifier;
use shieldd_shielded_pool::{
    accumulated_volume, select_accumulator_day, ActionWitness, VolumeAccumulatorPayload,
    VolumeAccumulatorPlan, VolumeAccumulatorState, VOLUME_ACCUMULATOR_RETENTION_SECS,
};
use shieldd_tct::{Position, StateCommitment};

#[derive(Serialize, Deserialize)]
#[serde(remote = "VolumeAccumulatorState")]
struct StoredVolume {
    #[serde(with = "field_bytes")]
    subject: Fq,
    day_start: u64,
    undisclosed_volume: u128,
    #[serde(with = "field_bytes")]
    blinding: Fq,
}

mod field_bytes {
    use super::*;
    pub fn serialize<S: serde::Serializer>(field: &Fq, serializer: S) -> Result<S::Ok, S::Error> {
        field.to_bytes().serialize(serializer)
    }
    pub fn deserialize<'de, D: serde::Deserializer<'de>>(deserializer: D) -> Result<Fq, D::Error> {
        let bytes = <[u8; 32]>::deserialize(deserializer)?;
        Fq::from_bytes_checked(&bytes).map_err(serde::de::Error::custom)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConfirmedVolume {
    #[serde(with = "StoredVolume")]
    pub state: VolumeAccumulatorState,
    pub commitment: StateCommitment,
    pub position: Position,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SeenVolume {
    day: u64,
    nullifier: Nullifier,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct VolumeJournal {
    pub height: Option<u64>,
    pub complete: bool,
    seen: Vec<SeenVolume>,
    tips: Vec<ConfirmedVolume>,
}

impl VolumeJournal {
    pub fn begin_block(&mut self, height: u64, skipped: bool) -> Result<()> {
        if self.height == Some(height) {
            return Ok(());
        }
        if height == 0 {
            self.complete = !skipped;
        } else if self.height.and_then(|h| h.checked_add(1)) != Some(height) || skipped {
            self.complete = false;
        }
        ensure!(
            self.height.is_none_or(|previous| height >= previous),
            "volume scan moved backwards"
        );
        self.height = Some(height);
        Ok(())
    }

    pub fn observe(&mut self, payload: &VolumeAccumulatorPayload) {
        if !self
            .seen
            .iter()
            .any(|entry| entry.day == payload.day_start && entry.nullifier == payload.nullifier)
        {
            self.seen.push(SeenVolume {
                day: payload.day_start,
                nullifier: payload.nullifier,
            });
        }
        let oldest = payload
            .day_start
            .saturating_sub(VOLUME_ACCUMULATOR_RETENTION_SECS);
        self.seen.retain(|entry| entry.day >= oldest);
        self.tips.retain(|entry| entry.state.day_start >= oldest);
    }

    pub fn confirm(
        &mut self,
        state: VolumeAccumulatorState,
        commitment: StateCommitment,
        position: Position,
    ) -> Result<()> {
        ensure!(
            state.commitment() == commitment,
            "volume state does not match commitment"
        );
        if let Some(old) = self.tips.iter_mut().find(|entry| {
            entry.state.subject == state.subject && entry.state.day_start == state.day_start
        }) {
            if old.position < position {
                *old = ConfirmedVolume {
                    state,
                    commitment,
                    position,
                };
            }
        } else {
            self.tips.push(ConfirmedVolume {
                state,
                commitment,
                position,
            });
        }
        Ok(())
    }

    pub fn plan(
        &self,
        witness: &ActionWitness,
        fvk: &FullViewingKey,
        timestamp: u64,
        amount: u128,
        eligible: bool,
    ) -> Result<VolumeAccumulatorPlan> {
        let padding = VolumeAccumulatorPlan::padding(timestamp);
        if !eligible || !witness.asset.is_regulated || !self.complete {
            return Ok(padding);
        }
        let limit = witness
            .policy
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("regulated action missing policy"))?
            .params
            .daily_volume_limit;
        let subject =
            VolumeAccumulatorState::subject(&witness.sender.leaf.address, witness.asset.asset_id);
        let day_start = select_accumulator_day(timestamp);
        let spent = |nullifier| {
            self.seen
                .iter()
                .any(|entry| entry.day == day_start && entry.nullifier == nullifier)
        };
        let blinding = Fq::rand(&mut rand_core::OsRng);
        if let Some(tip) = self
            .tips
            .iter()
            .find(|tip| tip.state.subject == subject && tip.state.day_start == day_start)
        {
            ensure!(
                tip.state.commitment() == tip.commitment,
                "stored volume commitment mismatch"
            );
            if spent(Nullifier::derive(
                fvk.nullifier_key(),
                tip.position,
                &tip.commitment,
            )) {
                return Ok(padding);
            }
            match accumulated_volume(tip.state.undisclosed_volume, amount, limit) {
                Some(volume) => VolumeAccumulatorPlan::continuation(
                    tip.state.clone(),
                    tip.commitment,
                    u64::from(tip.position),
                    volume,
                    blinding,
                ),
                None => Ok(padding),
            }
        } else {
            let mut state = VolumeAccumulatorState {
                subject,
                day_start,
                undisclosed_volume: 0,
                blinding,
            };
            if spent(state.origin_nullifier(fvk.nullifier_key())) {
                return Ok(padding);
            }
            match accumulated_volume(0, amount, limit) {
                Some(volume) => {
                    state.undisclosed_volume = volume;
                    Ok(VolumeAccumulatorPlan::origin(state))
                }
                None => Ok(padding),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use shieldd_compliance::{AssetPolicy, ComplianceLeaf, IndexedLeaf, MerklePath};
    use shieldd_shielded_pool::{AssetWitness, TransferProofContext, UserWitness};

    fn audit_keys() -> shieldd_compliance::AuditKeys {
        shieldd_compliance::AuditKeys {
            epoch: 1,
            amount: decaf377::Element::GENERATOR * decaf377::Fr::from(201u64),
            sender: decaf377::Element::GENERATOR * decaf377::Fr::from(202u64),
            receiver: decaf377::Element::GENERATOR * decaf377::Fr::from(203u64),
            checking: decaf377::Element::GENERATOR * decaf377::Fr::from(204u64),
        }
    }

    fn witness() -> (FullViewingKey, ActionWitness) {
        let fvk = shieldd_keys::test_keys::FULL_VIEWING_KEY.clone();
        let address = fvk.payment_address(0u32.into());
        let asset_id = shieldd_asset::asset::Id(Fq::from(77u64));
        let ring_pk = decaf377::Element::GENERATOR;
        let rnk_dh_pk = *address.diversified_generator();
        let rnk = shieldd_compliance::derive_regulated_nullifier_key(
            fvk.incoming(),
            &address,
            asset_id,
            ring_pk,
            rnk_dh_pk,
        )
        .unwrap();
        let leaf = ComplianceLeaf::registered_from_rnk(address, asset_id, ring_pk, rnk_dh_pk, rnk)
            .unwrap();
        let policy = AssetPolicy::new(
            ring_pk,
            100,
            vec![],
            None,
            "ring".into(),
            ring_pk,
            "policy".into(),
            "read".into(),
            "document".into(),
            audit_keys(),
        );
        let indexed = IndexedLeaf::from_policy(asset_id.0, 0, Fq::from(0u64), &policy);
        (
            fvk,
            ActionWitness {
                asset: AssetWitness {
                    asset_id,
                    root: indexed.commit(),
                    leaf: indexed,
                    position: 0,
                    path: MerklePath::default(),
                    is_regulated: true,
                },
                user_root: StateCommitment(Fq::from(0u64)),
                sender: UserWitness {
                    leaf,
                    position: 0,
                    path: MerklePath::default(),
                },
                policy: Some(policy),
            },
        )
    }

    #[test]
    fn recovered_volume_continues_and_incomplete_recovery_discloses() {
        let (fvk, witness) = witness();
        let timestamp = 86_400;
        let mut journal = VolumeJournal::default();
        assert!(!journal
            .plan(&witness, &fvk, timestamp, 20, true)
            .unwrap()
            .is_real());
        journal.begin_block(0, false).unwrap();
        let origin = journal.plan(&witness, &fvk, timestamp, 20, true).unwrap();
        assert!(origin.starts_new_day());
        let payload = origin.selected_payload(
            fvk.nullifier_key(),
            fvk.outgoing(),
            Fq::from(1u64),
            TransferProofContext::Ordinary,
        );
        journal.observe(&payload);
        assert!(!journal
            .plan(&witness, &fvk, timestamp, 30, true)
            .unwrap()
            .is_real());
        let (state, real) = payload.trial_decrypt(fvk.outgoing()).unwrap();
        assert!(real);
        journal
            .confirm(state, payload.commitment, Position::from(5u64))
            .unwrap();
        let encoded = serde_json::to_vec(&journal).unwrap();
        let journal_copy: VolumeJournal = serde_json::from_slice(&encoded).unwrap();
        assert_eq!(journal_copy.tips[0].state, journal.tips[0].state);
        let continuation = journal.plan(&witness, &fvk, timestamp, 30, true).unwrap();
        assert_eq!(
            continuation.successor_state().unwrap().undisclosed_volume,
            50
        );
        assert!(!continuation.starts_new_day());
        assert!(!journal
            .plan(&witness, &fvk, timestamp, 81, true)
            .unwrap()
            .is_real());
        assert!(!journal
            .plan(&witness, &fvk, timestamp, 1, false)
            .unwrap()
            .is_real());
        journal.observe(&continuation.selected_payload(
            fvk.nullifier_key(),
            fvk.outgoing(),
            Fq::from(2u64),
            TransferProofContext::Ordinary,
        ));
        assert!(!journal
            .plan(&witness, &fvk, timestamp, 1, true)
            .unwrap()
            .is_real());
        journal.begin_block(2, false).unwrap();
        assert!(!journal.complete);
        assert!(!journal
            .plan(&witness, &fvk, timestamp * 2, 1, true)
            .unwrap()
            .is_real());
        assert!(journal.begin_block(1, false).is_err());
    }

    #[test]
    fn scan_skips_and_expired_days_do_not_enable_a_second_origin() {
        let (fvk, witness) = witness();
        let mut journal = VolumeJournal::default();
        journal.begin_block(0, true).unwrap();
        journal.begin_block(1, false).unwrap();
        assert!(!journal.complete);
        let state = VolumeAccumulatorState {
            subject: Fq::from(1u64),
            day_start: 0,
            undisclosed_volume: 1,
            blinding: Fq::from(2u64),
        };
        assert!(journal
            .confirm(
                state.clone(),
                StateCommitment(Fq::from(0u64)),
                Position::from(0u64)
            )
            .is_err());
        journal
            .confirm(state.clone(), state.commitment(), Position::from(0u64))
            .unwrap();
        let mut payload = VolumeAccumulatorPayload::canonical_fee_funding();
        payload.day_start = VOLUME_ACCUMULATOR_RETENTION_SECS + 86_400;
        journal.observe(&payload);
        journal.observe(&payload);
        assert!(journal.tips.is_empty());
        assert_eq!(journal.seen.len(), 1);
        assert!(!journal
            .plan(&witness, &fvk, payload.day_start, 1, true)
            .unwrap()
            .is_real());
    }
}
