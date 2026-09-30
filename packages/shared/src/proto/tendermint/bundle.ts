import * as _60 from "./abci/types";
import * as _61 from "./crypto/keys";
import * as _62 from "./crypto/proof";
import * as _63 from "./types/params";
import * as _64 from "./types/types";
import * as _65 from "./types/validator";
import * as _66 from "./version/types";
export namespace tendermint {
  export const abci = {
    ..._60
  };
  export const crypto = {
    ..._61,
    ..._62
  };
  export const types = {
    ..._63,
    ..._64,
    ..._65
  };
  export const version = {
    ..._66
  };
}