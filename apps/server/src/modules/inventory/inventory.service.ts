import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    // TODO: Implementar listado de inventario
    return [];
  }

  async findOne(id: string, tenantId: string) {
    // TODO: Implementar búsqueda de item de inventario
    return null;
  }

  async create(createItemDto: any, tenantId: string) {
    // TODO: Implementar creación de item de inventario
    return null;
  }
}
