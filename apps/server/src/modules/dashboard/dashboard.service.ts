import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Facturas pendientes (top 5) para widgets del dashboard.
   * Performance: take(5) obligatorio.
   */
  async getPendingInvoices(organizationId: number) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: 'PENDING',
      },
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        customer: {
          select: { name: true },
        },
      },
    });

    return invoices.map((inv) => ({
      id: inv.id,
      status: inv.status,
      createdAt: inv.createdAt,
      totalAmount: Number(inv.totalAmount),
      customerName: inv.customer?.name || 'Cliente General',
    }));
  }

  /**
   * Productos con stock bajo (top 5) para widgets del dashboard.
   * Performance: take(5) obligatorio.
   *
   * Nota: para que Prisma pueda filtrar en DB sin traer todo, usamos umbral fijo (< 5)
   * alineado con el requerimiento UX del dashboard.
   */
  async getLowStock(organizationId: number, threshold: number = 5) {
    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        stock: { lt: threshold },
      },
      take: 5,
      orderBy: [
        { stock: 'asc' }, // prioridad: más crítico primero
        { updatedAt: 'desc' },
      ],
      select: {
        id: true,
        sku: true,
        name: true,
        stock: true,
        minStock: true,
        updatedAt: true,
      },
    });

    return products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      stock: p.stock,
      minStock: p.minStock ?? 5,
      updatedAt: p.updatedAt,
    }));
  }

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

    // Productos con stock bajo (conteo)
    // Performance: conteo directo por umbral fijo para evitar traer todo a memoria.
    const lowStockCount = await this.prisma.product.count({
      where: {
        organizationId,
        stock: { lt: 5 },
      },
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
      lowStockCount,
      recentTransactions,
    };
  }
}
