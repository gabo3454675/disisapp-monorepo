import { Module } from '@nestjs/common';
import { VehicleInspectionsController } from './vehicle-inspections.controller';
import { VehicleInspectionsService } from './vehicle-inspections.service';

@Module({
  controllers: [VehicleInspectionsController],
  providers: [VehicleInspectionsService],
  exports: [VehicleInspectionsService],
})
export class VehicleInspectionsModule {}
