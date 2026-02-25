import { z } from 'zod';

/**
 * Zod schema for env validation — fail-fast on startup.
 * Missing or invalid vars → process.exit(1) with clear error.
 */
const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'staging', 'production'])
        .default('development'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_URL: z.string().optional(),  // Supabase non-pooled (for migrations only)
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),      // Upstash requires auth
    REDIS_TLS: z.string().optional(),           // 'true' for Upstash
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
    JWT_EXPIRY: z.string().default('24h'),
    ENCRYPTION_KEY: z
        .string()
        .length(64, 'ENCRYPTION_KEY must be 64 hex chars (256 bits)')
        .regex(/^[0-9a-f]+$/i, 'ENCRYPTION_KEY must be hex'),
    API_PORT: z.coerce.number().default(3001),
    SHOPIFY_CLIENT_ID: z.string().default(''),
    SHOPIFY_CLIENT_SECRET: z.string().default(''),
    SHOPIFY_SCOPES: z.string().default('read_products,read_orders,read_inventory,read_locations'),
    SHOPIFY_API_VERSION: z.string().default('2025-01'),
    LOG_LEVEL: z
        .enum(['debug', 'info', 'warn', 'error'])
        .default('info'),
    CORS_ORIGIN: z.string().optional(),         // Production: 'https://hub.inecso.com'
});

export type EnvConfig = z.infer<typeof envSchema>;

let _config: EnvConfig | null = null;

/**
 * Validate and cache env config.
 * Call once at startup — exits process on failure.
 */
export function validateConfig(): EnvConfig {
    if (_config) return _config;

    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error('❌ Invalid environment variables:');
        for (const issue of result.error.issues) {
            console.error(`   ${issue.path.join('.')}: ${issue.message}`);
        }
        process.exit(1);
    }

    _config = result.data;
    return _config;
}

/**
 * Get validated config (must call validateConfig first).
 */
export function getConfig(): EnvConfig {
    if (!_config) return validateConfig();
    return _config;
}

/**
 * Reset config cache (e.g. after updating env vars at runtime).
 */
export function resetConfig(): void {
    _config = null;
}
