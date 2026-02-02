import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

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

  /**
   * Obtiene todos los miembros activos de una organización (multi-tenant)
   * IMPORTANTE: Filtrar estrictamente por organizationId (sin companyId legacy)
   */
  async getMembers(organizationId: number) {
    const members = await this.prisma.member.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
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
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      fullName: m.user.fullName,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
    }));
  }

  /**
   * Elimina (desactiva) un usuario de una organización.
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
