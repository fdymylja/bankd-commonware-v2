import * as _33 from "./applications/transfer/v1/authz";
import * as _34 from "./applications/transfer/v1/denomtrace";
import * as _35 from "./applications/transfer/v1/genesis";
import * as _36 from "./applications/transfer/v1/packet";
import * as _37 from "./applications/transfer/v1/query";
import * as _38 from "./applications/transfer/v1/token";
import * as _39 from "./applications/transfer/v1/transfer";
import * as _40 from "./applications/transfer/v1/tx";
import * as _41 from "./core/channel/v1/channel";
import * as _42 from "./core/channel/v1/genesis";
import * as _43 from "./core/channel/v1/query";
import * as _44 from "./core/channel/v1/tx";
import * as _45 from "./core/client/v1/client";
import * as _91 from "./applications/transfer/v1/tx.amino";
import * as _92 from "./core/channel/v1/tx.amino";
import * as _93 from "./applications/transfer/v1/tx.registry";
import * as _94 from "./core/channel/v1/tx.registry";
import * as _95 from "./applications/transfer/v1/query.rpc.func";
import * as _96 from "./core/channel/v1/query.rpc.func";
import * as _97 from "./applications/transfer/v1/query.rpc.Query";
import * as _98 from "./core/channel/v1/query.rpc.Query";
import * as _99 from "./applications/transfer/v1/tx.rpc.func";
import * as _100 from "./core/channel/v1/tx.rpc.func";
import * as _101 from "./applications/transfer/v1/tx.rpc.msg";
import * as _102 from "./core/channel/v1/tx.rpc.msg";
import * as _121 from "./rpc.query";
import * as _122 from "./rpc.tx";
export namespace ibc {
  export namespace applications {
    export namespace transfer {
      export const v1 = {
        ..._33,
        ..._34,
        ..._35,
        ..._36,
        ..._37,
        ..._38,
        ..._39,
        ..._40,
        ..._91,
        ..._93,
        ..._95,
        ..._97,
        ..._99,
        ..._101
      };
    }
  }
  export namespace core {
    export namespace channel {
      export const v1 = {
        ..._41,
        ..._42,
        ..._43,
        ..._44,
        ..._92,
        ..._94,
        ..._96,
        ..._98,
        ..._100,
        ..._102
      };
    }
    export namespace client {
      export const v1 = {
        ..._45
      };
    }
  }
  export const ClientFactory = {
    ..._121,
    ..._122
  };
}