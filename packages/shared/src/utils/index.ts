// Pure utility functions only — no ORM, no business logic

/**
 * Mask a secret string, showing only last 4 chars.
 * e.g. "shpat_abc123xyz" → "***********3xyz"
 */
export function maskSecret(value: string): string {
    if (!value || value.length <= 4) return '****';
    return '*'.repeat(value.length - 4) + value.slice(-4);
}
