import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { getCompanyIdFromOrganization } from '@/common/helpers/organization.helper';
import * as ExcelJS from 'exceljs';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Plantilla oficial del importador de inventario (headers exactos).
   * Mantener estos strings sincronizados con el parser de Excel.
   */
  static readonly INVENTORY_IMPORT_HEADERS = [
    'SKU',
    'Nombre del Producto',
    'Precio Venta',
    'Stock Inicial',
    'Descripción',
  ] as const;

  private static readonly HEADER_NOTES: Record<
    (typeof InventoryService.INVENTORY_IMPORT_HEADERS)[number],
    string
  > = {
    SKU: 'SKU: Obligatorio. Debe ser único por organización. Ej: ABC-001',
    'Nombre del Producto': 'Nombre del Producto: Obligatorio. Texto.',
    'Precio Venta': 'Precio Venta: Obligatorio. Solo números (ej: 10.50).',
    'Stock Inicial': 'Stock Inicial: Obligatorio. Entero >= 0.',
    Descripción: 'Descripción: Opcional. Texto libre.',
  };

  getTemplateFormat() {
    return {
      headers: [...InventoryService.INVENTORY_IMPORT_HEADERS],
      exampleRow: {
        SKU: 'ABC-001',
        'Nombre del Producto': 'Café 250g',
        'Precio Venta': 4.99,
        'Stock Inicial': 20,
        Descripción: 'Café molido, presentación 250g',
      },
      notes: [
        'La primera fila debe contener exactamente estos headers (mismos textos).',
        'SKU es obligatorio y debe ser único por organización.',
        'Precio Venta debe ser numérico (ej: 10.5).',
        'Stock Inicial debe ser entero >= 0.',
      ],
    };
  }

  /**
   * Genera un archivo Excel (.xlsx) de plantilla descargable.
   * Incluye:
   * - Headers exactos
   * - Notas/comentarios en cada header (requisito UX)
   * - Ancho de columnas legible
   * - Freeze de encabezados
   */
  async generateTemplateXlsxBuffer() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DISIS';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Inventario');

    // Header
    const headers = [...InventoryService.INVENTORY_IMPORT_HEADERS];
    worksheet.addRow(headers);

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Notas en headers (ExcelJS: cell.note)
    headers.forEach((header, idx) => {
      const cell = worksheet.getRow(1).getCell(idx + 1);
      cell.note = InventoryService.HEADER_NOTES[header];
    });

    // Fila de ejemplo (mismo orden de columnas)
    worksheet.addRow([
      'ABC-001',
      'Café 250g',
      4.99,
      20,
      'Café molido, presentación 250g',
    ]);

    // Anchos sugeridos
    worksheet.columns = [
      { key: 'sku', width: 18 },
      { key: 'name', width: 28 },
      { key: 'price', width: 14 },
      { key: 'stock', width: 14 },
      { key: 'desc', width: 40 },
    ];

    // Congelar headers
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Formatos básicos
    worksheet.getColumn(3).numFmt = '#,##0.00'; // Precio
    worksheet.getColumn(4).numFmt = '0'; // Stock

    return workbook.xlsx.writeBuffer();
  }

  async findAll(organizationId: number) {
    // Inventario = productos por organización
    return this.prisma.product.findMany({
      where: {
        organizationId, // OBLIGATORIO: aislamiento multi-tenant
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  private normalizeHeader(s: string) {
    return String(s ?? '').trim().toLowerCase();
  }

  private parseNumber(value: any): number {
    if (value === null || value === undefined || value === '') return NaN;
    if (typeof value === 'number') return value;
    const s = String(value).trim().replace(',', '.');
    return parseFloat(s);
  }

  private parseIntSafe(value: any): number {
    if (value === null || value === undefined || value === '') return NaN;
    if (typeof value === 'number') return Math.trunc(value);
    const s = String(value).trim();
    return parseInt(s, 10);
  }

  /**
   * Importación con "dry run".
   *
   * - confirm=false: valida + previsualiza (NO escribe en BD)
   * - confirm=true: ejecuta escritura solo si NO hay errores
   */
  async importFromExcelWithDryRun(params: {
    file: Express.Multer.File;
    organizationId: number;
    confirm?: boolean;
  }) {
    const { file, organizationId } = params;
    const confirm = params.confirm === true;

    if (!file || !file.buffer) {
      throw new BadRequestException('Archivo no válido');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('El archivo Excel no contiene hojas');
    }

    if (worksheet.rowCount < 2) {
      throw new BadRequestException(
        'El archivo Excel debe tener al menos una fila de datos (excluyendo encabezados)',
      );
    }

    // Validar headers
    const expected = [...InventoryService.INVENTORY_IMPORT_HEADERS];
    const headerRow = worksheet.getRow(1);
    const received: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= expected.length) {
        received.push(String(cell.value ?? '').trim());
      }
    });

    for (let i = 0; i < expected.length; i++) {
      if (this.normalizeHeader(received[i] || '') !== this.normalizeHeader(expected[i])) {
        throw new BadRequestException(
          `Formato inválido. Header columna ${i + 1} debe ser "${expected[i]}". ` +
            `Recibido: "${received[i] || ''}".`,
        );
      }
    }

    type PreviewRow = {
      rowNumber: number;
      sku: string;
      name: string;
      price: number;
      stock: number;
      description: string | null;
      action: 'create' | 'update' | 'skip';
    };

    const errors: Array<{ row: number; field?: string; message: string }> = [];
    const previewRowsRaw: Array<Omit<PreviewRow, 'action'>> = [];

    const seenSku = new Set<string>();

    // Columnas (1-based)
    const COL_SKU = 1;
    const COL_NAME = 2;
    const COL_PRICE = 3;
    const COL_STOCK = 4;
    const COL_DESC = 5;

    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);

      const sku = String(row.getCell(COL_SKU)?.value ?? '').trim();
      const name = String(row.getCell(COL_NAME)?.value ?? '').trim();
      const price = this.parseNumber(row.getCell(COL_PRICE)?.value);
      const stock = this.parseIntSafe(row.getCell(COL_STOCK)?.value);
      const description = String(row.getCell(COL_DESC)?.value ?? '').trim() || null;

      // Ignorar filas completamente vacías
      if (!sku && !name && (Number.isNaN(price) || price === 0) && (Number.isNaN(stock) || stock === 0) && !description) {
        continue;
      }

      if (!sku) {
        errors.push({ row: rowNum, field: 'SKU', message: 'SKU es requerido' });
        continue;
      }
      const skuKey = sku.toUpperCase();
      if (seenSku.has(skuKey)) {
        errors.push({
          row: rowNum,
          field: 'SKU',
          message: `SKU duplicado en el archivo: "${sku}"`,
        });
        continue;
      }
      seenSku.add(skuKey);

      if (!name) {
        errors.push({
          row: rowNum,
          field: 'Nombre del Producto',
          message: 'Nombre del Producto es requerido',
        });
        continue;
      }
      if (Number.isNaN(price) || price < 0) {
        errors.push({
          row: rowNum,
          field: 'Precio Venta',
          message: 'Precio Venta debe ser numérico y >= 0',
        });
        continue;
      }
      if (Number.isNaN(stock) || stock < 0) {
        errors.push({
          row: rowNum,
          field: 'Stock Inicial',
          message: 'Stock Inicial debe ser entero y >= 0',
        });
        continue;
      }

      previewRowsRaw.push({
        rowNumber: rowNum,
        sku,
        name,
        price,
        stock,
        description,
      });
    }

    // Para la UX: aunque haya errores, devolvemos preview de lo parseado válido.
    const skus = previewRowsRaw.map((r) => r.sku);
    const existing = skus.length
      ? await this.prisma.product.findMany({
          where: {
            organizationId,
            sku: { in: skus },
          },
          select: { sku: true, id: true },
        })
      : [];

    const existingSkuSet = new Set(
      existing.map((e) => (e.sku ? e.sku.toUpperCase() : '')).filter(Boolean),
    );

    const preview: PreviewRow[] = previewRowsRaw.map((r) => ({
      ...r,
      action: existingSkuSet.has(r.sku.toUpperCase()) ? 'update' : 'create',
    }));

    const summary = {
      toCreate: preview.filter((p) => p.action === 'create').length,
      toUpdate: preview.filter((p) => p.action === 'update').length,
    };

    // Modo previsualización: nunca escribir
    if (!confirm) {
      return {
        confirm: false,
        preview,
        errors,
        summary,
      };
    }

    // Modo ejecución: bloquear si hay errores
    if (errors.length) {
      throw new BadRequestException({
        message: 'El archivo contiene errores. Corrige y vuelve a intentar.',
        errors,
        summary,
      });
    }

    // Ejecutar transacción
    const companyId = await getCompanyIdFromOrganization(this.prisma, organizationId);

    const toCreate = preview.filter((p) => p.action === 'create');
    const toUpdate = preview.filter((p) => p.action === 'update');

    const result = await this.prisma.$transaction(async (tx) => {
      let createdCount = 0;
      if (toCreate.length) {
        const created = await tx.product.createMany({
          data: toCreate.map((r) => ({
            companyId,
            organizationId,
            sku: r.sku,
            name: r.name,
            description: r.description,
            salePrice: r.price as any,
            costPrice: 0 as any,
            stock: r.stock,
            minStock: 5,
          })),
        });
        createdCount = created.count;
      }

      // Updates por SKU (1 query por fila, dentro de la transacción)
      await Promise.all(
        toUpdate.map((r) =>
          tx.product.updateMany({
            where: { organizationId, sku: r.sku },
            data: {
              name: r.name,
              description: r.description,
              salePrice: r.price as any,
              stock: r.stock,
            },
          }),
        ),
      );

      return { created: createdCount, updated: toUpdate.length };
    });

    return {
      confirm: true,
      ...result,
      summary,
    };
  }

  /**
   * Import masivo desde Excel.
   *
   * Estrategia elegida para SKUs existentes:
   * - ACTUALIZAR (upsert por SKU): el Excel se toma como “fuente de verdad”.
   *   Se actualiza name/description/salePrice y el stock queda EXACTAMENTE como el del Excel.
   *
   * Motivo: en operaciones de carga masiva es más seguro evitar acumulaciones
   * involuntarias (increment) y mantener consistencia con el archivo.
   */
  async importFromExcel(file: Express.Multer.File, organizationId: number) {
    // Mantener compatibilidad: import directo ejecuta como confirm=true.
    return this.importFromExcelWithDryRun({ file, organizationId, confirm: true });
  }
}
