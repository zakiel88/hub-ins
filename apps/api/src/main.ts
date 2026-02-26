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
    app.enableCors({
        origin: allowedOrigins,
        credentials: true,
    });

    // Trust proxy (for Railway / load balancer)
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);

    // Railway sets PORT automatically — must use it, fallback to API_PORT for local dev
    const port = process.env.PORT || config.API_PORT;
    await app.listen(port);
    console.log(`🚀 INS Commerce Hub API running on port ${port}`);
}
bootstrap();
