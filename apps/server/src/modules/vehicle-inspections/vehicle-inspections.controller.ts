import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { VehicleInspectionsService } from './vehicle-inspections.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { CompanyAccessGuard } from '@/common/guards/company-access.guard';
import { ActiveOrganization } from '@/common/decorators/active-organization.decorator';
import { ActiveUser } from '@/common/decorators/active-user.decorator';
import { CreateInspectionDto } from './dto/create-inspection.dto';

@Controller('vehicle-inspections')
@UseGuards(JwtAuthGuard, OrganizationGuard, CompanyAccessGuard)
export class VehicleInspectionsController {
  constructor(
    private readonly vehicleInspectionsService: VehicleInspectionsService,
  ) {}

  @Post()
  async create(
    @ActiveOrganization() organizationId: number,
    @ActiveUser() user: { id: number },
    @Body() dto: CreateInspectionDto,
  ) {
    return this.vehicleInspectionsService.create({
      organizationId,
      userId: user.id,
      dto,
    });
  }

  @Get()
  async findAll(@ActiveOrganization() organizationId: number) {
    return this.vehicleInspectionsService.findByOrganization(organizationId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @ActiveOrganization() organizationId: number,
  ) {
    const numericId = parseInt(id, 10);
    if (Number.isNaN(numericId)) {
      throw new BadRequestException('ID de inspección inválido');
    }
    return this.vehicleInspectionsService.findOne(numericId, organizationId);
  }
}
