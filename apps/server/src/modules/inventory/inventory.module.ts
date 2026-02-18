import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryMovementsController } from './inventory-movements.controller';
import { InventoryMovementsService } from './inventory-movements.service';

@Module({
  controllers: [InventoryController, InventoryMovementsController],
  providers: [InventoryService, InventoryMovementsService],
  exports: [InventoryService, InventoryMovementsService],
})
export class InventoryModule {}
