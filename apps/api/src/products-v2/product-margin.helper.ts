import { Decimal } from '@prisma/client/runtime/library';

/**
 * Compute estimated margin: ((price - vendorCost) / price) * 100
 * Returns null if either input is null or price is zero.
 * This is a system-managed cached field — never user-editable.
 */
export function computeMargin(
    price: Decimal | number | null | undefined,
    vendorCost: Decimal | number | null | undefined,
): number | null {
    if (price == null || vendorCost == null) return null;
    const p = typeof price === 'number' ? price : parseFloat(price.toString());
    const vc = typeof vendorCost === 'number' ? vendorCost : parseFloat(vendorCost.toString());
    if (p === 0) return null;
    return Math.round(((p - vc) / p) * 10000) / 100; // 2 decimal places
}
