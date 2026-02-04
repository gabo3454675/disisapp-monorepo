import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { Role } from '@prisma/client';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene los datos de la organización actual (incluye exchangeRate).
   */
  async getOrganization(organizationId: number) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        nombre: true,
        slug: true,
        plan: true,
        exchangeRate: true,
      },
    });
    if (!org) {
      throw new NotFoundException('Organización no encontrada');
    }
    return {
      id: org.id,
      name: org.nombre,
      slug: org.slug,
      plan: org.plan,
      exchangeRate: org.exchangeRate ?? 1,
    };
  }

  /**
   * Actualiza la organización (p. ej. tasa de cambio). Solo ADMIN/SUPER_ADMIN.
   */
  async updateOrganization(
    organizationId: number,
    dto: UpdateOrganizationDto,
  ) {
    const data: { exchangeRate?: number } = {};
    if (dto.exchangeRate !== undefined) {
      data.exchangeRate = dto.exchangeRate;
    }
    if (Object.keys(data).length === 0) {
      return this.getOrganization(organizationId);
    }
    await this.prisma.organization.update({
      where: { id: organizationId },
      data,
    });
    return this.getOrganization(organizationId);
  }

  async findOne(id: string) {
    // TODO: Implementar búsqueda de tenant
    return null;
  }

  /**
   * Alias de compatibilidad: algunos clientes llaman "findAll" para listar miembros.
   */
  async findAll(organizationId: number) {
    return this.getMembers(organizationId);
  }

  /** Peso jerárquico para ordenar roles (mayor = más arriba en la lista) */
  private static readonly ROLE_ORDER: Record<string, number> = {
    SUPER_ADMIN: 5,
    ADMIN: 4,
    MANAGER: 3,
    SELLER: 2,
    WAREHOUSE: 1,
  };

  /**
   * Obtiene miembros de la organización según visibilidad del rol del solicitante.
   * - SUPER_ADMIN / ADMIN: lista completa.
   * - MANAGER: solo su equipo (SELLER, WAREHOUSE).
   * - SELLER / WAREHOUSE: no pueden ver la lista (devolver vacío; el guard puede bloquear acceso).
   */
  async getMembers(organizationId: number, requesterRole?: string) {
    const role = String(requesterRole || '').toUpperCase().trim();

    const members = await this.prisma.member.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        ...(role === 'MANAGER'
          ? { role: { in: ['SELLER', 'WAREHOUSE'] } }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // SELLER / WAREHOUSE: no ven a nadie (lista vacía)
    if (role === 'SELLER' || role === 'WAREHOUSE') {
      return [];
    }

    const mapped = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      fullName: m.user.fullName,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
    }));

    const roleWeight = (r: string) =>
      TenantsService.ROLE_ORDER[String(r).toUpperCase()] ?? 0;

    mapped.sort((a, b) => {
      const diff = roleWeight(b.role) - roleWeight(a.role);
      if (diff !== 0) return diff;
      return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
    });

    return mapped;
  }

  /**
   * Actualiza el rol de un miembro.
   * - Un ADMIN no puede cambiar el rol de un SUPER_ADMIN (OWNER).
   * - Un ADMIN no puede promoverse a sí mismo a SUPER_ADMIN.
   */
  async updateMemberRole(
    memberId: number,
    organizationId: number,
    dto: UpdateMemberRoleDto,
    requesterUserId: number,
    requesterRole: string,
  ) {
    const membership = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId, status: 'ACTIVE' },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });

    if (!membership) {
      throw new NotFoundException('Miembro no encontrado en esta organización');
    }

    const role = String(requesterRole).toUpperCase().trim();
    const newRole = String(dto.newRole).toUpperCase().trim() as Role;

    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
      throw new ForbiddenException('Solo un administrador puede cambiar roles');
    }

    if (String(membership.role).toUpperCase() === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('No puedes cambiar el rol del propietario (SUPER_ADMIN)');
    }

    if (membership.userId === requesterUserId && newRole === 'SUPER_ADMIN') {
      throw new ForbiddenException('No puedes promoverse a ti mismo a propietario');
    }

    const updated = await this.prisma.member.update({
      where: { id: memberId },
      data: { role: newRole as Role },
      include: {
        user: { select: { id: true, email: true, fullName: true, avatarUrl: true } },
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      fullName: updated.user.fullName,
      avatarUrl: updated.user.avatarUrl,
      role: updated.role,
      status: updated.status,
      joinedAt: updated.joinedAt,
    };
  }

  /**
   * Desactiva un miembro (soft delete: status = SUSPENDED).
   * NO borra el User ni el historial (facturas, tareas siguen vinculadas al User).
   */
  async removeMemberByMemberId(
    memberId: number,
    organizationId: number,
    requesterUserId: number,
    requesterRole: string,
  ) {
    const membership = await this.prisma.member.findFirst({
      where: { id: memberId, organizationId },
      include: { user: { select: { id: true, email: true, fullName: true } } },
    });

    if (!membership) {
      throw new NotFoundException('Miembro no encontrado en esta organización');
    }

    if (membership.userId === requesterUserId) {
      throw new BadRequestException('No puedes desactivarte a ti mismo');
    }

    const role = String(requesterRole).toUpperCase().trim();
    const canDelete = role === 'SUPER_ADMIN' || role === 'ADMIN';
    if (!canDelete) {
      throw new ForbiddenException('Solo un administrador puede desactivar miembros');
    }

    if (role === 'ADMIN' && String(membership.role).toUpperCase() === 'SUPER_ADMIN') {
      throw new ForbiddenException('Un ADMIN no puede desactivar al propietario (SUPER_ADMIN)');
    }

    await this.prisma.member.update({
      where: { id: memberId },
      data: { status: 'SUSPENDED' },
    });

    return {
      message: 'Usuario desactivado de la organización. Sus facturas y actividad se mantienen.',
      userId: membership.userId,
      email: membership.user.email,
      fullName: membership.user.fullName,
      organizationId,
    };
  }

  /**
   * Elimina (desactiva) un usuario de una organización por userId.
   * Reglas:
   * - Un usuario no puede eliminarse a sí mismo
   * - Solo OWNER o ADMIN puede eliminar (en este sistema, SUPER_ADMIN se considera OWNER)
   *
   * Nota: Se hace "soft-remove" de la membresía (status = SUSPENDED) para auditoría.
   */
  async removeUserFromOrganization(params: {
    organizationId: number;
    targetUserId: number;
    requesterUserId: number;
    requesterRole: unknown;
  }) {
    const { organizationId, targetUserId, requesterUserId, requesterRole } = params;

    if (targetUserId === requesterUserId) {
      throw new BadRequestException('No puedes eliminarte a ti mismo');
    }

    const role = String(requesterRole || '').toUpperCase().trim();
    const canDelete = role === 'OWNER' || role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (!canDelete) {
      throw new ForbiddenException('Solo un OWNER o ADMIN puede eliminar usuarios');
    }

    const membership = await this.prisma.member.findFirst({
      where: {
        userId: targetUserId,
        organizationId,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException(
        'El usuario no es un miembro activo de esta organización',
      );
    }

    // Seguridad adicional: un ADMIN no puede eliminar un SUPER_ADMIN
    if (role === 'ADMIN' && String(membership.role).toUpperCase() === 'SUPER_ADMIN') {
      throw new ForbiddenException('Un ADMIN no puede eliminar un SUPER_ADMIN');
    }

    await this.prisma.member.update({
      where: { id: membership.id },
      data: { status: 'SUSPENDED' },
    });

    return {
      message: 'Usuario eliminado de la organización',
      userId: membership.userId,
      email: membership.user.email,
      fullName: membership.user.fullName,
      organizationId,
    };
  }

  /**
   * Crea una nueva organización
   * SOLO el Super Admin puede crear organizaciones
   */
  async create(createOrganizationDto: CreateOrganizationDto, userId: number) {
    // Validar que el usuario es Super Admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    if (!user.isSuperAdmin) {
      throw new ForbiddenException(
        'Solo el Super Admin puede crear organizaciones',
      );
    }

    // Validar que el slug no existe
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: createOrganizationDto.slug },
    });

    if (existingOrg) {
      throw new ConflictException(
        `Ya existe una organización con el slug: ${createOrganizationDto.slug}`,
      );
    }

    // Crear la organización
    const organization = await this.prisma.organization.create({
      data: {
        nombre: createOrganizationDto.nombre,
        slug: createOrganizationDto.slug,
        plan: createOrganizationDto.plan || 'FREE',
      },
    });

    // Asignar al Super Admin como SUPER_ADMIN de la nueva organización
    await this.prisma.member.create({
      data: {
        userId: userId,
        organizationId: organization.id,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });

    return organization;
  }
}
