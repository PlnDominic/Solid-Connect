import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const prefix = config.get<string>('apiPrefix') ?? 'api/v1';
  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const origins = config.get<string[]>('corsOrigins') ?? [];
  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
  });

  const swagger = new DocumentBuilder()
    .setTitle('Solid Connect API')
    .setDescription('Marketplace API — NestJS owns business rules; clients request actions only.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('port') ?? 3001;
  // Bind all interfaces so Expo Go on a physical device can reach the API via LAN IP.
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Solid Connect API listening on 0.0.0.0:${port}/${prefix} (docs at /docs)`);
}

bootstrap();
