import { MsgAddValidator, MsgAddWhitelist, MsgRemoveWhitelist, MsgRemoveValidator, MsgUpdateValidatorWeight, MsgUpdateParams } from "./tx";
export const AminoConverter = {
  "/mizufinance.poa.v1.MsgAddValidator": {
    aminoType: "x/poa/MsgAddValidator",
    toAmino: MsgAddValidator.toAmino,
    fromAmino: MsgAddValidator.fromAmino
  },
  "/mizufinance.poa.v1.MsgAddWhitelist": {
    aminoType: "x/poa/MsgAddWhitelist",
    toAmino: MsgAddWhitelist.toAmino,
    fromAmino: MsgAddWhitelist.fromAmino
  },
  "/mizufinance.poa.v1.MsgRemoveWhitelist": {
    aminoType: "x/poa/MsgRemoveWhitelist",
    toAmino: MsgRemoveWhitelist.toAmino,
    fromAmino: MsgRemoveWhitelist.fromAmino
  },
  "/mizufinance.poa.v1.MsgRemoveValidator": {
    aminoType: "x/poa/MsgRemoveValidator",
    toAmino: MsgRemoveValidator.toAmino,
    fromAmino: MsgRemoveValidator.fromAmino
  },
  "/mizufinance.poa.v1.MsgUpdateValidatorWeight": {
    aminoType: "x/poa/MsgUpdateValidatorWeight",
    toAmino: MsgUpdateValidatorWeight.toAmino,
    fromAmino: MsgUpdateValidatorWeight.fromAmino
  },
  "/mizufinance.poa.v1.MsgUpdateParams": {
    aminoType: "x/poa/MsgUpdateParams",
    toAmino: MsgUpdateParams.toAmino,
    fromAmino: MsgUpdateParams.fromAmino
  }
};