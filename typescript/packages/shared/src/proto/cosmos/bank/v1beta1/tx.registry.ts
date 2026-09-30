//@ts-nocheck
import { TelescopeGeneratedType } from "../../../types";
import { MsgSend, MsgMultiSend, MsgBurn, MsgUpdateParams, MsgSetSendEnabled } from "./tx";
export const registry: ReadonlyArray<[string, TelescopeGeneratedType<any, any, any>]> = [["/cosmos.bank.v1beta1.MsgSend", MsgSend], ["/cosmos.bank.v1beta1.MsgMultiSend", MsgMultiSend], ["/cosmos.bank.v1beta1.MsgBurn", MsgBurn], ["/cosmos.bank.v1beta1.MsgUpdateParams", MsgUpdateParams], ["/cosmos.bank.v1beta1.MsgSetSendEnabled", MsgSetSendEnabled]];
export const MessageComposer = {
  encoded: {
    send(value: MsgSend) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgSend",
        value: MsgSend.encode(value).finish()
      };
    },
    multiSend(value: MsgMultiSend) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgMultiSend",
        value: MsgMultiSend.encode(value).finish()
      };
    },
    burn(value: MsgBurn) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgBurn",
        value: MsgBurn.encode(value).finish()
      };
    },
    updateParams(value: MsgUpdateParams) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgUpdateParams",
        value: MsgUpdateParams.encode(value).finish()
      };
    },
    setSendEnabled(value: MsgSetSendEnabled) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgSetSendEnabled",
        value: MsgSetSendEnabled.encode(value).finish()
      };
    }
  },
  withTypeUrl: {
    send(value: MsgSend) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgSend",
        value
      };
    },
    multiSend(value: MsgMultiSend) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgMultiSend",
        value
      };
    },
    burn(value: MsgBurn) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgBurn",
        value
      };
    },
    updateParams(value: MsgUpdateParams) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgUpdateParams",
        value
      };
    },
    setSendEnabled(value: MsgSetSendEnabled) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgSetSendEnabled",
        value
      };
    }
  },
  fromPartial: {
    send(value: MsgSend) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgSend",
        value: MsgSend.fromPartial(value)
      };
    },
    multiSend(value: MsgMultiSend) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgMultiSend",
        value: MsgMultiSend.fromPartial(value)
      };
    },
    burn(value: MsgBurn) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgBurn",
        value: MsgBurn.fromPartial(value)
      };
    },
    updateParams(value: MsgUpdateParams) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgUpdateParams",
        value: MsgUpdateParams.fromPartial(value)
      };
    },
    setSendEnabled(value: MsgSetSendEnabled) {
      return {
        typeUrl: "/cosmos.bank.v1beta1.MsgSetSendEnabled",
        value: MsgSetSendEnabled.fromPartial(value)
      };
    }
  }
};