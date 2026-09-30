import {
  Action,
  type ActionPlan,
} from '@mizufinance/protobuf/shieldd/core/transaction/v1/transaction_pb'

/**
 * Build actions whose plans already contain their complete, signed payload.
 */
export function buildProoflessAction(plan: ActionPlan): Action | undefined {
  switch (plan.action.case) {
    case 'complianceRegisterAsset':
      return new Action({
        action: {
          case: 'complianceRegisterAsset',
          value: plan.action.value,
        },
      })
    case 'complianceRegisterUser':
      return new Action({
        action: {
          case: 'complianceRegisterUser',
          value: plan.action.value,
        },
      })
    default:
      return undefined
  }
}
