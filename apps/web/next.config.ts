import type { NextConfig } from 'next';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const nextConfig: NextConfig = {
    // Docker-optimized standalone build (copies only needed files)
    output: 'standalone',

    // Proxy API requests in development only
    // In production, browser calls api-hub.inecso.com directly
    async rewrites() {
        // Only proxy in dev — in prod, NEXT_PUBLIC_API_URL points to external domain
        if (process.env.NODE_ENV === 'production') return [];
        return [
            {
                source: '/api/:path*',
                destination: `${apiUrl}/api/:path*`,
            },
        ];
    },
};

export default nextConfig;
