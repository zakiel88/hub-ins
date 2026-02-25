import { Module } from '@nestjs/common';
import { ColorwaysService } from './colorways.service';
import { ColorwaysController } from './colorways.controller';

@Module({
    controllers: [ColorwaysController],
    providers: [ColorwaysService],
    exports: [ColorwaysService],
})
export class ColorwaysModule { }
