import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as compression from 'compression';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3002');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Servir archivos estáticos desde la carpeta uploads
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  // Compression Gzip - Reduce el tamaño de las respuestas JSON hasta 70%
  app.use(compression());

  // CORS Configuration - Seguro para producción
  // En producción, solo acepta peticiones desde el dominio configurado
  // En desarrollo, acepta desde localhost
  const allowedOrigins: string[] = [];
  
  // Dominios de producción siempre permitidos
  const productionDomains = [
    'https://disisapp.com',
    'https://www.disisapp.com',
  ];
  
  if (nodeEnv === 'production') {
    // Agregar dominios de producción
    allowedOrigins.push(...productionDomains);
    
    // En producción, también aceptar desde el dominio configurado
    if (frontendUrl) {
      // Agregar el dominio principal
      allowedOrigins.push(frontendUrl);
      
      // Agregar variante con www si no la tiene
      if (frontendUrl.startsWith('https://')) {
        const domain = frontendUrl.replace('https://', '');
        if (!domain.startsWith('www.')) {
          allowedOrigins.push(`https://www.${domain}`);
        }
      }
    }
  } else {
    // En desarrollo, permitir localhost
    allowedOrigins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    );
    // También permitir dominios de producción en desarrollo para testing
    allowedOrigins.push(...productionDomains);
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (Postman, mobile apps, etc.) solo en desarrollo
      if (!origin && nodeEnv !== 'production') {
        return callback(null, true);
      }
      
      // En producción, rechazar requests sin origin
      if (!origin && nodeEnv === 'production') {
        return callback(new Error('Not allowed by CORS'));
      }
      
      // Verificar si el origin está permitido
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-tenant-id',
      'x-organization-id',
      'x-company-id',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Global Prefix
  app.setGlobalPrefix('api');

  await app.listen(port);
}

bootstrap();
