import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(organizationId: number): Promise<DashboardSummaryDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Suma de ventas del día (solo facturas pagadas)
    const invoicesToday = await this.prisma.invoice.aggregate({
      where: {
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
        status: 'PAID',
      },
      _sum: {
        totalAmount: true,
      },
    });

    const totalSalesToday = invoicesToday._sum.totalAmount
      ? Number(invoicesToday._sum.totalAmount)
      : 0;

    // Conteo total de productos
    const productsCount = await this.prisma.product.count({
      where: {
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
      },
    });

    // Productos con stock bajo
    // Obtenemos todos los productos y los filtramos en memoria
    // porque Prisma no soporta comparación directa de campos en WHERE
    const allProducts = await this.prisma.product.findMany({
      where: {
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
      },
      select: {
        stock: true,
        minStock: true,
      },
    });

    const lowStockProducts = allProducts.filter((product) => {
      const threshold = product.minStock || 5;
      return product.stock < threshold;
    });

    // Últimas 5 facturas
    const recentInvoices = await this.prisma.invoice.findMany({
      where: {
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
      },
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
      },
    });

    const recentTransactions = recentInvoices.map((invoice) => ({
      id: invoice.id,
      customerName: invoice.customer?.name || 'Cliente General',
      amount: Number(invoice.totalAmount),
      status: invoice.status,
      createdAt: invoice.createdAt,
    }));

    return {
      totalSalesToday,
      productsCount,
      lowStockCount: lowStockProducts.length,
      recentTransactions,
    };
  }
}
