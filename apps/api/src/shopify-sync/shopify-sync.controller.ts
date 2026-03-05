import {
    Controller,
    Post,
    Get,
    Param,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ShopifySyncService } from './shopify-sync.service';
import { Roles } from '../auth/decorators';

@Controller('api/v1/sync')
export class ShopifySyncController {
    constructor(private readonly syncService: ShopifySyncService) { }

    @Post('import/:storeId')
    @Roles('admin', 'sourcing_procurement')
    async importProducts(@Param('storeId', ParseUUIDPipe) storeId: string) {
        const jobId = await this.syncService.importProducts(storeId);
        return { data: { jobId }, message: 'Import job started' };
    }

    @Post('metafields/:storeId')
    @Roles('admin', 'sourcing_procurement')
    async writeMetafields(@Param('storeId', ParseUUIDPipe) storeId: string) {
        const jobId = await this.syncService.writeMetafields(storeId);
        return { data: { jobId }, message: 'Metafields write job started' };
    }
}
