import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { getCompanyIdFromOrganization } from '@/common/helpers/organization.helper';
import { UploadService } from '@/common/services/upload.service';
import * as XLSX from 'xlsx';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  /**
   * Sube una imagen usando el servicio de upload (S3 o local)
   */
  async uploadImage(file: Express.Multer.File): Promise<string> {
    return this.uploadService.uploadFile(file, 'products');
  }

  async create(createProductDto: CreateProductDto, organizationId: number, imageUrl?: string) {
    // Verificar si el SKU ya existe en esta organización
    if (createProductDto.sku) {
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          organizationId,
          sku: createProductDto.sku,
        },
      });

      if (existingProduct) {
        throw new ConflictException('El SKU ya existe para esta organización');
      }
    }

    // Verificar si el código de barras ya existe en esta organización
    if (createProductDto.barcode) {
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          organizationId,
          barcode: createProductDto.barcode,
        },
      });

      if (existingProduct) {
        throw new ConflictException('El código de barras ya existe para esta organización');
      }
    }

    // Obtener companyId correspondiente a la organización
    const companyId = await getCompanyIdFromOrganization(this.prisma, organizationId);

    return this.prisma.product.create({
      data: {
        ...createProductDto,
        companyId, // Requerido por el schema
        organizationId,
        imageUrl: imageUrl || null,
        costPrice: createProductDto.costPrice ?? 0,
        stock: createProductDto.stock ?? 0,
        minStock: createProductDto.minStock ?? 5,
      },
    });
  }

  async findAll(organizationId: number) {
    return this.prisma.product.findMany({
      where: {
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number, organizationId: number) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
      },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto, organizationId: number) {
    // Verificar que el producto existe y pertenece a la organización
    const existingProduct = await this.findOne(id, organizationId);

    // Verificar SKU único si se está actualizando
    if (updateProductDto.sku && updateProductDto.sku !== existingProduct.sku) {
      const duplicateProduct = await this.prisma.product.findFirst({
        where: {
          organizationId,
          sku: updateProductDto.sku,
        },
      });

      if (duplicateProduct) {
        throw new ConflictException('El SKU ya existe para esta organización');
      }
    }

    // Verificar código de barras único si se está actualizando
    if (updateProductDto.barcode && updateProductDto.barcode !== existingProduct.barcode) {
      const duplicateProduct = await this.prisma.product.findFirst({
        where: {
          organizationId,
          barcode: updateProductDto.barcode,
        },
      });

      if (duplicateProduct) {
        throw new ConflictException('El código de barras ya existe para esta organización');
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
  }

  async remove(id: number, organizationId: number) {
    // Verificar que el producto existe y pertenece a la organización
    await this.findOne(id, organizationId);

    return this.prisma.product.delete({
      where: { id },
    });
  }

  async findByBarcode(barcode: string, organizationId: number) {
    const product = await this.prisma.product.findFirst({
      where: {
        barcode,
        organizationId, // OBLIGATORIO: Filtro por organización para aislamiento multi-tenant
      },
    });

    if (!product) {
      throw new NotFoundException(`Producto con código de barras ${barcode} no encontrado`);
    }

    return product;
  }

  async importFromExcel(file: Express.Multer.File, organizationId: number) {
    try {
      // Leer el archivo Excel
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (!data || data.length === 0) {
        throw new BadRequestException('El archivo Excel está vacío');
      }

      const results = {
        success: 0,
        errors: [] as string[],
        total: data.length,
      };

      // Procesar cada fila
      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        
        try {
          // Mapear columnas (case-insensitive)
          const nombre = row.Nombre || row.nombre || row.NOMBRE;
          const precio = row.Precio || row.precio || row.PRECIO || row['Precio de Venta'];
          const stock = row.Stock || row.stock || row.STOCK;
          const codigoBarras = row.CodigoBarras || row.codigoBarras || row['Código de Barras'] || row['Codigo de Barras'] || row['CODIGO_BARRAS'];

          if (!nombre) {
            results.errors.push(`Fila ${i + 2}: El nombre es requerido`);
            continue;
          }

          if (!precio || isNaN(parseFloat(precio))) {
            results.errors.push(`Fila ${i + 2}: El precio debe ser un número válido`);
            continue;
          }

          const productData: CreateProductDto = {
            name: String(nombre).trim(),
            salePrice: parseFloat(precio),
            stock: stock ? parseInt(String(stock)) : 0,
            barcode: codigoBarras ? String(codigoBarras).trim() : undefined,
            costPrice: 0,
            minStock: 5,
          };

          // Crear producto (el servicio maneja validaciones de SKU/barcode)
          try {
            await this.create(productData, organizationId);
            results.success++;
          } catch (error: any) {
            if (error instanceof ConflictException) {
              results.errors.push(`Fila ${i + 2}: ${error.message}`);
            } else {
              results.errors.push(`Fila ${i + 2}: Error al crear producto - ${error.message}`);
            }
          }
        } catch (error: any) {
          results.errors.push(`Fila ${i + 2}: Error de formato - ${error.message}`);
        }
      }

      return results;
    } catch (error: any) {
      throw new BadRequestException(`Error al procesar el archivo Excel: ${error.message}`);
    }
  }
}
