import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { MovementType } from '@prisma/client';
import type { CreateInspectionDto } from './dto/create-inspection.dto';

@Injectable()
export class VehicleInspectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una inspección de vehículo. Por cada repuesto en usedParts,
   * descuenta del inventario (movimiento USO_TALLER) y luego guarda la inspección.
   */
  async create(params: {
    organizationId: number;
    userId: number;
    dto: CreateInspectionDto;
  }) {
    const { organizationId, userId, dto } = params;
    const usedParts = dto.usedParts ?? [];
    const diagramPins = dto.diagramPins ?? [];

    // Validar productos y stock antes de la transacción
    for (const item of usedParts) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, organizationId },
        select: { id: true, name: true, stock: true },
      });
      if (!product) {
        throw new NotFoundException(
          `Producto con id ${item.productId} no encontrado en esta organización.`,
        );
      }
      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Stock insuficiente en "${product.name}". Disponible: ${product.stock}, solicitado: ${item.quantity}.`,
        );
      }
    }

    const inspection = await this.prisma.$transaction(async (tx) => {
      // Descontar inventario (USO_TALLER) por cada repuesto
      for (const item of usedParts) {
        await tx.inventoryMovement.create({
          data: {
            type: MovementType.USO_TALLER,
            quantity: -item.quantity,
            reason: `Inspección vehículo${dto.vehicleInfo ? ` - ${dto.vehicleInfo}` : ''}`,
            productId: item.productId,
            userId,
            tenantId: organizationId,
          },
        });
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return tx.vehicleInspection.create({
        data: {
          tenantId: organizationId,
          diagramPins: diagramPins.length ? (diagramPins as object) : undefined,
          usedParts: usedParts.length ? (usedParts as object) : undefined,
          vehicleInfo: dto.vehicleInfo ?? undefined,
          notes: dto.notes ?? undefined,
        },
      });
    });

    return inspection;
  }

  /**
   * Lista inspecciones de la organización.
   */
  async findByOrganization(organizationId: number, limit = 50) {
    return this.prisma.vehicleInspection.findMany({
      where: { tenantId: organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  /**
   * Obtiene una inspección por id (solo si pertenece al tenant).
   */
  async findOne(id: number, organizationId: number) {
    const inspection = await this.prisma.vehicleInspection.findFirst({
      where: { id, tenantId: organizationId },
    });
    if (!inspection) {
      throw new NotFoundException('Inspección no encontrada.');
    }
    return inspection;
  }
}
