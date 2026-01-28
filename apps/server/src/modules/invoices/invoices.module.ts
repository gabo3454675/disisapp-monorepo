import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesPublicController } from './invoices-public.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesController, InvoicesPublicController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
