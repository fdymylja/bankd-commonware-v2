use shieldd_proto::DomainType;
use shieldd_sct::epoch::Epoch;
use shieldd_wasm::tree::sct_position;

#[test]
fn gets_position() {
    let epoch = Epoch {
        index: 56,
        start_height: 1385719,
    };
    let position = sct_position(1386375, &epoch.encode_to_vec()).unwrap();
    assert_eq!(position, 240561160192);
}
