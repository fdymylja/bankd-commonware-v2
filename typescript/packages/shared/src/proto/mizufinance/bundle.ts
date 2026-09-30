import * as _46 from "./eem/v1/genesis";
import * as _47 from "./eem/v1/params";
import * as _48 from "./eem/v1/query";
import * as _49 from "./eem/v1/tx";
import * as _50 from "./eem/v1/types";
import * as _51 from "./native/v1/genesis";
import * as _52 from "./native/v1/query";
import * as _53 from "./native/v1/tx";
import * as _54 from "./poa/v1/genesis";
import * as _55 from "./poa/v1/params";
import * as _56 from "./poa/v1/query";
import * as _57 from "./poa/v1/tx";
import * as _58 from "./unwrap/v1/genesis";
import * as _59 from "./unwrap/v1/query";
import * as _103 from "./native/v1/tx.amino";
import * as _104 from "./poa/v1/tx.amino";
import * as _105 from "./native/v1/tx.registry";
import * as _106 from "./poa/v1/tx.registry";
import * as _107 from "./eem/v1/query.rpc.func";
import * as _108 from "./native/v1/query.rpc.func";
import * as _109 from "./poa/v1/query.rpc.func";
import * as _110 from "./unwrap/v1/query.rpc.func";
import * as _111 from "./eem/v1/query.rpc.Query";
import * as _112 from "./native/v1/query.rpc.Query";
import * as _113 from "./poa/v1/query.rpc.Query";
import * as _114 from "./unwrap/v1/query.rpc.Query";
import * as _115 from "./native/v1/tx.rpc.func";
import * as _116 from "./poa/v1/tx.rpc.func";
import * as _117 from "./native/v1/tx.rpc.msg";
import * as _118 from "./poa/v1/tx.rpc.msg";
import * as _123 from "./rpc.query";
import * as _124 from "./rpc.tx";
export namespace mizufinance {
  export namespace eem {
    export const v1 = {
      ..._46,
      ..._47,
      ..._48,
      ..._49,
      ..._50,
      ..._107,
      ..._111
    };
  }
  export namespace native {
    export const v1 = {
      ..._51,
      ..._52,
      ..._53,
      ..._103,
      ..._105,
      ..._108,
      ..._112,
      ..._115,
      ..._117
    };
  }
  export namespace poa {
    export const v1 = {
      ..._54,
      ..._55,
      ..._56,
      ..._57,
      ..._104,
      ..._106,
      ..._109,
      ..._113,
      ..._116,
      ..._118
    };
  }
  export namespace unwrap {
    export const v1 = {
      ..._58,
      ..._59,
      ..._110,
      ..._114
    };
  }
  export const ClientFactory = {
    ..._123,
    ..._124
  };
}