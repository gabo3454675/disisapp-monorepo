import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/common/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

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

    // Obtener las organizaciones a las que pertenece el usuario (Member)
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
            exchangeRate: true,
            rateUpdatedAt: true,
          },
        },
      },
    });

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
      // Organizaciones (nuevo sistema)
      organizations: organizationMemberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.nombre,
        slug: m.organization.slug,
        plan: m.organization.plan,
        exchangeRate: m.organization.exchangeRate ?? 1,
        rateUpdatedAt: m.organization.rateUpdatedAt ?? null,
        role: m.role,
      })),
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

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

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
   * Obtiene todas las organizaciones del usuario
   */
  async getUserOrganizations(userId: number) {
    const memberships = await this.prisma.member.findMany({
      where: {
        userId: userId,
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
