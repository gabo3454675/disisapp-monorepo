import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { CreateMovementDto } from './dto/create-movement.dto';
import { MovementType } from '@prisma/client';

@Injectable()
export class InventoryMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra una salida de inventario (Autoconsumo o Merma).
   * Descuenta la cantidad del stock del producto y crea el registro en InventoryMovement.
   */
  async createOutflow(params: {
    organizationId: number;
    userId: number;
    dto: CreateMovementDto;
  }) {
    const { organizationId, userId, dto } = params;

    const product = await this.prisma.product.findFirst({
      where: {
        id: dto.productId,
        organizationId,
      },
      select: { id: true, name: true, stock: true },
    });

    if (!product) {
      throw new NotFoundException(
        `Producto con id ${dto.productId} no encontrado en esta organización.`,
      );
    }

    if (product.stock < dto.quantity) {
      throw new BadRequestException(
        `Stock insuficiente. Disponible: ${product.stock}, solicitado: ${dto.quantity}.`,
      );
    }

    const movementType = dto.type as MovementType;

    const result = await this.prisma.$transaction(async (tx) => {
      const movement = await tx.inventoryMovement.create({
        data: {
          type: movementType,
          quantity: -dto.quantity,
          reason: dto.reason ?? null,
          productId: dto.productId,
          userId,
          tenantId: organizationId,
        },
      });
      const updated = await tx.product.update({
        where: { id: dto.productId },
        data: { stock: { decrement: dto.quantity } },
        select: { stock: true },
      });
      return { movement, newStock: updated.stock };
    });

    return {
      movement: {
        id: result.movement.id,
        type: result.movement.type,
        quantity: result.movement.quantity,
        reason: result.movement.reason,
        productId: result.movement.productId,
        createdAt: result.movement.createdAt,
      },
      productName: product.name,
      newStock: result.newStock,
    };
  }

  /**
   * Lista los movimientos de inventario de la organización (útil para historial).
   */
  async findByOrganization(
    organizationId: number,
    options?: { productId?: number; type?: MovementType; limit?: number },
  ) {
    const { productId, type, limit = 100 } = options ?? {};

    return this.prisma.inventoryMovement.findMany({
      where: {
        tenantId: organizationId,
        ...(productId != null && { productId }),
        ...(type != null && { type }),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      include: {
        product: { select: { id: true, name: true, sku: true } },
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
  }
}
