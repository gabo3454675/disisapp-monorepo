import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { getCompanyIdFromOrganization } from '@/common/helpers/organization.helper';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async create(createInvoiceDto: CreateInvoiceDto, organizationId: number, sellerId: number) {
    const { items, customerId, notes } = createInvoiceDto;

    if (!items || items.length === 0) {
      throw new BadRequestException('La factura debe tener al menos un producto');
    }

    // Obtener companyId antes de la transacción (operación de lectura)
    const companyId = await getCompanyIdFromOrganization(this.prisma, organizationId);

    // Usar transacción para asegurar integridad de datos
    return await this.prisma.$transaction(async (tx) => {
      // 1. Verificar stock y obtener productos con precios actualizados
      const productIds = items.map((item) => item.productId);
      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
        },
      });

      if (products.length !== productIds.length) {
        throw new NotFoundException('Uno o más productos no fueron encontrados');
      }

      // 2. Verificar stock y calcular totales
      let totalAmount = 0;
      const invoiceItemsData = [];

      for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) {
          throw new NotFoundException(`Producto con ID ${item.productId} no encontrado`);
        }

        // Verificar stock
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para ${product.name}. Disponible: ${product.stock}, Solicitado: ${item.quantity}`,
          );
        }

        // Usar el precio actual del producto (no el enviado, por seguridad)
        const unitPrice = Number(product.salePrice);
        const subtotal = unitPrice * item.quantity;
        totalAmount += subtotal;

        invoiceItemsData.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice,
          subtotal,
        });

        // 3. Actualizar stock (decrementar)
        await tx.product.update({
          where: { id: product.id },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      // 4. Crear la factura

      // 5. Crear la factura con token público único
      const invoice = await tx.invoice.create({
        data: {
          companyId, // Requerido por el schema
          organizationId, // OBLIGATORIO: Inyectar organizationId del contexto (nunca del body)
          customerId: customerId || null,
          sellerId,
          totalAmount,
          status: 'PAID', // Por defecto PAID para ventas en POS
          paymentMethod: 'CASH', // Por defecto efectivo
          notes: notes || null,
          publicToken: uuidv4(), // Generar token único para acceso público
          items: {
            create: invoiceItemsData,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          customer: true,
        },
      });

      return invoice;
    });
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

    return new Promise(async (resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

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
    });
  }
}
