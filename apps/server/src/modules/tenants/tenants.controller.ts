import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantId } from '@/common/decorators/tenant.decorator';
import { ActiveUser } from '@/common/decorators/active-user.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  async getCurrentTenant(@TenantId() tenantId: string) {
    // TODO: Implementar obtención de tenant actual
    return { message: 'Get current tenant - To be implemented', tenantId };
  }

  @Post()
  async createOrganization(
    @Body() createOrganizationDto: CreateOrganizationDto,
    @ActiveUser() user: any,
  ) {
    // Validación de Super Admin se hace en el servicio
    return this.tenantsService.create(createOrganizationDto, user.id);
  }
}
