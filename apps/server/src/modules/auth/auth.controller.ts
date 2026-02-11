import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '@/common/decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CompletePasswordResetDto } from './dto/complete-password-reset.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ActiveUser } from '@/common/decorators/active-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('complete-password-reset')
  @HttpCode(HttpStatus.OK)
  async completePasswordReset(@Body() dto: CompletePasswordResetDto) {
    return this.authService.completePasswordReset(dto);
  }

  /**
   * Obtiene todas las organizaciones del usuario autenticado.
   * Super Admin: todas las orgs. Usuario estándar: solo las de Member.
   */
  @Get('organizations')
  @UseGuards(JwtAuthGuard)
  async getUserOrganizations(@ActiveUser() user: { id: number; isSuperAdmin?: boolean }) {
    return this.authService.getUserOrganizations(user.id, user.isSuperAdmin ?? false);
  }
}
