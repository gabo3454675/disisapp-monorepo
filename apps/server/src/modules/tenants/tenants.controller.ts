import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { TenantId } from '@/common/decorators/tenant.decorator';
import { ActiveUser } from '@/common/decorators/active-user.decorator';
import { ActiveOrganization } from '@/common/decorators/active-organization.decorator';
import { ActiveOrganizationMembership } from '@/common/decorators/active-organization-membership.decorator';
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

  /**
   * Lista los miembros activos de la organización (tabla Member, no legacy).
   * Requiere rol ADMIN, MANAGER o SUPER_ADMIN para ver la lista.
   */
  @Get('users')
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async getMembers(@ActiveOrganization() organizationId: number) {
    return this.tenantsService.getMembers(organizationId);
  }

  /**
   * Elimina (desactiva) un usuario de la organización.
   * Regla: no puede eliminarse a sí mismo. Solo OWNER o ADMIN puede eliminar.
   */
  @Delete('users/:id')
  @UseGuards(OrganizationGuard)
  async removeUser(
    @Param('id', ParseIntPipe) targetUserId: number,
    @ActiveOrganization() organizationId: number,
    @ActiveUser() user: any,
    @ActiveOrganizationMembership() membership: any,
  ) {
    return this.tenantsService.removeUserFromOrganization({
      organizationId,
      targetUserId,
      requesterUserId: user.id,
      requesterRole: membership?.role,
    });
  }
}
