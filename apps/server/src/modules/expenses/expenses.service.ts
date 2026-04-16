import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { getCompanyIdFromOrganization } from '@/common/helpers/organization.helper';
import type { PurchaseLineDto } from './dto/purchase-line.dto';

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'object' && v !== null && 'toNumber' in v && typeof (v as { toNumber: () => number }).toNumber === 'function') {
    return (v as { toNumber: () => number }).toNumber();
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  /** Suma abonos; si no hay filas y el gasto está PAID (histórico), se considera pagado al 100 %. */
  computeAmountPaid(expense: {
    amount: unknown;
    status: string;
    payments?: { amount: unknown }[];
  }): number {
    const paySum = (expense.payments ?? []).reduce((s, p) => s + num(p.amount), 0);
    if (paySum === 0 && expense.status === 'PAID') return num(expense.amount);
    return paySum;
  }

  enrichExpense<T extends { amount: unknown; status: string; payments?: { amount: unknown }[] }>(expense: T) {
    const amount = num(expense.amount);
    const amountPaid = this.computeAmountPaid(expense);
    const balanceDue = Math.max(0, Math.round((amount - amountPaid) * 100) / 100);
    return {
      ...expense,
      amountPaid,
      balanceDue,
    };
  }

  async create(createExpenseDto: CreateExpenseDto, organizationId: number, userId: number) {
    const { purchaseLines, initialPayment, ...rest } = createExpenseDto;

    const category = await this.prisma.expenseCategory.findFirst({
      where: {
        id: createExpenseDto.categoryId,
        organizationId,
      },
    });

    if (!category) {
      throw new NotFoundException(
        `Categoría con ID ${createExpenseDto.categoryId} no encontrada`,
      );
    }

    if (createExpenseDto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: {
          id: createExpenseDto.supplierId,
          organizationId,
        },
      });

      if (!supplier) {
        throw new NotFoundException(
          `Proveedor con ID ${createExpenseDto.supplierId} no encontrado`,
        );
      }
    }

    if (purchaseLines?.length && !userId) {
      throw new BadRequestException('Se requiere usuario autenticado para cargar inventario desde la compra.');
    }

    if (initialPayment != null && initialPayment > 0) {
      const total = num(createExpenseDto.amount);
      if (initialPayment > total + 0.01) {
        throw new BadRequestException('El abono inicial no puede superar el monto del gasto.');
      }
    }

    const companyId = await getCompanyIdFromOrganization(this.prisma, organizationId);

    const expense = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          ...rest,
          companyId,
          date: new Date(createExpenseDto.date),
          organizationId,
          status: createExpenseDto.status || 'PENDING',
        },
        include: {
          supplier: true,
          category: true,
          payments: true,
        },
      });

      if (purchaseLines?.length) {
        await this.applyPurchaseLinesTx(tx, {
          expenseId: created.id,
          organizationId,
          userId,
          companyId,
          lines: purchaseLines,
        });
      }

      if (initialPayment != null && initialPayment > 0) {
        await tx.expensePayment.create({
          data: {
            organizationId,
            expenseId: created.id,
            amount: initialPayment,
            notes: 'Abono al registrar el gasto',
          },
        });
        const total = num(created.amount);
        const paid = initialPayment;
        await tx.expense.update({
          where: { id: created.id },
          data: {
            status: paid >= total - 0.01 ? 'PAID' : 'PENDING',
          },
        });
      }

      return tx.expense.findFirst({
        where: { id: created.id, organizationId },
        include: { supplier: true, category: true, payments: true },
      });
    });

    if (!expense) {
      throw new NotFoundException('No se pudo crear el gasto');
    }

    return this.enrichExpense(expense);
  }

  private async applyPurchaseLinesTx(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    params: {
      expenseId: number;
      organizationId: number;
      userId: number;
      companyId: number;
      lines: PurchaseLineDto[];
    },
  ) {
    const { expenseId, organizationId, userId, lines } = params;

    for (const line of lines) {
      const product = await tx.product.findFirst({
        where: { id: line.productId, organizationId },
      });
      if (!product) {
        throw new NotFoundException(`Producto ${line.productId} no encontrado en la organización`);
      }

      const unitCost = line.unitCostUsd ?? num(product.costPrice);
      const qty = line.quantity;

      await tx.inventoryMovement.create({
        data: {
          type: 'COMPRA',
          quantity: qty,
          reason: `Entrada por compra / factura proveedor (gasto #${expenseId})`,
          productId: line.productId,
          userId,
          tenantId: organizationId,
          unitCostAtTransaction: unitCost,
        },
      });

      await tx.product.update({
        where: { id: line.productId },
        data: {
          stock: { increment: qty },
          ...(line.unitCostUsd != null ? { costPrice: line.unitCostUsd } : {}),
        },
      });
    }
  }

  async findAll(organizationId: number) {
    const rows = await this.prisma.expense.findMany({
      where: {
        organizationId,
      },
      include: {
        supplier: true,
        category: true,
        payments: true,
      },
      orderBy: {
        date: 'desc',
      },
    });
    return rows.map((e) => this.enrichExpense(e));
  }

  async findOne(id: number, organizationId: number) {
    const expense = await this.prisma.expense.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        supplier: true,
        category: true,
        payments: true,
      },
    });

    if (!expense) {
      throw new NotFoundException(`Gasto con ID ${id} no encontrado`);
    }

    return this.enrichExpense(expense);
  }

  async registerPayment(
    id: number,
    organizationId: number,
    dto: { amount: number; notes?: string },
  ) {
    const expense = await this.findOne(id, organizationId);
    const total = num(expense.amount);
    const paid = this.computeAmountPaid(expense);
    const remaining = Math.max(0, total - paid);
    if (dto.amount > remaining + 0.01) {
      throw new BadRequestException(
        `El abono (${dto.amount.toFixed(2)}) supera el saldo pendiente (${remaining.toFixed(2)}).`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.expensePayment.create({
        data: {
          organizationId,
          expenseId: id,
          amount: dto.amount,
          notes: dto.notes ?? null,
        },
      });
      const after = paid + dto.amount;
      await tx.expense.update({
        where: { id },
        data: {
          status: after >= total - 0.01 ? 'PAID' : 'PENDING',
        },
      });
    });

    return this.findOne(id, organizationId);
  }

  /** Cuentas por pagar: gastos con saldo > 0 (proveedor / factura pendiente). */
  async listAccountsPayable(organizationId: number) {
    const rows = await this.findAll(organizationId);
    return rows.filter((e) => e.balanceDue > 0.01);
  }

  async update(id: number, updateExpenseDto: UpdateExpenseDto, organizationId: number) {
    await this.findOne(id, organizationId);

    if (updateExpenseDto.categoryId) {
      const category = await this.prisma.expenseCategory.findFirst({
        where: {
          id: updateExpenseDto.categoryId,
          organizationId,
        },
      });

      if (!category) {
        throw new NotFoundException(
          `Categoría con ID ${updateExpenseDto.categoryId} no encontrada`,
        );
      }
    }

    if (updateExpenseDto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: {
          id: updateExpenseDto.supplierId,
          organizationId,
        },
      });

      if (!supplier) {
        throw new NotFoundException(
          `Proveedor con ID ${updateExpenseDto.supplierId} no encontrado`,
        );
      }
    }

    const updateData: Record<string, unknown> = { ...updateExpenseDto };
    if (updateExpenseDto.date) {
      updateData.date = new Date(updateExpenseDto.date);
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: updateData as any,
      include: {
        supplier: true,
        category: true,
        payments: true,
      },
    });

    return this.enrichExpense(updated);
  }

  async remove(id: number, organizationId: number) {
    await this.findOne(id, organizationId);

    return this.prisma.expense.delete({
      where: { id },
    });
  }

  async getStats(organizationId: number) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const totalExpenses = await this.prisma.expense.aggregate({
      where: {
        organizationId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const expensesByCategory = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        organizationId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const categoryIds = expensesByCategory.map((e) => e.categoryId);
    const categories = await this.prisma.expenseCategory.findMany({
      where: {
        id: { in: categoryIds },
        organizationId,
      },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const inventoryCategory = await this.prisma.expenseCategory.findFirst({
      where: {
        organizationId,
        name: 'Inventario',
      },
    });

    let inventoryTotal = 0;
    if (inventoryCategory) {
      const inventoryExpenses = await this.prisma.expense.aggregate({
        where: {
          organizationId,
          categoryId: inventoryCategory.id,
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _sum: {
          amount: true,
        },
      });
      inventoryTotal = Number(inventoryExpenses._sum.amount || 0);
    }

    const operationalTotal = Number(totalExpenses._sum.amount || 0) - inventoryTotal;

    const categoryBreakdown = expensesByCategory.map((exp) => ({
      categoryId: exp.categoryId,
      categoryName: categoryMap.get(exp.categoryId) || 'Desconocida',
      amount: Number(exp._sum.amount || 0),
    }));

    return {
      totalMonth: Number(totalExpenses._sum.amount || 0),
      inventoryTotal,
      operationalTotal,
      categoryBreakdown,
    };
  }
}
