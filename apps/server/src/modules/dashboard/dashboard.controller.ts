import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { ActiveOrganization } from '@/common/decorators/active-organization.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  async getSummary(@ActiveOrganization() organizationId: number) {
    return this.dashboardService.getSummary(organizationId);
  }

  @Get('pending-invoices')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(15)
  async getPendingInvoices(@ActiveOrganization() organizationId: number) {
    return this.dashboardService.getPendingInvoices(organizationId);
  }

  @Get('low-stock')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(15)
  async getLowStock(@ActiveOrganization() organizationId: number) {
    return this.dashboardService.getLowStock(organizationId, 5);
  }

  @Get('health')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60)
  async getHealth(@ActiveOrganization() organizationId: number) {
    return this.dashboardService.getHealth(organizationId);
  }

  @Get('diagnosis')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60)
  async getDiagnosis(@ActiveOrganization() organizationId: number) {
    return this.dashboardService.getDiagnosis(organizationId);
  }

  @Get('strategy')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60)
  async getStrategy(@ActiveOrganization() organizationId: number) {
    return this.dashboardService.getStrategy(organizationId);
  }
}
