import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/common/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CompletePasswordResetDto } from './dto/complete-password-reset.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.isActive === false) {
      throw new UnauthorizedException('Cuenta desactivada. Contacte al administrador.');
    }

    // Password Reset Required: usuario provisionado con clave temporal
    if (user.requiresPasswordChange === true) {
      throw new ForbiddenException('RESET_REQUIRED');
    }

    const isSuperAdmin = user.isSuperAdmin ?? false;

    // Para Super Admin: visibilidad de TODAS las organizaciones (Poder Global).
    // Para usuarios estándar: solo las de Member (Peso de Membresía).
    let organizations: Array<{
      id: number;
      name: string;
      slug: string;
      plan: string;
      currencyCode: string;
      currencySymbol: string;
      exchangeRate: number;
      rateUpdatedAt: Date | null;
      role: string;
    }>;

    if (isSuperAdmin) {
      // Super Admin: devolver TODAS las organizaciones de la BD, omitiendo tabla Member
      const allOrgs = await this.prisma.organization.findMany({
        orderBy: { nombre: 'asc' },
        select: {
          id: true,
          nombre: true,
          slug: true,
          plan: true,
          currencyCode: true,
          currencySymbol: true,
          exchangeRate: true,
          rateUpdatedAt: true,
        },
      });
      organizations = allOrgs.map((o) => ({
        id: o.id,
        name: o.nombre,
        slug: o.slug,
        plan: o.plan,
        currencyCode: o.currencyCode ?? 'USD',
        currencySymbol: o.currencySymbol ?? '$',
        exchangeRate: o.exchangeRate ?? 1,
        rateUpdatedAt: o.rateUpdatedAt ?? null,
        role: 'SUPER_ADMIN',
      }));
    } else {
      // Usuario estándar: solo organizaciones donde es miembro activo
      const organizationMemberships = await this.prisma.member.findMany({
        where: {
          userId: user.id,
          status: 'ACTIVE',
        },
        include: {
          organization: {
            select: {
              id: true,
              nombre: true,
              slug: true,
              plan: true,
              currencyCode: true,
              currencySymbol: true,
              exchangeRate: true,
              rateUpdatedAt: true,
            },
          },
        },
      });
      organizations = organizationMemberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.nombre,
        slug: m.organization.slug,
        plan: m.organization.plan,
        currencyCode: m.organization.currencyCode ?? 'USD',
        currencySymbol: m.organization.currencySymbol ?? '$',
        exchangeRate: m.organization.exchangeRate ?? 1,
        rateUpdatedAt: m.organization.rateUpdatedAt ?? null,
        role: m.role,
      }));
    }

    // Obtener las empresas legacy a las que pertenece el usuario (CompanyMember)
    const companyMemberships = await this.prisma.companyMember.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            taxId: true,
            logoUrl: true,
            currency: true,
          },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isSuperAdmin,
      // Organizaciones (nuevo sistema): todas para Super Admin, solo memberships para estándar
      organizations,
      // Companies (legacy - mantener para compatibilidad)
      companies: companyMemberships.map((m) => ({
        id: m.company.id,
        name: m.company.name,
        taxId: m.company.taxId,
        logoUrl: m.company.logoUrl,
        currency: m.company.currency,
        role: m.role,
      })),
    };
  }

  /**
   * Completa el cambio de contraseña obligatorio (usuarios provisionados con clave temporal).
   * Verifica la contraseña actual y actualiza a la nueva.
   */
  async completePasswordReset(dto: CompletePasswordResetDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.requiresPasswordChange) {
      throw new BadRequestException('Este usuario no requiere cambio de contraseña');
    }

    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        requiresPasswordChange: false,
      },
    });

    // Validar y obtener datos completos como en login
    const validatedUser = await this.validateUser(dto.email, dto.newPassword);

    const payload = {
      email: validatedUser.email,
      sub: validatedUser.id,
      isSuperAdmin: validatedUser.isSuperAdmin ?? false,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: validatedUser.id,
        email: validatedUser.email,
        fullName: validatedUser.fullName,
        isSuperAdmin: validatedUser.isSuperAdmin,
        organizations: validatedUser.organizations,
        companies: validatedUser.companies,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    const payload = {
      email: user.email,
      sub: user.id,
      isSuperAdmin: user.isSuperAdmin ?? false,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isSuperAdmin: user.isSuperAdmin,
        organizations: user.organizations, // Nuevo sistema
        companies: user.companies, // Legacy - mantener para compatibilidad
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Verificar si el usuario ya existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Hash de la contraseña
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

    // Crear el usuario
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        passwordHash,
        fullName: registerDto.fullName,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
      },
    });

    // Generar JWT
    const payload = {
      email: user.email,
      sub: user.id,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        organizations: [], // El usuario recién registrado no tiene organizaciones aún
        companies: [], // Legacy - mantener para compatibilidad
      },
    };
  }

  /**
   * Obtiene todas las organizaciones del usuario.
   * - Super Admin (isSuperAdmin): devuelve TODAS las organizaciones de la BD.
   * - Usuario estándar: solo las de la tabla Member.
   */
  async getUserOrganizations(userId: number, isSuperAdmin = false) {
    if (isSuperAdmin) {
      const allOrgs = await this.prisma.organization.findMany({
        orderBy: { nombre: 'asc' },
        select: {
          id: true,
          nombre: true,
          slug: true,
          plan: true,
          currencyCode: true,
          currencySymbol: true,
          exchangeRate: true,
          rateUpdatedAt: true,
        },
      });
      return allOrgs.map((o) => ({
        id: o.id,
        nombre: o.nombre,
        slug: o.slug,
        plan: o.plan,
        exchangeRate: o.exchangeRate ?? 1,
        rateUpdatedAt: o.rateUpdatedAt ?? null,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        joinedAt: new Date(),
      }));
    }

    const memberships = await this.prisma.member.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        organization: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            plan: true,
            exchangeRate: true,
            rateUpdatedAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      nombre: m.organization.nombre,
      slug: m.organization.slug,
      plan: m.organization.plan,
      exchangeRate: m.organization.exchangeRate ?? 1,
      rateUpdatedAt: m.organization.rateUpdatedAt ?? null,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
    }));
  }
}
