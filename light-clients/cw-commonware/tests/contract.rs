//! Drives the 08-wasm entry points with the `lc.json` fixture, the way ibc-go would.

use cosmwasm_std::{
    from_json,
    testing::{message_info, mock_dependencies, mock_env, MockApi},
    to_json_vec, Binary, OwnedDeps, Storage,
};
use cw_commonware::{
    contract::{instantiate, query, sudo},
    membership::account_from_proof,
    msg::*,
    state,
    types::{ClientState, ConsensusState, EpochKey, Header, MembershipProof},
    Error,
};
use serde_json::{json, Value};

const FIXTURE: &str = include_str!("../../../contracts/test/fixtures/lc.json");

type Deps = OwnedDeps<cosmwasm_std::MemoryStorage, MockApi, cosmwasm_std::testing::MockQuerier>;

fn fx() -> Value {
    serde_json::from_str(FIXTURE).unwrap()
}

fn s(v: &Value) -> &str {
    v.as_str().unwrap()
}

fn setup() -> (Deps, Value) {
    let f = fx();
    let mut deps = mock_dependencies();
    let cs = json!({
        "router": f["router"],
        "namespace": f["namespace"],
        "epoch_length": f["epochLength"].as_u64().or_else(|| s(&f["epochLength"]).parse().ok()),
        "latest_height": 0,
        "keys": [{"epoch": 0, "key": f["epoch0KeyCompressed"]}],
    });
    let consensus = json!({"timestamp": 0, "state_root": format!("0x{}", "00".repeat(32))});
    let info = message_info(&deps.api.addr_make("ibc"), &[]);
    instantiate(
        deps.as_mut(),
        mock_env(),
        info,
        InstantiateMsg {
            client_state: to_json_vec(&cs).unwrap().into(),
            consensus_state: to_json_vec(&consensus).unwrap().into(),
            checksum: Binary::from(vec![7u8; 32]),
        },
    )
    .unwrap();
    (deps, f)
}

fn header_msg(f: &Value, i: usize) -> ClientMessageMsg {
    let u = &f["updates"][i];
    let h = Header {
        header_rlp: s(&u["headerRlp"]).parse().unwrap(),
        certificate: s(&u["tempoCertificate"]).parse().unwrap(),
    };
    ClientMessageMsg {
        client_message: serde_json::to_vec(&h).unwrap().into(),
    }
}

fn update(deps: &mut Deps, f: &Value, i: usize) -> Result<UpdateStateResult, Error> {
    let m = header_msg(f, i);
    query(
        deps.as_ref(),
        mock_env(),
        QueryMsg::VerifyClientMessage(m.clone()),
    )?;
    let res = sudo(deps.as_mut(), mock_env(), SudoMsg::UpdateState(m))?;
    Ok(from_json(res.data.unwrap()).unwrap())
}

fn proof(f: &Value, storage: &str) -> Binary {
    let account_proof: Vec<alloy_primitives::Bytes> = f["accountProof"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| s(p).parse().unwrap())
        .collect();
    let p = MembershipProof {
        account: account_from_proof(&account_proof).unwrap(),
        account_proof,
        storage_proof: f[storage]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| s(p).parse().unwrap())
            .collect(),
    };
    serde_json::to_vec(&p).unwrap().into()
}

fn height(h: u64) -> Height {
    Height {
        revision_number: 0,
        revision_height: h,
    }
}

fn path(f: &Value, key: &str) -> MerklePath {
    let p = hex::decode(s(&f[key]).trim_start_matches("0x")).unwrap();
    MerklePath {
        key_path: vec![p.into()],
    }
}

fn membership(f: &Value, value: Binary) -> SudoMsg {
    SudoMsg::VerifyMembership(VerifyMembershipMsg {
        height: height(3),
        delay_time_period: 0,
        delay_block_period: 0,
        proof: proof(f, "storageProof"),
        merkle_path: path(f, "commitmentPath"),
        value,
    })
}

#[test]
fn updates_rotate_and_store_consensus() {
    let (mut deps, f) = setup();
    for (i, want) in [3u64, 9, 12].into_iter().enumerate() {
        let res = update(&mut deps, &f, i).unwrap();
        assert_eq!(res.heights, vec![height(want)]);
        let cs = state::consensus_state(&deps.storage, want)
            .unwrap()
            .unwrap();
        assert_eq!(
            format!("{:?}", cs.state_root),
            s(&f["updates"][i]["stateRoot"])
        );
    }
    let cs: ClientState = state::client_state(&deps.storage).unwrap();
    assert_eq!(cs.latest_height, 12);
    // Epoch 0's key got pruned once the client moved into epoch 1.
    let key1: EpochKey =
        serde_json::from_value(json!({"epoch": 1, "key": f["epoch1KeyCompressed"]})).unwrap();
    assert_eq!(cs.keys, vec![key1]);

    // Replaying an update is a no-op, and not misbehaviour.
    assert_eq!(update(&mut deps, &f, 2).unwrap().heights, vec![height(12)]);
    let r: CheckForMisbehaviourResult = from_json(
        query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::CheckForMisbehaviour(header_msg(&f, 2)),
        )
        .unwrap(),
    )
    .unwrap();
    assert!(!r.found_misbehaviour);

    // Epoch 0 headers are stale now.
    assert!(matches!(
        update(&mut deps, &f, 0),
        Err(Error::StaleEpoch { .. })
    ));
}

#[test]
fn update_needs_the_boundary_first() {
    let (mut deps, f) = setup();
    assert_eq!(
        update(&mut deps, &f, 2).unwrap_err(),
        Error::UnknownEpoch(1)
    );
}

#[test]
fn membership_and_non_membership() {
    let (mut deps, f) = setup();
    update(&mut deps, &f, 0).unwrap();

    let value = hex::decode(s(&f["commitment"]).trim_start_matches("0x")).unwrap();
    sudo(
        deps.as_mut(),
        mock_env(),
        membership(&f, value.clone().into()),
    )
    .unwrap();

    let err = sudo(
        deps.as_mut(),
        mock_env(),
        membership(&f, vec![1u8; 32].into()),
    )
    .unwrap_err();
    assert!(matches!(err, Error::InvalidProof(_)), "{err}");

    sudo(
        deps.as_mut(),
        mock_env(),
        SudoMsg::VerifyNonMembership(VerifyNonMembershipMsg {
            height: height(3),
            delay_time_period: 0,
            delay_block_period: 0,
            proof: proof(&f, "absentStorageProof"),
            merkle_path: path(&f, "absentPath"),
        }),
    )
    .unwrap();

    // The present commitment can't be passed off as absent.
    let err = sudo(
        deps.as_mut(),
        mock_env(),
        SudoMsg::VerifyNonMembership(VerifyNonMembershipMsg {
            height: height(3),
            delay_time_period: 0,
            delay_block_period: 0,
            proof: proof(&f, "storageProof"),
            merkle_path: path(&f, "commitmentPath"),
        }),
    )
    .unwrap_err();
    assert!(matches!(err, Error::InvalidProof(_)), "{err}");

    // Unknown height.
    let mut m = membership(&f, value.into());
    if let SudoMsg::VerifyMembership(ref mut v) = m {
        v.height = height(4);
    }
    assert_eq!(
        sudo(deps.as_mut(), mock_env(), m).unwrap_err(),
        Error::ConsensusStateNotFound(4)
    );
}

#[test]
fn queries_and_freeze() {
    let (mut deps, f) = setup();
    update(&mut deps, &f, 0).unwrap();

    let ts: TimestampAtHeightResult = from_json(
        query(
            deps.as_ref(),
            mock_env(),
            QueryMsg::TimestampAtHeight(TimestampAtHeightMsg { height: height(3) }),
        )
        .unwrap(),
    )
    .unwrap();
    let t = &f["updates"][0]["timestamp"];
    let want = t.as_u64().unwrap_or_else(|| s(t).parse().unwrap());
    assert_eq!(ts.timestamp, want * 1_000_000_000);

    let status = |deps: &Deps| -> String {
        let r: StatusResult =
            from_json(query(deps.as_ref(), mock_env(), QueryMsg::Status(StatusMsg {})).unwrap())
                .unwrap();
        r.status
    };
    assert_eq!(status(&deps), "Active");
    sudo(
        deps.as_mut(),
        mock_env(),
        SudoMsg::UpdateStateOnMisbehaviour(header_msg(&f, 1)),
    )
    .unwrap();
    assert_eq!(status(&deps), "Frozen");
    assert_eq!(update(&mut deps, &f, 1).unwrap_err(), Error::Frozen);
}

#[test]
fn stores_ibc_go_layout() {
    let (deps, _) = setup();
    // ibc-go reads these keys itself, so the Any type urls have to be exact.
    let raw = deps.storage.get(state::CLIENT_STATE_KEY).unwrap();
    let any = <state::Any as prost::Message>::decode(raw.as_slice()).unwrap();
    assert_eq!(any.type_url, "/ibc.lightclients.wasm.v1.ClientState");
    let wasm = <state::WasmClientState as prost::Message>::decode(any.value.as_slice()).unwrap();
    assert_eq!(wasm.checksum, vec![7u8; 32]);
    assert_eq!(wasm.latest_height.unwrap().revision_height, 0);
    let raw = deps.storage.get(&state::consensus_key(0)).unwrap();
    let any = <state::Any as prost::Message>::decode(raw.as_slice()).unwrap();
    assert_eq!(any.type_url, "/ibc.lightclients.wasm.v1.ConsensusState");
    let _: ConsensusState = state::consensus_state(&deps.storage, 0).unwrap().unwrap();
}
