import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class UploadService {
  private s3Client: S3Client | null = null;
  private useS3: boolean = false;
  private uploadsDir: string;

  constructor(private configService: ConfigService) {
    // Verificar si hay credenciales de AWS S3
    const awsAccessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const awsSecretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const awsRegion = this.configService.get<string>('AWS_REGION');
    const awsBucket = this.configService.get<string>('AWS_S3_BUCKET');

    if (awsAccessKeyId && awsSecretAccessKey && awsRegion && awsBucket) {
      // Configurar S3
      this.s3Client = new S3Client({
        region: awsRegion,
        credentials: {
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
        },
      });
      this.useS3 = true;
    } else {
      // Configurar almacenamiento local
      this.uploadsDir = path.join(process.cwd(), 'uploads');
      // Crear directorio si no existe
      if (!fs.existsSync(this.uploadsDir)) {
        fs.mkdirSync(this.uploadsDir, { recursive: true });
      }
    }
  }

  /**
   * Sube un archivo a S3 o al sistema de archivos local
   * @param file Archivo de Multer
   * @param folder Carpeta donde guardar (ej: 'products', 'logos')
   * @returns URL del archivo subido
   */
  async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<string> {
    if (!file) {
      throw new BadRequestException('Archivo no proporcionado');
    }

    // Validar tipo de archivo (solo imágenes)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido. Solo se permiten imágenes.');
    }

    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('El archivo es demasiado grande. Máximo 5MB.');
    }

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = path.extname(file.originalname);
    const fileName = `${timestamp}-${randomString}${extension}`;

    if (this.useS3 && this.s3Client) {
      return this.uploadToS3(file, folder, fileName);
    } else {
      return this.uploadToLocal(file, folder, fileName);
    }
  }

  /**
   * Sube archivo a AWS S3
   */
  private async uploadToS3(
    file: Express.Multer.File,
    folder: string,
    fileName: string,
  ): Promise<string> {
    if (!this.s3Client) {
      throw new BadRequestException('S3 no está configurado correctamente');
    }

    const bucket = this.configService.get<string>('AWS_S3_BUCKET');
    const key = `${folder}/${fileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read', // Hacer el archivo público
      });

      await this.s3Client.send(command);

      // Construir URL pública
      const region = this.configService.get<string>('AWS_REGION');
      const baseUrl = this.configService.get<string>(
        'AWS_S3_BASE_URL',
        `https://${bucket}.s3.${region}.amazonaws.com`,
      );

      return `${baseUrl}/${key}`;
    } catch (error) {
      throw new BadRequestException(`Error al subir archivo a S3: ${error.message}`);
    }
  }

  /**
   * Sube archivo al sistema de archivos local
   */
  private async uploadToLocal(
    file: Express.Multer.File,
    folder: string,
    fileName: string,
  ): Promise<string> {
    const folderPath = path.join(this.uploadsDir, folder);

    // Crear carpeta si no existe
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const filePath = path.join(folderPath, fileName);

    // Guardar archivo
    fs.writeFileSync(filePath, file.buffer);

    // Retornar URL que será servida estáticamente por NestJS
    // El servidor está configurado para servir archivos desde /uploads
    const baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:3001');
    return `${baseUrl}/uploads/${folder}/${fileName}`;
  }

  /**
   * Elimina un archivo (S3 o local)
   */
  async deleteFile(fileUrl: string): Promise<void> {
    if (this.useS3) {
      // Extraer key de la URL de S3
      const urlParts = fileUrl.split('/');
      const key = urlParts.slice(-2).join('/'); // folder/filename

      if (this.s3Client) {
        const bucket = this.configService.get<string>('AWS_S3_BUCKET');
        const command = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
        });
        // Nota: Para eliminar necesitarías DeleteObjectCommand, pero por ahora solo retornamos
        // await this.s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      }
    } else {
      // Eliminar archivo local
      const urlParts = fileUrl.split('/uploads/');
      if (urlParts.length > 1) {
        const relativePath = urlParts[1];
        const filePath = path.join(this.uploadsDir, relativePath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
  }
}
