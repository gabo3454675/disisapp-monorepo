import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { ActiveOrganization } from '@/common/decorators/active-organization.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async findAll(@ActiveOrganization() organizationId: number) {
    // TODO: Implementar listado de inventario
    return { message: 'Get all inventory - To be implemented', organizationId };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @ActiveOrganization() organizationId: number,
  ) {
    // TODO: Implementar obtención de item de inventario
    return { message: 'Get inventory item - To be implemented', id, organizationId };
  }

  @Post()
  async create(
    @Body() createItemDto: any,
    @ActiveOrganization() organizationId: number,
  ) {
    // TODO: Implementar creación de item de inventario
    return { message: 'Create inventory item - To be implemented', organizationId };
  }
}
