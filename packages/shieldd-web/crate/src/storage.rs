#[allow(unused_imports)]
use std::future::IntoFuture;

use indexed_db_futures::IdbDatabase;
use serde::{Deserialize, Serialize};
use shieldd_asset::asset::{Id, Metadata};
use shieldd_fee::GasPrices;
use shieldd_keys::keys::AddressIndex;
use shieldd_num::Amount;
use shieldd_proto::{
    core::{app::v1::AppParameters, component::sct::v1::Epoch},
    view::v1::{NotesRequest, TransactionInfo},
    DomainType,
};
use shieldd_sct::{nullifier_generation::NullifierWindow, Nullifier};
use shieldd_shielded_pool::{discovery, note, Note};

use crate::database::indexed_db::open_idb_database;
use crate::database::interface::Database;
use crate::error::WasmResult;
use crate::note_record::SpendableNoteRecord;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DbConstants {
    pub name: String,
    pub version: u32,
    pub tables: Tables,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Tables {
    pub assets: String,
    pub advice_notes: String,
    pub spendable_notes: String,
    pub swaps: String,
    pub fmd_parameters: String,
    pub app_parameters: String,
    pub gas_prices: String,
    pub epochs: String,
    pub transactions: String,
    pub full_sync_height: String,
    pub auctions: String,
    pub auction_outstanding_reserves: String,
    pub tree_commitments: String,
    pub tree_hashes: String,
    pub tree_last_position: String,
    pub tree_last_forgotten: String,
}

pub async fn init_idb_storage(constants: DbConstants) -> WasmResult<Storage<IdbDatabase>> {
    let db = open_idb_database(&constants).await?;
    Storage::new(db, constants.tables)
}

pub struct Storage<Db: Database> {
    db: Db,
    tables: Tables,
}

impl<Db: Database + Clone> Clone for Storage<Db> {
    fn clone(&self) -> Self {
        Self {
            db: self.db.clone(),
            tables: self.tables.clone(),
        }
    }
}

impl<Db: Database> Storage<Db> {
    pub fn new(db: Db, tables: Tables) -> WasmResult<Self> {
        Ok(Storage { db, tables })
    }

    pub async fn volume_journal(&self) -> WasmResult<crate::volume::VolumeJournal> {
        Ok(self
            .db
            .get(&self.tables.app_parameters, "volume_journal")
            .await?
            .unwrap_or_default())
    }
    pub async fn set_volume_journal(
        &self,
        journal: &crate::volume::VolumeJournal,
    ) -> WasmResult<()> {
        self.db
            .put_with_key(&self.tables.app_parameters, "volume_journal", journal)
            .await
    }
    pub async fn volume_plan(
        &self,
        witness: &shieldd_shielded_pool::ActionWitness,
        fvk: &shieldd_keys::FullViewingKey,
        timestamp: u64,
        amount: u128,
        eligible: bool,
    ) -> WasmResult<shieldd_shielded_pool::VolumeAccumulatorPlan> {
        Ok(self
            .volume_journal()
            .await?
            .plan(witness, fvk, timestamp, amount, eligible)?)
    }
    pub async fn store_compliance(
        &self,
        block: &shieldd_compact_block::CompactBlock,
    ) -> WasmResult<()> {
        for event in block
            .compliance_asset_registrations
            .iter()
            .filter(|event| event.is_regulated)
        {
            self.db
                .put_with_key(
                    &self.tables.app_parameters,
                    format!("compliance_policy/{}", event.asset_id),
                    &shieldd_proto::core::component::compliance::v1::AssetPolicy::from(
                        event.asset_policy.clone(),
                    ),
                )
                .await?;
        }
        for leaf in block
            .compliance_user_registrations
            .iter()
            .map(|event| &event.leaf)
            .chain(
                block
                    .compliance_user_status_changes
                    .iter()
                    .map(|event| &event.leaf),
            )
        {
            self.db
                .put_with_key(
                    &self.tables.app_parameters,
                    format!("compliance_leaf/{}/{}", leaf.asset_id, leaf.address),
                    leaf,
                )
                .await?;
        }
        Ok(())
    }
    pub async fn note_nullifier_key(
        &self,
        fvk: &shieldd_keys::FullViewingKey,
        note: &Note,
    ) -> WasmResult<shieldd_keys::keys::NullifierKey> {
        let policy: Option<shieldd_proto::core::component::compliance::v1::AssetPolicy> = self
            .db
            .get(
                &self.tables.app_parameters,
                format!("compliance_policy/{}", note.asset_id()),
            )
            .await?;
        let Some(policy) = policy else {
            return Ok(*fvk.nullifier_key());
        };
        let policy = shieldd_compliance::AssetPolicy::try_from(policy)?;
        let leaf: shieldd_compliance::ComplianceLeaf = self
            .db
            .get(
                &self.tables.app_parameters,
                format!("compliance_leaf/{}/{}", note.asset_id(), note.address()),
            )
            .await?
            .ok_or_else(|| anyhow::anyhow!("regulated note missing its compliance leaf"))?;
        Ok(shieldd_compliance::effective_nullifier_key(
            *fvk.nullifier_key(),
            fvk.incoming(),
            &note.address(),
            note.asset_id(),
            policy.ring.ring_pk,
            leaf.rnk_dh_pk,
            true,
        )?)
    }

    pub fn get_database(&self) -> *const Db {
        &self.db
    }

    pub async fn get_notes(&self, request: NotesRequest) -> WasmResult<Vec<SpendableNoteRecord>> {
        let asset_id: Option<Id> = request.asset_id.map(TryInto::try_into).transpose()?;
        let address_index: Option<AddressIndex> =
            request.address_index.map(TryInto::try_into).transpose()?;
        let amount_to_spend: Option<Amount> =
            request.amount_to_spend.map(TryInto::try_into).transpose()?;

        if let (None, Some(_)) = (asset_id, amount_to_spend) {
            return Err(
                anyhow::anyhow!("specified amount_to_spend without asset_id filter").into(),
            );
        }

        let mut filtered_records = Vec::new();
        let mut total = Amount::zero();

        let all_records = self
            .db
            .get_all::<SpendableNoteRecord>(&self.tables.spendable_notes)
            .await?;

        for record in all_records {
            if !request.include_spent && record.height_spent.is_some() {
                continue;
            }

            if let Some(id) = asset_id {
                if record.note.asset_id() != id {
                    continue;
                }
            }

            // Planner should omit the address index randomizer and compare only the account index
            if let Some(ai) = address_index {
                if record.address_index.account != ai.account {
                    continue;
                }
            }

            total += record.note.amount();
            filtered_records.push(record);

            if let Some(amount_to_spend) = amount_to_spend {
                if total >= amount_to_spend {
                    break;
                }
            }
        }

        Ok(filtered_records)
    }

    pub async fn get_asset(&self, id: &Id) -> WasmResult<Option<Metadata>> {
        let key = byte_array_to_base64(&id.to_proto().inner);
        let result: Option<Metadata> = self.db.get(&self.tables.assets, key).await?;
        Ok(result)
    }

    pub async fn add_asset(&self, metadata: &Metadata) -> WasmResult<()> {
        self.db.put(&self.tables.assets, metadata).await?;
        Ok(())
    }

    pub async fn get_full_sync_height(&self) -> WasmResult<Option<u64>> {
        let result = self.db.get(&self.tables.full_sync_height, "height").await?;
        Ok(result)
    }

    pub async fn get_note(
        &self,
        commitment: &note::StateCommitment,
    ) -> WasmResult<Option<SpendableNoteRecord>> {
        let key = byte_array_to_base64(&commitment.to_proto().inner);
        let result = self.db.get(&self.tables.spendable_notes, key).await?;
        Ok(result)
    }

    pub async fn get_note_by_nullifier(
        &self,
        nullifier: &Nullifier,
    ) -> WasmResult<Option<SpendableNoteRecord>> {
        let key = byte_array_to_base64(&nullifier.to_proto().inner);
        let result = self
            .db
            .get_with_index(&self.tables.spendable_notes, key, "nullifier")
            .await?;
        Ok(result)
    }

    pub async fn store_advice(&self, note: Note) -> WasmResult<()> {
        let key = byte_array_to_base64(&note.commit().to_proto().inner);
        self.db
            .put_with_key(&self.tables.advice_notes, key, &note)
            .await?;
        Ok(())
    }

    pub async fn read_advice(&self, commitment: note::StateCommitment) -> WasmResult<Option<Note>> {
        let key = byte_array_to_base64(&commitment.to_proto().inner);
        let result = self.db.get(&self.tables.advice_notes, key).await?;
        Ok(result)
    }

    pub async fn get_app_params(&self) -> WasmResult<Option<AppParameters>> {
        let result = self.db.get(&self.tables.app_parameters, "params").await?;
        Ok(result)
    }

    pub async fn get_nullifier_window(&self) -> WasmResult<Option<NullifierWindow>> {
        let result = self
            .db
            .get(&self.tables.app_parameters, "nullifier_window")
            .await?;
        Ok(result)
    }

    pub async fn set_nullifier_window(&self, window: &NullifierWindow) -> WasmResult<()> {
        self.db
            .put_with_key(&self.tables.app_parameters, "nullifier_window", window)
            .await
    }

    pub async fn get_discovery_parameters(&self) -> WasmResult<Option<discovery::Parameters>> {
        let result = self
            .db
            .get(&self.tables.app_parameters, "discovery_parameters")
            .await?;
        Ok(result)
    }

    pub async fn set_discovery_parameters(
        &self,
        parameters: &discovery::Parameters,
    ) -> WasmResult<()> {
        self.db
            .put_with_key(
                &self.tables.app_parameters,
                "discovery_parameters",
                parameters,
            )
            .await
    }

    pub async fn get_gas_prices_by_asset_id(&self, asset_id: &Id) -> WasmResult<Option<GasPrices>> {
        let key = byte_array_to_base64(&asset_id.to_proto().inner);
        let result = self.db.get(&self.tables.gas_prices, key).await?;
        Ok(result)
    }

    pub async fn get_latest_known_epoch(&self) -> WasmResult<Option<Epoch>> {
        let result = self.db.get_latest(&self.tables.epochs).await?;
        Ok(result)
    }

    pub async fn get_transaction_infos(&self) -> WasmResult<Vec<TransactionInfo>> {
        let all_txs = self
            .db
            .get_all::<TransactionInfo>(&self.tables.transactions)
            .await?;
        Ok(all_txs)
    }
}

pub fn byte_array_to_base64(byte_array: &Vec<u8>) -> String {
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, byte_array)
}
