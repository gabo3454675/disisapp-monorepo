import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Res,
  Header,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OrganizationGuard } from '@/common/guards/organization.guard';
import { ActiveOrganization } from '@/common/decorators/active-organization.decorator';
import { ActiveUser } from '@/common/decorators/active-user.decorator';

@Controller('invoices')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async create(
    @Body() createInvoiceDto: CreateInvoiceDto,
    @ActiveOrganization() organizationId: number,
    @ActiveUser() user: any,
  ) {
    return this.invoicesService.create(createInvoiceDto, organizationId, user.id);
  }

  @Get()
  async findAll(@ActiveOrganization() organizationId: number) {
    return this.invoicesService.findAll(organizationId);
  }

  /**
   * Obtiene facturas marcadas como pagadas por clientes (notificaciones)
   */
  @Get('client-marked-paid')
  async getClientMarkedAsPaid(@ActiveOrganization() organizationId: number) {
    return this.invoicesService.getClientMarkedAsPaid(organizationId);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @ActiveOrganization() organizationId: number,
  ) {
    const invoice = await this.invoicesService.findOne(id, organizationId);
    // Agregar URL pública si existe el token
    const invoiceWithToken = invoice as typeof invoice & { publicToken?: string };
    if (invoiceWithToken.publicToken) {
      const frontendUrl = this.configService.get<string>(
        'FRONTEND_URL',
        'http://localhost:3002',
      );
      return {
        ...invoice,
        publicUrl: `${frontendUrl}/pay/${invoiceWithToken.publicToken}`,
      };
    }
    return invoice;
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="factura.pdf"')
  async getPDF(
    @Param('id', ParseIntPipe) id: number,
    @ActiveOrganization() organizationId: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.invoicesService.generatePDF(id, organizationId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="factura-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  }
}
