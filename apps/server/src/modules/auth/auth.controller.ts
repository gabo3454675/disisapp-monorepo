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

  /**
   * Obtiene todas las organizaciones del usuario autenticado
   */
  @Get('organizations')
  @UseGuards(JwtAuthGuard)
  async getUserOrganizations(@ActiveUser() user: any) {
    return this.authService.getUserOrganizations(user.id);
  }
}
