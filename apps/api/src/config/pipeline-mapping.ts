/**
 * Pipeline state mapping config
 * Khi Shopify update data → auto-assign pipelineState dựa trên rules này
 * Chỉ apply khi order hiện tại ở state cho phép transition
 */

import { PIPELINE_STATES } from '../order-pipeline/order-pipeline.service';

export interface PipelineMappingRule {
    field: string;           // Shopify field to check
    value: string;           // Value that triggers the rule
    targetState: string;     // Pipeline state to transition to
    allowedFromStates: string[];  // Only apply if order is in one of these states
    description: string;
}

export const PIPELINE_MAPPING_RULES: PipelineMappingRule[] = [
    // Fulfilled → FULFILLED (from any active state)
    {
        field: 'fulfillmentStatus',
        value: 'fulfilled',
        targetState: 'FULFILLED',
        allowedFromStates: ['NEW_FROM_SHOPIFY', 'CHECKING_ADDRESS', 'MER_CHECK', 'WAITING_PURCHASE', 'READY_TO_FULFILL', 'ON_HOLD'],
        description: 'Shopify fulfilled → FULFILLED',
    },
    // Full refund → CANCELLED
    {
        field: 'financialStatus',
        value: 'refunded',
        targetState: 'CANCELLED',
        allowedFromStates: ['NEW_FROM_SHOPIFY', 'CHECKING_ADDRESS', 'MER_CHECK', 'WAITING_PURCHASE', 'READY_TO_FULFILL', 'ON_HOLD'],
        description: 'Full refund → CANCELLED',
    },
    // Cancelled từ Shopify
    {
        field: 'cancelledAt',
        value: '__NOT_NULL__',  // any non-null value
        targetState: 'CANCELLED',
        allowedFromStates: ['NEW_FROM_SHOPIFY', 'CHECKING_ADDRESS', 'MER_CHECK', 'WAITING_PURCHASE', 'READY_TO_FULFILL', 'ON_HOLD'],
        description: 'Shopify cancelled → CANCELLED',
    },
];

/**
 * Apply mapping rules to determine if pipelineState should change
 */
export function applyPipelineMapping(
    currentState: string,
    shopifyData: Record<string, any>,
): string | null {
    for (const rule of PIPELINE_MAPPING_RULES) {
        const fieldValue = shopifyData[rule.field];
        const matches = rule.value === '__NOT_NULL__'
            ? fieldValue != null
            : fieldValue === rule.value;

        if (matches && rule.allowedFromStates.includes(currentState)) {
            return rule.targetState;
        }
    }
    return null; // no state change needed
}
