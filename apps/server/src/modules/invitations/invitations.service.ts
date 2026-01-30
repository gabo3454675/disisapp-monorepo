import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class InvitationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Invita a un miembro a una organización
   * Maneja tanto usuarios nuevos como existentes
   */
  async inviteMember(
    inviteDto: InviteMemberDto,
    organizationId: number,
    invitedBy: number,
  ) {
    // Validar que el invitador tiene permisos (SUPER_ADMIN o ADMIN)
    const inviterMembership = await this.prisma.member.findFirst({
      where: {
        userId: invitedBy,
        organizationId: organizationId,
        status: 'ACTIVE',
      },
    });

    if (!inviterMembership) {
      throw new ForbiddenException(
        'No tienes acceso a esta organización',
      );
    }

    // Solo SUPER_ADMIN y ADMIN pueden invitar miembros
    if (inviterMembership.role !== 'SUPER_ADMIN' && inviterMembership.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Solo los SUPER_ADMIN y ADMIN pueden invitar miembros',
      );
    }

    // REGLA DE ORO: Los ADMIN no pueden crear otros ADMIN
    if (inviterMembership.role === 'ADMIN' && inviteDto.role === 'ADMIN') {
      throw new ForbiddenException(
        'Los ADMIN no pueden crear otros ADMIN. Solo el SUPER_ADMIN puede asignar roles ADMIN.',
      );
    }

    // Los ADMIN tampoco pueden crear SUPER_ADMIN
    if (inviterMembership.role === 'ADMIN' && inviteDto.role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Los ADMIN no pueden crear SUPER_ADMIN. Solo el SUPER_ADMIN del sistema puede asignar este rol.',
      );
    }

    // Verificar si el usuario existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email: inviteDto.email },
    });

    // Verificar que no existe una membresía activa (solo si el usuario existe)
    let existingMembership = null;
    if (existingUser) {
      existingMembership = await this.prisma.member.findFirst({
        where: {
          userId: existingUser.id,
          organizationId: organizationId,
          status: 'ACTIVE',
        },
      });
    }

    if (existingMembership) {
      throw new ConflictException(
        'Este usuario ya es miembro activo de esta organización',
      );
    }

    // Verificar si existe una invitación pendiente para este email y organización
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        email: inviteDto.email,
        organizationId: organizationId,
        status: 'PENDING',
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingInvitation) {
      throw new ConflictException(
        'Ya existe una invitación pendiente para este usuario',
      );
    }

    // Generar token único
    const token = randomBytes(32).toString('hex');

    // Fecha de expiración: 7 días desde ahora
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Crear la invitación (funciona tanto para usuarios nuevos como existentes)
    const invitation = await this.prisma.invitation.create({
      data: {
        email: inviteDto.email,
        token,
        role: inviteDto.role,
        organizationId: organizationId,
        invitedBy: invitedBy,
        expiresAt,
        status: 'PENDING',
      },
      include: {
        organization: {
          select: {
            id: true,
            nombre: true,
            slug: true,
          },
        },
        inviter: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    // TODO: Enviar email con el token de invitación
    // Por ahora retornamos el token para desarrollo
    return {
      invitation,
      token, // En producción, esto se enviaría por email
      invitationUrl: `/accept-invitation?token=${token}`,
    };
  }

  /**
   * Acepta una invitación
   * Si el usuario existe, lo vincula a la organización
   * Si no existe, debería crear el usuario (pero eso se manejaría en otro endpoint)
   */
  async acceptInvitation(token: string, userId: number) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Esta invitación ya fue procesada');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Esta invitación ha expirado');
    }

    // Verificar que el email del usuario coincide con el de la invitación
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.email !== invitation.email) {
      throw new ForbiddenException(
        'El email del usuario no coincide con el de la invitación',
      );
    }

    // Verificar que no existe ya una membresía activa
    const existingMembership = await this.prisma.member.findFirst({
      where: {
        userId: userId,
        organizationId: invitation.organizationId,
        status: 'ACTIVE',
      },
    });

    if (existingMembership) {
      // Marcar invitación como aceptada aunque ya exista membresía
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });
      throw new ConflictException(
        'Ya eres miembro de esta organización',
      );
    }

    // Crear la membresía
    const membership = await this.prisma.member.create({
      data: {
        userId: userId,
        organizationId: invitation.organizationId,
        role: invitation.role,
        status: 'ACTIVE',
      },
      include: {
        organization: true,
      },
    });

    // Marcar invitación como aceptada
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED' },
    });

    return membership;
  }

  /**
   * Obtiene todos los miembros activos de una organización
   */
  async getOrganizationMembers(organizationId: number) {
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
   * Obtiene todas las invitaciones de una organización
   */
  async getOrganizationInvitations(organizationId: number, userId: number) {
    // Validar permisos
    const membership = await this.prisma.member.findFirst({
      where: {
        userId: userId,
        organizationId: organizationId,
        status: 'ACTIVE',
      },
    });

    if (!membership || (membership.role !== 'SUPER_ADMIN' && membership.role !== 'ADMIN')) {
      throw new ForbiddenException(
        'Solo los SUPER_ADMIN y ADMIN pueden ver las invitaciones',
      );
    }

    return this.prisma.invitation.findMany({
      where: {
        organizationId: organizationId,
      },
      include: {
        inviter: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
