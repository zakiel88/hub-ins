import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { validateConfig } from './config/configuration';

async function bootstrap() {
    // Fail-fast: validate env before anything else
    const config = validateConfig();

    const app = await NestFactory.create(AppModule, { bufferLogs: true });

    // Use pino as the NestJS logger
    app.useLogger(app.get(Logger));

    // CORS — use CORS_ORIGIN env var in production, localhost in dev
    const allowedOrigins: string[] = [];
    if (config.CORS_ORIGIN) {
        allowedOrigins.push(...config.CORS_ORIGIN.split(',').map((o) => o.trim()));
    }
    if (config.NODE_ENV === 'development') {
        allowedOrigins.push('http://localhost:3000', `http://localhost:${config.API_PORT}`);
    }
    console.log('🔒 CORS allowed origins:', allowedOrigins);
    app.enableCors({
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, curl, server-to-server)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            console.warn(`⚠️ CORS blocked origin: ${origin}`);
            return callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // Trust proxy (for Railway / load balancer)
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);

    // Railway sets PORT automatically — must use it, fallback to API_PORT for local dev
    const port = process.env.PORT || config.API_PORT;
    await app.listen(port, '0.0.0.0');
    console.log(`🚀 INS Commerce Hub API running on 0.0.0.0:${port}`);
}
bootstrap();
