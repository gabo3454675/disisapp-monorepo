import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
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
