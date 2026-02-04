import {
  Controller,
  Get,
  Post,
  Patch,
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
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  async getCurrentTenant(@TenantId() tenantId: string) {
    // TODO: Implementar obtención de tenant actual
    return { message: 'Get current tenant - To be implemented', tenantId };
  }

  /**
   * Obtiene la organización actual (incluye exchangeRate).
   */
  @Get('organization')
  @UseGuards(OrganizationGuard)
  async getOrganization(@ActiveOrganization() organizationId: number) {
    return this.tenantsService.getOrganization(organizationId);
  }

  /**
   * Actualiza la organización (ej. tasa BCV/Paralelo). Solo ADMIN o SUPER_ADMIN.
   */
  @Patch('organization')
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async updateOrganization(
    @ActiveOrganization() organizationId: number,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.tenantsService.updateOrganization(organizationId, dto);
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
   * Lista los miembros de la organización según visibilidad del rol:
   * SUPER_ADMIN/ADMIN: lista completa. MANAGER: solo SELLER/WAREHOUSE. SELLER/WAREHOUSE: vacía.
   */
  @Get('users')
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async getMembers(
    @ActiveOrganization() organizationId: number,
    @ActiveOrganizationMembership() membership: any,
  ) {
    return this.tenantsService.getMembers(organizationId, membership?.role);
  }

  /**
   * Alias: GET /organization/members (misma lógica que GET /users).
   */
  @Get('organization/members')
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async getOrganizationMembers(
    @ActiveOrganization() organizationId: number,
    @ActiveOrganizationMembership() membership: any,
  ) {
    return this.tenantsService.getMembers(organizationId, membership?.role);
  }

  /**
   * Cambia el rol de un miembro. ADMIN no puede cambiar a SUPER_ADMIN ni promoverse a SUPER_ADMIN.
   */
  @Patch('organization/members/:memberId/role')
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async updateMemberRole(
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: UpdateMemberRoleDto,
    @ActiveOrganization() organizationId: number,
    @ActiveUser() user: any,
    @ActiveOrganizationMembership() membership: any,
  ) {
    return this.tenantsService.updateMemberRole(
      memberId,
      organizationId,
      dto,
      user.id,
      membership?.role ?? '',
    );
  }

  /**
   * Desactiva un miembro (soft: status SUSPENDED). No borra User ni historial.
   */
  @Delete('organization/members/:memberId')
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async removeMember(
    @Param('memberId', ParseIntPipe) memberId: number,
    @ActiveOrganization() organizationId: number,
    @ActiveUser() user: any,
    @ActiveOrganizationMembership() membership: any,
  ) {
    return this.tenantsService.removeMemberByMemberId(
      memberId,
      organizationId,
      user.id,
      membership?.role ?? '',
    );
  }

  /**
   * Elimina (desactiva) un usuario de la organización por userId (legacy).
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
