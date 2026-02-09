import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule, CacheInterceptor } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { CustomersModule } from './modules/customers/customers.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ProductsModule } from './modules/products/products.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { ExpenseCategoriesModule } from './modules/expense-categories/expense-categories.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { BackupModule } from './modules/backup/backup.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    CacheModule.register({
      ttl: 60, // TTL por defecto de 60 segundos
      max: 100, // Máximo 100 items en caché
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    TenantsModule,
    CustomersModule,
    InvoicesModule,
    InventoryModule,
    ProductsModule,
    DashboardModule,
    SuppliersModule,
    ExpensesModule,
    ExpenseCategoriesModule,
    InvitationsModule,
    TasksModule,
    BackupModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class AppModule {}
