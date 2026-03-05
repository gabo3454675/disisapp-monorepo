import { PartialType } from '@nestjs/mapped-types';
import { CreateTaxpayerDto } from './create-taxpayer.dto';

export class UpdateTaxpayerDto extends PartialType(CreateTaxpayerDto) {}

