/**
 * Market identifiers and their canonical currencies.
 */
export const Markets = {
    USA: 'USA',
    MIDDLE_EAST: 'MIDDLE_EAST',
    CHINA: 'CHINA',
} as const;

export type Market = (typeof Markets)[keyof typeof Markets];

export const MarketCurrency: Record<Market, string> = {
    USA: 'USD',
    MIDDLE_EAST: 'AED',
    CHINA: 'CNY',
};

export const ALL_MARKETS = Object.values(Markets);
