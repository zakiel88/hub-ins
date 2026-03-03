import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { Roles } from '../auth/decorators';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

@Controller('api/v1/uploads')
export class UploadsController {
    @Post()
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
                filename: (_req, file, cb) => {
                    const ext = extname(file.originalname).toLowerCase();
                    const name = `${randomUUID()}${ext}`;
                    cb(null, name);
                },
            }),
            limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
            fileFilter: (_req, file, cb) => {
                const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
                if (allowedMimes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new BadRequestException('Only image files allowed (jpg, png, webp, gif, svg)'), false);
                }
            },
        }),
    )
    uploadFile(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('No file uploaded');
        return {
            url: `/uploads/${file.filename}`,
            filename: file.filename,
            size: file.size,
            mimetype: file.mimetype,
        };
    }
}
