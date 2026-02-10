import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { getCompanyIdFromOrganization } from '@/common/helpers/organization.helper';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';
import { CreditsService } from '@/modules/credits/credits.service';
import { TasksService } from '@/modules/tasks/tasks.service';
import { TaskPriority } from '@prisma/client';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private creditsService: CreditsService,
    private tasksService: TasksService,
  ) {}

  async create(createInvoiceDto: CreateInvoiceDto, organizationId: number, sellerId: number) {
    const { items, customerId, notes, paymentMethod: paymentMethodDto } = createInvoiceDto;
    const isCredit = paymentMethodDto?.toUpperCase() === 'CREDIT';

    if (!items || items.length === 0) {
      throw new BadRequestException('La factura debe tener al menos un producto');
    }
    if (isCredit && !customerId) {
      throw new BadRequestException('Para venta a crédito debe seleccionar un cliente');
    }

    const companyId = await getCompanyIdFromOrganization(this.prisma, organizationId);

    const invoice = await this.prisma.$transaction(async (tx) => {
      const productIds = items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, organizationId },
      });

      if (products.length !== productIds.length) {
        throw new NotFoundException('Uno o más productos no fueron encontrados');
      }

      let totalAmount = 0;
      const invoiceItemsData = [];

      for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) {
          throw new NotFoundException(`Producto con ID ${item.productId} no encontrado`);
        }
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para ${product.name}. Disponible: ${product.stock}, Solicitado: ${item.quantity}`,
          );
        }

        const unitPrice = Number(product.salePrice);
        const subtotal = unitPrice * item.quantity;
        totalAmount += subtotal;

        invoiceItemsData.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice,
          subtotal,
        });

        await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: item.quantity } },
        });
      }

      if (isCredit) {
        const credit = await this.creditsService.getOrCreateCredit(customerId!, organizationId);
        const available = Number(credit.limitAmount) - Number(credit.currentBalance);
        if (credit.status !== 'ACTIVE') {
          throw new BadRequestException('El crédito del cliente está suspendido');
        }
        if (available < totalAmount) {
          throw new BadRequestException(
            `Límite de crédito insuficiente. Disponible: $${available.toFixed(2)}, Total: $${totalAmount.toFixed(2)}`,
          );
        }
      }

      const paymentMethod = isCredit ? 'CREDIT' : (paymentMethodDto && ['CASH', 'ZELLE', 'CARD', 'CREDIT'].includes(String(paymentMethodDto).toUpperCase()) ? String(paymentMethodDto).toUpperCase() : 'CASH');
      const paymentStatus = isCredit ? PaymentStatus.pending_credit : PaymentStatus.paid;

      return tx.invoice.create({
        data: {
          companyId,
          organizationId,
          customerId: customerId || null,
          sellerId,
          totalAmount,
          status: 'PAID',
          paymentMethod,
          paymentStatus,
          notes: notes || null,
          publicToken: uuidv4(),
          items: { create: invoiceItemsData },
        },
        include: {
          items: { include: { product: true } },
          customer: true,
        },
      });
    });

    if (isCredit && customerId && invoice) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { exchangeRate: true },
      });
      const exchangeRate = Number(org?.exchangeRate ?? 1);
      const amountBs = Number(invoice.totalAmount) * exchangeRate;

      await this.creditsService.chargeForInvoice(
        customerId,
        organizationId,
        invoice.id,
        Number(invoice.totalAmount),
        amountBs,
        exchangeRate,
      );

      const credit = await this.creditsService.getOrCreateCredit(customerId, organizationId);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (credit.creditDueDays ?? 30));
      const customerName = invoice.customer?.name ?? 'Cliente';

      await this.tasksService.create(
        {
          title: `Cobro: Factura #${invoice.id} - ${customerName}`,
          description: `Monto adeudado: $${Number(invoice.totalAmount).toFixed(2)}. Factura a crédito.`,
          assignedToId: sellerId,
          invoiceId: invoice.id,
          priority: TaskPriority.HIGH,
          category: 'COBRANZA',
          dueDate: dueDate.toISOString(),
        },
        organizationId,
        sellerId,
      );
    }

    return this.prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
    })!;
  }

  async findAll(organizationId: number) {
    return this.prisma.invoice.findMany({
      where: {
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Obtiene facturas marcadas como pagadas por clientes (para notificaciones)
   */
  async getClientMarkedAsPaid(organizationId: number, limit: number = 10) {
    return this.prisma.invoice.findMany({
      where: {
        organizationId,
        markedAsPaidByClient: true,
      },
      include: {
        customer: true,
        company: true,
      },
      orderBy: {
        markedAsPaidAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Borra todo el historial de ventas/facturación de la organización actual.
   * Solo super_admin. Para dejar el sistema en cero durante el desarrollo.
   */
  async clearTestData(organizationId: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });
    if (!user?.isSuperAdmin) {
      throw new ForbiddenException(
        'Solo el Super Admin puede borrar el historial de ventas',
      );
    }

    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId },
      select: { id: true },
    });
    const invoiceIds = invoices.map((i) => i.id);
    if (invoiceIds.length === 0) {
      return { message: 'No hay facturas para eliminar', deleted: 0 };
    }

    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { invoiceId: { in: invoiceIds } },
        data: { invoiceId: null },
      }),
      this.prisma.invoiceItem.deleteMany({
        where: { invoiceId: { in: invoiceIds } },
      }),
      this.prisma.invoice.deleteMany({ where: { organizationId } }),
    ]);

    return {
      message: 'Historial de ventas/facturación eliminado correctamente',
      deleted: invoiceIds.length,
    };
  }

  /**
   * Elimina una factura. Solo permitido para super_admin.
   */
  async remove(id: number, organizationId: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });
    if (!user?.isSuperAdmin) {
      throw new ForbiddenException('Solo el Super Admin puede eliminar facturas');
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
    });
    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${id} no encontrada`);
    }

    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { invoiceId: id },
        data: { invoiceId: null },
      }),
      this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } }),
      this.prisma.invoice.delete({ where: { id } }),
    ]);

    return { message: 'Factura eliminada correctamente' };
  }

  async findOne(id: number, organizationId: number) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
      },
      select: {
        id: true,
        companyId: true,
        organizationId: true,
        customerId: true,
        sellerId: true,
        totalAmount: true,
        status: true,
        paymentMethod: true,
        notes: true,
        pdfUrl: true,
        publicToken: true, // Incluir publicToken
        createdAt: true,
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        company: true,
        seller: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${id} no encontrada`);
    }

    return invoice;
  }

  /**
   * Obtiene una factura por su token público (sin autenticación)
   * Incrementa el contador de vistas automáticamente
   */
  async findByPublicToken(token: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: {
        publicToken: token,
      },
      select: {
        id: true,
        companyId: true,
        organizationId: true,
        customerId: true,
        sellerId: true,
        totalAmount: true,
        status: true,
        paymentMethod: true,
        notes: true,
        pdfUrl: true,
        publicToken: true,
        markedAsPaidByClient: true,
        markedAsPaidAt: true,
        markedAsPaidBy: true,
        viewCount: true,
        lastViewedAt: true,
        createdAt: true,
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        company: true,
        organization: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            plan: true,
          },
        },
        seller: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada o enlace inválido');
    }

    // Incrementar contador de vistas de forma asíncrona (no bloquea la respuesta)
    this.incrementViewCount(invoice.id).catch((err) => {
      console.error('Error al incrementar contador de vistas:', err);
    });

    return invoice;
  }

  /**
   * Incrementa el contador de vistas de una factura
   */
  private async incrementViewCount(invoiceId: number) {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        viewCount: {
          increment: 1,
        },
        lastViewedAt: new Date(),
      },
    });
  }

  /**
   * Marca una factura como pagada desde el link público
   * @param token Token público de la factura
   * @param markedBy Nombre/email de quien marca como pagada (opcional)
   */
  async markAsPaidByClient(token: string, markedBy?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { publicToken: token },
      include: {
        organization: true,
        seller: true,
        customer: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Factura no encontrada o enlace inválido');
    }

    if (invoice.markedAsPaidByClient) {
      throw new BadRequestException('Esta factura ya fue marcada como pagada');
    }

    // Actualizar la factura
    const updatedInvoice = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        markedAsPaidByClient: true,
        markedAsPaidAt: new Date(),
        markedAsPaidBy: markedBy || invoice.customer?.name || 'Cliente',
        status: 'PAID', // También actualizar el status general
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        company: true,
        organization: true,
        seller: true,
      },
    });

    // Aquí podrías agregar lógica para enviar notificaciones
    // Por ejemplo: enviar email al vendedor, crear notificación en el sistema, etc.

    return updatedInvoice;
  }

  async generatePDF(id: number, organizationId: number): Promise<Buffer> {
    const invoice = await this.findOne(id, organizationId);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        } catch (e) {
          reject(e);
        }
      });
      doc.on('error', (err) => {
        if (typeof (doc as any).destroy === 'function') (doc as any).destroy();
        reject(err);
      });

      try {
      // Configuración de colores
      const primaryColor = '#1e40af';
      const textColor = '#1f2937';
      const borderColor = '#e5e7eb';

      // Logo de la organización (arriba izquierda)
      let logoY = 50;
      const logoSize = 60;
      const logoX = 50;
      let logoLoaded = false;

      if (invoice.company.logoUrl) {
        try {
          const fs = require('fs');
          const path = require('path');
          let imagePath: string | null = null;

          // Determinar la ruta del archivo según el tipo de URL
          if (invoice.company.logoUrl.startsWith('http')) {
            // URL remota (S3 u otro servicio)
            // PDFKit puede cargar desde URL directamente
            imagePath = invoice.company.logoUrl;
          } else if (invoice.company.logoUrl.includes('/uploads/')) {
            // URL local que contiene /uploads/
            const logoPath = invoice.company.logoUrl.split('/uploads/')[1];
            const fullPath = path.join(process.cwd(), 'uploads', logoPath);
            if (fs.existsSync(fullPath)) {
              imagePath = fullPath;
            }
          }

          // Intentar cargar la imagen
          if (imagePath) {
            doc.image(imagePath, logoX, logoY, {
              width: logoSize,
              height: logoSize,
              fit: [logoSize, logoSize],
            });
            logoLoaded = true;
          }
        } catch (error) {
          // Si falla la carga del logo, continuar sin él
          console.warn('No se pudo cargar el logo:', error.message);
        }
      }

      // Nombre de la empresa (a la derecha del logo si existe, o solo texto)
      const companyNameX = logoLoaded ? logoX + logoSize + 15 : logoX;
      const companyInfoY = logoY;
      
      doc
        .fontSize(24)
        .fillColor(primaryColor)
        .text(invoice.company.name || 'Mi Empresa', companyNameX, companyInfoY, { align: 'left' });

      let infoY = companyInfoY + 30;
      if (invoice.company.taxId) {
        doc
          .fontSize(10)
          .fillColor(textColor)
          .text(`RIF: ${invoice.company.taxId}`, companyNameX, infoY);
        infoY += 15;
      }

      if (invoice.company.address) {
        doc
          .fontSize(10)
          .fillColor(textColor)
          .text(invoice.company.address, companyNameX, infoY);
        infoY += 15;
      }

      // Título Factura (arriba derecha)
      const invoiceTitleY = logoLoaded ? logoY + 10 : logoY;
      doc
        .fontSize(18)
        .fillColor(primaryColor)
        .text('FACTURA', 400, invoiceTitleY, { align: 'right' });

      doc
        .fontSize(10)
        .fillColor(textColor)
        .text(`Factura #${invoice.id}`, 400, invoiceTitleY + 25, { align: 'right' });

      doc
        .fontSize(10)
        .fillColor(textColor)
        .text(
          `Fecha: ${new Date(invoice.createdAt).toLocaleDateString('es-VE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}`,
          400,
          invoiceTitleY + 40,
          { align: 'right' },
        );

      // Línea separadora (ajustar según altura del logo)
      const separatorY = Math.max(logoY + logoSize + 20, infoY + 10);
      doc
        .moveTo(50, separatorY)
        .lineTo(550, separatorY)
        .strokeColor(borderColor)
        .lineWidth(1)
        .stroke();

      // Datos del Cliente (después de la línea separadora)
      const clientY = separatorY + 20;
      doc
        .fontSize(12)
        .fillColor(primaryColor)
        .text('DATOS DEL CLIENTE', 50, clientY);

      const customerName = invoice.customer?.name || 'Cliente General';
      const customerTaxId = invoice.customer?.taxId || 'N/A';
      const customerAddress = invoice.customer?.address || 'N/A';

      doc
        .fontSize(10)
        .fillColor(textColor)
        .text(`Nombre: ${customerName}`, 50, clientY + 20);

      doc
        .fontSize(10)
        .fillColor(textColor)
        .text(`Documento: ${customerTaxId}`, 50, clientY + 35);

      doc
        .fontSize(10)
        .fillColor(textColor)
        .text(`Dirección: ${customerAddress}`, 50, clientY + 50);

      // Tabla de Items
      const tableTop = clientY + 90;
      const itemHeight = 25;
      let currentY = tableTop;

      // Encabezado de tabla
      doc
        .fontSize(10)
        .fillColor(primaryColor)
        .text('Cant.', 50, currentY, { width: 60, align: 'left' })
        .text('Descripción', 110, currentY, { width: 250, align: 'left' })
        .text('P. Unit.', 360, currentY, { width: 80, align: 'right' })
        .text('Total', 440, currentY, { width: 110, align: 'right' });

      currentY += 15;
      doc
        .moveTo(50, currentY)
        .lineTo(550, currentY)
        .strokeColor(borderColor)
        .lineWidth(1)
        .stroke();

      currentY += 10;

      // Items
      invoice.items.forEach((item) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        const productName = item.product.name;
        const quantity = item.quantity.toString();
        const unitPrice = Number(item.unitPrice).toFixed(2);
        const subtotal = Number(item.subtotal).toFixed(2);

        doc
          .fontSize(9)
          .fillColor(textColor)
          .text(quantity, 50, currentY, { width: 60, align: 'left' })
          .text(productName, 110, currentY, { width: 250, align: 'left' })
          .text(unitPrice, 360, currentY, { width: 80, align: 'right' })
          .text(subtotal, 440, currentY, { width: 110, align: 'right' });

        currentY += itemHeight;
      });

      // Línea final de tabla
      doc
        .moveTo(50, currentY)
        .lineTo(550, currentY)
        .strokeColor(borderColor)
        .lineWidth(1)
        .stroke();

      currentY += 20;

      // Totales
      const subtotal = Number(invoice.totalAmount);
      const tax = 0; // Sin impuestos por ahora
      const total = subtotal + tax;

      const totalsX = 350;

      doc
        .fontSize(10)
        .fillColor(textColor)
        .text('Subtotal:', totalsX, currentY, { width: 100, align: 'right' })
        .text(subtotal.toFixed(2), 450, currentY, { width: 100, align: 'right' });

      currentY += 15;

      doc
        .fontSize(10)
        .fillColor(textColor)
        .text('Impuestos:', totalsX, currentY, { width: 100, align: 'right' })
        .text(tax.toFixed(2), 450, currentY, { width: 100, align: 'right' });

      currentY += 20;

      // Total en grande
      doc
        .moveTo(totalsX, currentY)
        .lineTo(550, currentY)
        .strokeColor(primaryColor)
        .lineWidth(2)
        .stroke();

      currentY += 10;

      doc
        .fontSize(14)
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .text('TOTAL:', totalsX, currentY, { width: 100, align: 'right' })
        .text(total.toFixed(2), 450, currentY, { width: 100, align: 'right' });

      // Pie de página
      const footerY = 750;
      doc
        .fontSize(10)
        .fillColor(textColor)
        .font('Helvetica')
        .text('Gracias por su compra', 50, footerY, { align: 'center', width: 500 });

      doc
        .fontSize(8)
        .fillColor('#9ca3af')
        .text(
          `Generado el ${new Date().toLocaleDateString('es-VE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}`,
          50,
          footerY + 15,
          { align: 'center', width: 500 },
        );

      doc.end();
      } catch (err) {
        if (typeof (doc as any).destroy === 'function') (doc as any).destroy();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
}
