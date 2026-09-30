import * as _2 from "./bank/v1beta1/authz";
import * as _3 from "./bank/v1beta1/bank";
import * as _4 from "./bank/v1beta1/genesis";
import * as _5 from "./bank/v1beta1/query";
import * as _6 from "./bank/v1beta1/tx";
import * as _7 from "./base/query/v1beta1/pagination";
import * as _8 from "./base/v1beta1/coin";
import * as _9 from "./evm/erc20/v1/erc20";
import * as _10 from "./evm/erc20/v1/events";
import * as _11 from "./evm/erc20/v1/genesis";
import * as _12 from "./evm/erc20/v1/query";
import * as _13 from "./evm/erc20/v1/tx";
import * as _14 from "./evm/vm/v1/events";
import * as _15 from "./evm/vm/v1/evm";
import * as _16 from "./evm/vm/v1/genesis";
import * as _17 from "./evm/vm/v1/query";
import * as _18 from "./evm/vm/v1/tx";
import * as _19 from "./msg/v1/msg";
import * as _20 from "./query/v1/query";
import * as _21 from "./staking/v1beta1/authz";
import * as _22 from "./staking/v1beta1/genesis";
import * as _23 from "./staking/v1beta1/query";
import * as _24 from "./staking/v1beta1/staking";
import * as _25 from "./staking/v1beta1/tx";
import * as _67 from "./bank/v1beta1/tx.amino";
import * as _68 from "./evm/erc20/v1/tx.amino";
import * as _69 from "./evm/vm/v1/tx.amino";
import * as _70 from "./staking/v1beta1/tx.amino";
import * as _71 from "./bank/v1beta1/tx.registry";
import * as _72 from "./evm/erc20/v1/tx.registry";
import * as _73 from "./evm/vm/v1/tx.registry";
import * as _74 from "./staking/v1beta1/tx.registry";
import * as _75 from "./bank/v1beta1/query.rpc.func";
import * as _76 from "./evm/erc20/v1/query.rpc.func";
import * as _77 from "./evm/vm/v1/query.rpc.func";
import * as _78 from "./staking/v1beta1/query.rpc.func";
import * as _79 from "./bank/v1beta1/query.rpc.Query";
import * as _80 from "./evm/erc20/v1/query.rpc.Query";
import * as _81 from "./evm/vm/v1/query.rpc.Query";
import * as _82 from "./staking/v1beta1/query.rpc.Query";
import * as _83 from "./bank/v1beta1/tx.rpc.func";
import * as _84 from "./evm/erc20/v1/tx.rpc.func";
import * as _85 from "./evm/vm/v1/tx.rpc.func";
import * as _86 from "./staking/v1beta1/tx.rpc.func";
import * as _87 from "./bank/v1beta1/tx.rpc.msg";
import * as _88 from "./evm/erc20/v1/tx.rpc.msg";
import * as _89 from "./evm/vm/v1/tx.rpc.msg";
import * as _90 from "./staking/v1beta1/tx.rpc.msg";
import * as _119 from "./rpc.query";
import * as _120 from "./rpc.tx";
export namespace cosmos {
  export namespace bank {
    export const v1beta1 = {
      ..._2,
      ..._3,
      ..._4,
      ..._5,
      ..._6,
      ..._67,
      ..._71,
      ..._75,
      ..._79,
      ..._83,
      ..._87
    };
  }
  export namespace base {
    export namespace query {
      export const v1beta1 = {
        ..._7
      };
    }
    export const v1beta1 = {
      ..._8
    };
  }
  export namespace evm {
    export namespace erc20 {
      export const v1 = {
        ..._9,
        ..._10,
        ..._11,
        ..._12,
        ..._13,
        ..._68,
        ..._72,
        ..._76,
        ..._80,
        ..._84,
        ..._88
      };
    }
    export namespace vm {
      export const v1 = {
        ..._14,
        ..._15,
        ..._16,
        ..._17,
        ..._18,
        ..._69,
        ..._73,
        ..._77,
        ..._81,
        ..._85,
        ..._89
      };
    }
  }
  export namespace msg {
    export const v1 = {
      ..._19
    };
  }
  export namespace query {
    export const v1 = {
      ..._20
    };
  }
  export namespace staking {
    export const v1beta1 = {
      ..._21,
      ..._22,
      ..._23,
      ..._24,
      ..._25,
      ..._70,
      ..._74,
      ..._78,
      ..._82,
      ..._86,
      ..._90
    };
  }
  export const ClientFactory = {
    ..._119,
    ..._120
  };
}