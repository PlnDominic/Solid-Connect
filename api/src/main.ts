import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import {
  isProduction,
  parseTrustProxy,
  productionConfigProblems,
  resolveCorsOrigin,
  swaggerEnabled,
} from './config/security';

async function bootstrap() {
  // A half-configured production start is worse than no start (see
  // productionConfigProblems), so stop and say what is missing.
  const problems = productionConfigProblems(process.env);
  if (problems.length) {
    throw new Error(
      `Refusing to start in production:\n - ${problems.join('\n - ')}`,
    );
  }
  const production = isProduction(process.env);
  const docsEnabled = swaggerEnabled(process.env);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const prefix = config.get<string>('apiPrefix') ?? 'api/v1';
  app.setGlobalPrefix(prefix);

  // Real client IPs behind a load balancer, so the rate limiter counts people
  // rather than the proxy. See parseTrustProxy.
  app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY, production));
  // Standard security headers. The docs page needs inline scripts, so the
  // content-security-policy is relaxed only while the docs are served.
  app.use(helmet(docsEnabled ? { contentSecurityPolicy: false } : undefined));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: resolveCorsOrigin(
      config.get<string[]>('corsOrigins') ?? [],
      production,
    ),
    credentials: true,
  });

  if (docsEnabled) {
    const swagger = new DocumentBuilder()
      .setTitle('Solid Connect API')
      .setDescription(
        'Marketplace API — NestJS owns business rules; clients request actions only.',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, swagger),
    );
  }

  const port = config.get<number>('port') ?? 3001;
  // Bind all interfaces so Expo Go on a physical device can reach the API via LAN IP.
  await app.listen(port, '0.0.0.0');

  console.log(
    `Solid Connect API listening on 0.0.0.0:${port}/${prefix}${docsEnabled ? ' (docs at /docs)' : ''}`,
  );
}

bootstrap();
