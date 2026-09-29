use super::{MAX_HEADER_LEN, MAX_PROOF_LEN, TendermintVerifier};
use crate::{Precompile, charge_input_cost, dispatch, view};
use alloy::primitives::Address;
use revm::precompile::PrecompileResult;
use tempo_contracts::precompiles::{ITendermintVerifier, TendermintVerifierError};

// Cheap cap before any ABI decoding. Two headers plus slack for the static words, params and
// path segments. Field level limits are checked after decoding.
const MAX_CALLDATA_LEN: usize = 4 + 2 * MAX_HEADER_LEN + MAX_PROOF_LEN + 64 * 1024;

impl Precompile for TendermintVerifier {
    fn call(&mut self, calldata: &[u8], _msg_sender: Address) -> PrecompileResult {
        if let Some(err) = charge_input_cost(&mut self.storage, calldata) {
            return err;
        }

        if calldata.len() > MAX_CALLDATA_LEN {
            return Ok(self
                .storage
                .abi_revert(TendermintVerifierError::invalid_input()));
        }

        dispatch!(
            calldata,
            |call| match call {
                ITendermintVerifier::ITendermintVerifierCalls {
                    verifyUpdate(call) => view(call, |c| self.verify_update(c)),
                    verifyMembership(call) => view(call, |c| self.verify_membership(c)),
                    checkMisbehaviour(call) => view(call, |c| self.check_misbehaviour(c)),
                }
            }
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        expect_precompile_revert,
        storage::{StorageCtx, hashmap::HashMapStorageProvider},
        tendermint_verifier::{
            MAX_CHAIN_ID_LEN, MAX_PATH_SEGMENT_LEN, MAX_PATH_SEGMENTS, MAX_VALUE_LEN,
        },
        test_util::{assert_full_coverage, check_selector_coverage},
    };
    use alloy::{
        primitives::{B256, Bytes},
        sol_types::{SolCall, SolInterface},
    };
    use tempo_chainspec::hardfork::TempoHardfork;
    use tempo_contracts::precompiles::ITendermintVerifier::{
        ConsensusState, ITendermintVerifierCalls as Calls, Params, checkMisbehaviourCall,
        verifyMembershipCall, verifyUpdateCall,
    };
    use tempo_tendermint_verifier::fixtures;

    fn run<T>(f: impl FnOnce(&mut TendermintVerifier) -> T) -> T {
        let mut storage = HashMapStorageProvider::new_with_spec(1, TempoHardfork::Genesis);
        StorageCtx::enter(&mut storage, || f(&mut TendermintVerifier::new()))
    }

    fn params(u: &fixtures::Update) -> Params {
        Params {
            chainId: u.params.chain_id.clone(),
            trustNumerator: u.params.trust_numerator,
            trustDenominator: u.params.trust_denominator,
            trustingPeriod: u.params.trusting_period_secs,
            unbondingPeriod: u.params.unbonding_period_secs,
            maxClockDrift: u.params.max_clock_drift_secs,
        }
    }

    fn cs(c: &tempo_tendermint_verifier::ConsensusState) -> ConsensusState {
        ConsensusState {
            timestamp: c.timestamp_ns,
            root: c.root.into(),
            nextValidatorsHash: c.next_validators_hash.into(),
        }
    }

    fn update_call(u: &fixtures::Update) -> verifyUpdateCall {
        verifyUpdateCall {
            params: params(u),
            trusted: cs(&u.trusted),
            header: u.header.clone().into(),
            nowSeconds: (u.now_ns / 1_000_000_000) as u64,
        }
    }

    fn call_raw(calldata: Vec<u8>) -> PrecompileResult {
        run(|p| p.call(&calldata, Address::ZERO))
    }

    fn membership_call(
        root: B256,
        m: &fixtures::MembershipMsg,
        value: Vec<u8>,
    ) -> verifyMembershipCall {
        verifyMembershipCall {
            root,
            proof: hex_bytes(&m.proof),
            path: fixtures::path(m).into_iter().map(Bytes::from).collect(),
            value: value.into(),
        }
    }

    fn hex_bytes(s: &str) -> Bytes {
        alloy::hex::decode(s).unwrap().into()
    }

    fn revert_selector(res: PrecompileResult) -> [u8; 4] {
        let out = res.unwrap();
        assert!(out.is_revert(), "expected revert");
        out.bytes[..4].try_into().unwrap()
    }

    fn invalid_input() -> [u8; 4] {
        TendermintVerifierError::invalid_input().selector().into()
    }

    fn verification_failed() -> [u8; 4] {
        TendermintVerifierError::verification_failed()
            .selector()
            .into()
    }

    #[test]
    fn selector_coverage() {
        run(|p| {
            let unsupported = check_selector_coverage(
                p,
                Calls::SELECTORS,
                "ITendermintVerifier",
                Calls::name_by_selector,
            );
            assert_full_coverage([unsupported]);
        });
    }

    #[test]
    fn update_happy_path() {
        let u = fixtures::update();
        let out = call_raw(update_call(&u).abi_encode()).unwrap();
        assert!(!out.is_revert());
        let ret = verifyUpdateCall::abi_decode_returns(&out.bytes).unwrap();
        assert!(ret.newHeight.revisionHeight > ret.trustedHeight.revisionHeight);
        assert!(ret.newConsensusState.timestamp > u.trusted.timestamp_ns);
    }

    #[test]
    fn update_bad_inputs() {
        let u = fixtures::update();

        let mut c = update_call(&u);
        c.params.chainId = "wrong-1".into();
        assert_eq!(
            revert_selector(call_raw(c.abi_encode())),
            verification_failed()
        );

        let mut c = update_call(&u);
        c.nowSeconds += 100 * 24 * 3600;
        assert_eq!(
            revert_selector(call_raw(c.abi_encode())),
            verification_failed()
        );

        let mut c = update_call(&u);
        c.trusted.nextValidatorsHash = B256::repeat_byte(1);
        assert_eq!(
            revert_selector(call_raw(c.abi_encode())),
            verification_failed()
        );

        let mut c = update_call(&u);
        let mut h = c.header.to_vec();
        let mid = h.len() / 2;
        h[mid] ^= 0xff;
        c.header = h.into();
        assert!(revert_selector(call_raw(c.abi_encode())) != [0; 4]);

        let mut c = update_call(&u);
        c.header = Bytes::from(vec![0xff; 100]);
        assert_eq!(revert_selector(call_raw(c.abi_encode())), invalid_input());

        let mut c = update_call(&u);
        c.header = Bytes::new();
        assert_eq!(revert_selector(call_raw(c.abi_encode())), invalid_input());

        let mut c = update_call(&u);
        c.params.trustDenominator = 0;
        assert_eq!(revert_selector(call_raw(c.abi_encode())), invalid_input());

        let mut c = update_call(&u);
        c.params.trustNumerator = 1;
        c.params.trustDenominator = 10;
        assert_eq!(revert_selector(call_raw(c.abi_encode())), invalid_input());

        let mut c = update_call(&u);
        c.params.chainId = "x".repeat(MAX_CHAIN_ID_LEN + 1);
        assert_eq!(revert_selector(call_raw(c.abi_encode())), invalid_input());
    }

    #[test]
    fn update_oversize_inputs() {
        let u = fixtures::update();

        let mut c = update_call(&u);
        c.header = vec![0u8; MAX_HEADER_LEN + 1].into();
        assert_eq!(revert_selector(call_raw(c.abi_encode())), invalid_input());

        // Over the calldata cap, rejected before decoding.
        let mut c = update_call(&u);
        c.header = vec![0u8; MAX_CALLDATA_LEN].into();
        assert_eq!(revert_selector(call_raw(c.abi_encode())), invalid_input());
    }

    #[test]
    fn malformed_calldata() {
        assert!(call_raw(vec![]).map_or(true, |o| !o.is_success()));
        let mut cd = verifyUpdateCall::SELECTOR.to_vec();
        cd.extend_from_slice(&[1, 2, 3]);
        assert!(call_raw(cd).unwrap().is_revert());
        assert!(call_raw(vec![0xde, 0xad, 0xbe, 0xef]).unwrap().is_revert());
    }

    #[test]
    fn membership_and_non_membership() {
        let (cs, m) = fixtures::membership();
        let value = alloy::hex::decode(&m.value).unwrap();
        let root = B256::from(cs.root);
        let ok = |c: verifyMembershipCall| {
            let out = call_raw(c.abi_encode()).unwrap();
            assert!(!out.is_revert());
            verifyMembershipCall::abi_decode_returns(&out.bytes).unwrap()
        };
        assert!(ok(membership_call(root, &m, value.clone())));
        assert!(!ok(membership_call(
            B256::repeat_byte(9),
            &m,
            value.clone()
        )));
        let mut bad = value.clone();
        bad[0] ^= 1;
        assert!(!ok(membership_call(root, &m, bad)));

        let (cs, m) = fixtures::non_membership();
        assert!(ok(membership_call(B256::from(cs.root), &m, vec![])));
        assert!(!ok(membership_call(B256::from(cs.root), &m, vec![1])));
    }

    #[test]
    fn membership_bad_inputs() {
        let (cs, m) = fixtures::membership();
        let value = alloy::hex::decode(&m.value).unwrap();
        let root = B256::from(cs.root);

        let mut c = membership_call(root, &m, value.clone());
        c.proof = Bytes::from(vec![0xff; 40]);
        assert_eq!(revert_selector(call_raw(c.abi_encode())), invalid_input());

        let mut c = membership_call(root, &m, value.clone());
        c.proof = vec![0u8; MAX_PROOF_LEN + 1].into();
        assert_eq!(revert_selector(call_raw(c.abi_encode())), invalid_input());

        let mut c = membership_call(root, &m, value.clone());
        c.path = vec![];
        assert_eq!(revert_selector(call_raw(c.abi_encode())), invalid_input());

        let mut c = membership_call(root, &m, value.clone());
        c.path = vec![Bytes::new(); MAX_PATH_SEGMENTS + 1];
        assert_eq!(revert_selector(call_raw(c.abi_encode())), invalid_input());

        let mut c = membership_call(root, &m, value.clone());
        c.path = vec![vec![0u8; MAX_PATH_SEGMENT_LEN + 1].into()];
        assert_eq!(revert_selector(call_raw(c.abi_encode())), invalid_input());

        let mut c = membership_call(root, &m, value);
        c.value = vec![0u8; MAX_VALUE_LEN + 1].into();
        assert_eq!(revert_selector(call_raw(c.abi_encode())), invalid_input());
    }

    #[test]
    fn misbehaviour() {
        let u = fixtures::update();
        let call = |h1: Bytes, h2: Bytes| checkMisbehaviourCall {
            params: params(&u),
            trusted1: cs(&u.trusted),
            trusted2: cs(&u.trusted),
            header1: h1,
            header2: h2,
            nowSeconds: (u.now_ns / 1_000_000_000) as u64,
        };
        let h: Bytes = u.header.clone().into();

        // Same valid header twice is not misbehaviour.
        let out = call_raw(call(h.clone(), h.clone()).abi_encode()).unwrap();
        let ret = checkMisbehaviourCall::abi_decode_returns(&out.bytes).unwrap();
        assert!(!ret.detected);

        let bad = call(h.clone(), Bytes::from(vec![0xff; 50]));
        assert_eq!(revert_selector(call_raw(bad.abi_encode())), invalid_input());

        let mut wrong_chain = call(h.clone(), h);
        wrong_chain.params.chainId = "wrong-1".into();
        assert_eq!(
            revert_selector(call_raw(wrong_chain.abi_encode())),
            verification_failed()
        );
    }

    #[test]
    fn revert_is_abi_encoded_error() {
        let u = fixtures::update();
        let mut c = update_call(&u);
        c.header = Bytes::new();
        let res = call_raw(c.abi_encode());
        expect_precompile_revert(
            &res,
            tempo_contracts::precompiles::ITendermintVerifier::ITendermintVerifierErrors::InvalidInput(
                tempo_contracts::precompiles::ITendermintVerifier::InvalidInput {},
            ),
        );
    }
}
