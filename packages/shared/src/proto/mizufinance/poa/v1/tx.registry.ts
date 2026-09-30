//@ts-nocheck
import { TelescopeGeneratedType } from "../../../types";
import { MsgAddValidator, MsgAddWhitelist, MsgRemoveWhitelist, MsgRemoveValidator, MsgUpdateValidatorWeight, MsgUpdateParams } from "./tx";
export const registry: ReadonlyArray<[string, TelescopeGeneratedType<any, any, any>]> = [["/mizufinance.poa.v1.MsgAddValidator", MsgAddValidator], ["/mizufinance.poa.v1.MsgAddWhitelist", MsgAddWhitelist], ["/mizufinance.poa.v1.MsgRemoveWhitelist", MsgRemoveWhitelist], ["/mizufinance.poa.v1.MsgRemoveValidator", MsgRemoveValidator], ["/mizufinance.poa.v1.MsgUpdateValidatorWeight", MsgUpdateValidatorWeight], ["/mizufinance.poa.v1.MsgUpdateParams", MsgUpdateParams]];
export const MessageComposer = {
  encoded: {
    addValidator(value: MsgAddValidator) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgAddValidator",
        value: MsgAddValidator.encode(value).finish()
      };
    },
    addWhitelist(value: MsgAddWhitelist) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgAddWhitelist",
        value: MsgAddWhitelist.encode(value).finish()
      };
    },
    removeWhitelist(value: MsgRemoveWhitelist) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgRemoveWhitelist",
        value: MsgRemoveWhitelist.encode(value).finish()
      };
    },
    removeValidator(value: MsgRemoveValidator) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgRemoveValidator",
        value: MsgRemoveValidator.encode(value).finish()
      };
    },
    updateValidatorWeight(value: MsgUpdateValidatorWeight) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgUpdateValidatorWeight",
        value: MsgUpdateValidatorWeight.encode(value).finish()
      };
    },
    updateParams(value: MsgUpdateParams) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgUpdateParams",
        value: MsgUpdateParams.encode(value).finish()
      };
    }
  },
  withTypeUrl: {
    addValidator(value: MsgAddValidator) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgAddValidator",
        value
      };
    },
    addWhitelist(value: MsgAddWhitelist) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgAddWhitelist",
        value
      };
    },
    removeWhitelist(value: MsgRemoveWhitelist) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgRemoveWhitelist",
        value
      };
    },
    removeValidator(value: MsgRemoveValidator) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgRemoveValidator",
        value
      };
    },
    updateValidatorWeight(value: MsgUpdateValidatorWeight) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgUpdateValidatorWeight",
        value
      };
    },
    updateParams(value: MsgUpdateParams) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgUpdateParams",
        value
      };
    }
  },
  fromPartial: {
    addValidator(value: MsgAddValidator) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgAddValidator",
        value: MsgAddValidator.fromPartial(value)
      };
    },
    addWhitelist(value: MsgAddWhitelist) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgAddWhitelist",
        value: MsgAddWhitelist.fromPartial(value)
      };
    },
    removeWhitelist(value: MsgRemoveWhitelist) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgRemoveWhitelist",
        value: MsgRemoveWhitelist.fromPartial(value)
      };
    },
    removeValidator(value: MsgRemoveValidator) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgRemoveValidator",
        value: MsgRemoveValidator.fromPartial(value)
      };
    },
    updateValidatorWeight(value: MsgUpdateValidatorWeight) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgUpdateValidatorWeight",
        value: MsgUpdateValidatorWeight.fromPartial(value)
      };
    },
    updateParams(value: MsgUpdateParams) {
      return {
        typeUrl: "/mizufinance.poa.v1.MsgUpdateParams",
        value: MsgUpdateParams.fromPartial(value)
      };
    }
  }
};