import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantIsolationExtension } from './tenant-isolation.extension';

const extendedClient = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
}).$extends(tenantIsolationExtension) as PrismaClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ datasources: { db: { url: process.env.DATABASE_URL } } });
    Object.assign(this, extendedClient);
  }

  async onModuleInit() {
    await extendedClient.$connect();
  }

  async onModuleDestroy() {
    await extendedClient.$disconnect();
  }
}
