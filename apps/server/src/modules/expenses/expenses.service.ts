import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { getCompanyIdFromOrganization } from '@/common/helpers/organization.helper';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(createExpenseDto: CreateExpenseDto, organizationId: number) {
    // Verificar que la categoría existe y pertenece a la organización
    const category = await this.prisma.expenseCategory.findFirst({
      where: {
        id: createExpenseDto.categoryId,
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
      },
    });

    if (!category) {
      throw new NotFoundException(
        `Categoría con ID ${createExpenseDto.categoryId} no encontrada`,
      );
    }

    // Verificar que el proveedor existe si se proporciona
    if (createExpenseDto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: {
          id: createExpenseDto.supplierId,
          organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
        },
      });

      if (!supplier) {
        throw new NotFoundException(
          `Proveedor con ID ${createExpenseDto.supplierId} no encontrado`,
        );
      }
    }

    // Obtener companyId correspondiente a la organización
    const companyId = await getCompanyIdFromOrganization(this.prisma, organizationId);

    return this.prisma.expense.create({
      data: {
        ...createExpenseDto,
        companyId, // Requerido por el schema
        date: new Date(createExpenseDto.date),
        organizationId, // OBLIGATORIO: Inyectar organizationId del contexto (nunca del body)
        status: createExpenseDto.status || 'PENDING',
      },
      include: {
        supplier: true,
        category: true,
      },
    });
  }

  async findAll(organizationId: number) {
    return this.prisma.expense.findMany({
      where: {
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
      },
      include: {
        supplier: true,
        category: true,
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  async findOne(id: number, organizationId: number) {
    const expense = await this.prisma.expense.findFirst({
      where: {
        id,
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
      },
      include: {
        supplier: true,
        category: true,
      },
    });

    if (!expense) {
      throw new NotFoundException(`Gasto con ID ${id} no encontrado`);
    }

    return expense;
  }

  async update(id: number, updateExpenseDto: UpdateExpenseDto, organizationId: number) {
    await this.findOne(id, organizationId);

    // Verificar categoría si se actualiza
    if (updateExpenseDto.categoryId) {
      const category = await this.prisma.expenseCategory.findFirst({
        where: {
          id: updateExpenseDto.categoryId,
          organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
        },
      });

      if (!category) {
        throw new NotFoundException(
          `Categoría con ID ${updateExpenseDto.categoryId} no encontrada`,
        );
      }
    }

    // Verificar proveedor si se actualiza
    if (updateExpenseDto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: {
          id: updateExpenseDto.supplierId,
          organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
        },
      });

      if (!supplier) {
        throw new NotFoundException(
          `Proveedor con ID ${updateExpenseDto.supplierId} no encontrado`,
        );
      }
    }

    const updateData: any = { ...updateExpenseDto };
    if (updateExpenseDto.date) {
      updateData.date = new Date(updateExpenseDto.date);
    }

    return this.prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
        category: true,
      },
    });
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

    // Total gastado en el mes actual
    const totalExpenses = await this.prisma.expense.aggregate({
      where: {
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Gastos por categoría en el mes actual
    const expensesByCategory = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Obtener nombres de categorías
    const categoryIds = expensesByCategory.map((e) => e.categoryId);
    const categories = await this.prisma.expenseCategory.findMany({
      where: {
        id: { in: categoryIds },
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
      },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    // Calcular total de inventario (categoría "Inventario")
    const inventoryCategory = await this.prisma.expenseCategory.findFirst({
      where: {
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
        name: 'Inventario',
      },
    });

    let inventoryTotal = 0;
    if (inventoryCategory) {
      const inventoryExpenses = await this.prisma.expense.aggregate({
        where: {
          organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
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

    // Calcular total de gastos operativos (todo excepto inventario)
    const operationalTotal = Number(totalExpenses._sum.amount || 0) - inventoryTotal;

    // Preparar datos para gráficos
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
