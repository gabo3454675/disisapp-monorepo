import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Validar que el usuario esté autenticado
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Buscar el header x-tenant-id (o x-organization-id como alternativa)
    const organizationIdHeader =
      request.headers['x-tenant-id'] || request.headers['x-organization-id'];

    if (!organizationIdHeader) {
      throw new BadRequestException(
        'Header x-tenant-id es requerido para acceder a esta organización',
      );
    }

    // Convertir a número y validar
    const organizationId = parseInt(organizationIdHeader, 10);
    if (isNaN(organizationId)) {
      throw new BadRequestException(
        'x-tenant-id debe ser un número válido',
      );
    }

    // Verificar que la organización existe
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException(
        `La organización con ID ${organizationId} no existe`,
      );
    }

    // Verificar que el usuario es miembro activo de esta organización
    const membership = await this.prisma.member.findFirst({
      where: {
        userId: user.id,
        organizationId: organizationId,
        status: 'ACTIVE',
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'No tienes acceso a esta organización o tu membresía está inactiva',
      );
    }

    // Inyectar información en el request para uso en controladores
    request.activeOrganizationId = organizationId;
    request.activeOrganization = membership.organization;
    request.activeOrganizationMembership = membership;

    return true;
  }
}
