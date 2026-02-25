/**
 * Status enums for core entities.
 */
export const BrandStatuses = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    ONBOARDING: 'onboarding',
    SUSPENDED: 'suspended',
} as const;
export type BrandStatus = (typeof BrandStatuses)[keyof typeof BrandStatuses];

export const ImportBatchStatuses = {
    UPLOADED: 'uploaded',
    VALIDATING: 'validating',
    VALIDATED: 'validated',
    REVIEWING: 'reviewing',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    PROCESSING: 'processing',
    PROCESSED: 'processed',
} as const;
export type ImportBatchStatus = (typeof ImportBatchStatuses)[keyof typeof ImportBatchStatuses];

export const PricingStatuses = {
    DRAFT: 'draft',
    PENDING_REVIEW: 'pending_review',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    PUBLISHING: 'publishing',
    PUBLISHED: 'published',
    FAILED: 'failed',
} as const;
export type PricingStatus = (typeof PricingStatuses)[keyof typeof PricingStatuses];

export const WebhookEventStatuses = {
    RECEIVED: 'received',
    PROCESSING: 'processing',
    PROCESSED: 'processed',
    FAILED: 'failed',
    SKIPPED: 'skipped',
} as const;
export type WebhookEventStatus = (typeof WebhookEventStatuses)[keyof typeof WebhookEventStatuses];

export const MappingStatuses = {
    MATCHED: 'matched',
    UNMATCHED: 'unmatched',
    CONFLICT: 'conflict',
    IGNORED: 'ignored',
} as const;
export type MappingStatus = (typeof MappingStatuses)[keyof typeof MappingStatuses];

export const InventorySyncStatuses = {
    SYNCED: 'synced',
    STALE: 'stale',
    ERROR: 'error',
} as const;
export type InventorySyncStatus = (typeof InventorySyncStatuses)[keyof typeof InventorySyncStatuses];

export const ProductCategories = [
    'Tops',
    'Bottoms',
    'Dresses',
    'Outerwear',
    'Accessories',
    'Bags',
    'Shoes',
    'Swimwear',
    'Underwear',
    'Other',
] as const;
export type ProductCategory = (typeof ProductCategories)[number];
