import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { getCompanyIdFromOrganization } from '@/common/helpers/organization.helper';

/** Nombre de la empresa a la que se restringe el acceso a inspección de vehículos. */
const ALLOWED_COMPANY_NAME = 'Davean';

/**
 * Guard que restringe el acceso a inspección de vehículos a la empresa 'Davean'.
 * Debe usarse junto con JwtAuthGuard y OrganizationGuard (para tener activeOrganizationId).
 * Extrae el companyId del contexto de la organización activa (x-tenant-id) y solo permite
 * el acceso si coincide con el ID de la empresa con nombre 'Davean'.
 */
@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const organizationId = request.activeOrganizationId as number | undefined;

    if (organizationId == null) {
      throw new ForbiddenException(
        'Se requiere organización activa (x-tenant-id). Use OrganizationGuard antes de CompanyAccessGuard.',
      );
    }

    const companyId = await getCompanyIdFromOrganization(
      this.prisma,
      organizationId,
    );

    const davean = await this.prisma.company.findFirst({
      where: { name: ALLOWED_COMPANY_NAME, isActive: true },
      select: { id: true },
    });

    if (!davean) {
      throw new ForbiddenException(
        `El módulo de inspección de vehículos no está disponible para esta organización.`,
      );
    }

    if (companyId !== davean.id) {
      throw new ForbiddenException(
        'El acceso a inspección de vehículos está restringido a la empresa autorizada.',
      );
    }

    return true;
  }
}
