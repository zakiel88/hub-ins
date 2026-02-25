import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
    controllers: [InventoryController],
    providers: [InventoryService, PrismaService],
})
export class InventoryModule { }
