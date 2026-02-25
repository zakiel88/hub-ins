import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BrandsService {
    private readonly logger = new Logger(BrandsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    async findAll(params: {
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const skip = (page - 1) * limit;

        const where: any = {
            deletedAt: null,
        };

        if (params.status) {
            where.status = params.status;
        }

        if (params.search) {
            where.OR = [
                { name: { contains: params.search, mode: 'insensitive' } },
                { code: { contains: params.search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.brand.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: {
                            collections: true,
                            contracts: true,
                            users: true,
                        },
                    },
                    owner: {
                        select: { id: true, fullName: true, email: true },
                    },
                },
            }),
            this.prisma.brand.count({ where }),
        ]);

        return {
            data,
            meta: { page, limit, total },
        };
    }

    async findById(id: string) {
        const brand = await this.prisma.brand.findUnique({
            where: { id },
            include: {
                owner: {
                    select: { id: true, fullName: true, email: true },
                },
                contracts: {
                    orderBy: { createdAt: 'desc' },
                },
                brandContacts: {
                    orderBy: { isPrimary: 'desc' },
                },
                _count: {
                    select: {
                        collections: true,
                        users: true,
                    },
                },
            },
        });

        if (!brand || brand.deletedAt) {
            throw new NotFoundException('Brand not found');
        }

        return brand;
    }

    async create(
        data: {
            name: string;
            code: string;
            status?: string;
            website?: string;
            logoUrl?: string;
            notes?: string;
            ownerUserId?: string;
        },
        userId: string,
    ) {
        // Check unique code
        const existing = await this.prisma.brand.findUnique({
            where: { code: data.code.toUpperCase() },
        });
        if (existing) {
            throw new ConflictException(`Brand code '${data.code}' already exists`);
        }

        const brand = await this.prisma.brand.create({
            data: {
                name: data.name,
                code: data.code.toUpperCase(),
                status: data.status || 'onboarding',
                website: data.website,
                logoUrl: data.logoUrl,
                notes: data.notes,
                ownerUserId: data.ownerUserId,
            },
        });

        await this.audit.log({
            userId,
            action: 'brand.create',
            entityType: 'brand',
            entityId: brand.id,
            changes: { name: brand.name, code: brand.code, status: brand.status },
        });

        this.logger.log(`Brand created: ${brand.code} by user ${userId}`);
        return brand;
    }

    async update(
        id: string,
        data: {
            name?: string;
            website?: string;
            logoUrl?: string;
            notes?: string;
            ownerUserId?: string;
        },
        userId: string,
    ) {
        const existing = await this.findById(id);

        const brand = await this.prisma.brand.update({
            where: { id },
            data,
        });

        await this.audit.log({
            userId,
            action: 'brand.update',
            entityType: 'brand',
            entityId: id,
            changes: {
                before: { name: existing.name, website: existing.website },
                after: { name: brand.name, website: brand.website },
            },
        });

        return brand;
    }

    async updateStatus(id: string, status: string, userId: string) {
        const validStatuses = ['active', 'inactive', 'onboarding', 'suspended'];
        if (!validStatuses.includes(status)) {
            throw new BadRequestException(
                `Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`,
            );
        }

        const existing = await this.findById(id);
        const oldStatus = existing.status;

        // Validate state transitions per architecture doc
        const validTransitions: Record<string, string[]> = {
            onboarding: ['active', 'inactive'],
            active: ['suspended', 'inactive'],
            suspended: ['active', 'inactive'],
            inactive: ['onboarding'],
        };

        const allowed = validTransitions[oldStatus] || [];
        if (!allowed.includes(status)) {
            throw new BadRequestException(
                `Cannot transition from '${oldStatus}' to '${status}'. Allowed: ${allowed.join(', ')}`,
            );
        }

        const brand = await this.prisma.brand.update({
            where: { id },
            data: { status },
        });

        await this.audit.log({
            userId,
            action: 'brand.status_change',
            entityType: 'brand',
            entityId: id,
            changes: { from: oldStatus, to: status },
        });

        this.logger.log(`Brand ${brand.code} status: ${oldStatus} → ${status}`);
        return brand;
    }

    async softDelete(id: string, userId: string) {
        await this.findById(id);

        const brand = await this.prisma.brand.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        await this.audit.log({
            userId,
            action: 'brand.delete',
            entityType: 'brand',
            entityId: id,
        });

        return brand;
    }

    // ─── Contacts ─────────────────────────────
    // Schema field: BrandContact.name (not contactName)

    async findContacts(brandId: string) {
        await this.findById(brandId);
        return this.prisma.brandContact.findMany({
            where: { brandId },
            orderBy: { isPrimary: 'desc' },
        });
    }

    async createContact(
        brandId: string,
        data: {
            name: string;
            email?: string;
            phone?: string;
            role?: string;
            isPrimary?: boolean;
        },
        userId: string,
    ) {
        await this.findById(brandId);

        const contact = await this.prisma.brandContact.create({
            data: {
                brandId,
                name: data.name,
                email: data.email,
                phone: data.phone,
                role: data.role,
                isPrimary: data.isPrimary || false,
            },
        });

        await this.audit.log({
            userId,
            action: 'brand_contact.create',
            entityType: 'brand_contact',
            entityId: contact.id,
            changes: { brandId, name: data.name },
        });

        return contact;
    }

    async updateContact(
        brandId: string,
        contactId: string,
        data: {
            name?: string;
            email?: string;
            phone?: string;
            role?: string;
            isPrimary?: boolean;
        },
        userId: string,
    ) {
        await this.findById(brandId);

        const contact = await this.prisma.brandContact.update({
            where: { id: contactId },
            data,
        });

        await this.audit.log({
            userId,
            action: 'brand_contact.update',
            entityType: 'brand_contact',
            entityId: contactId,
        });

        return contact;
    }

    async deleteContact(brandId: string, contactId: string, userId: string) {
        await this.findById(brandId);

        await this.prisma.brandContact.delete({
            where: { id: contactId },
        });

        await this.audit.log({
            userId,
            action: 'brand_contact.delete',
            entityType: 'brand_contact',
            entityId: contactId,
        });
    }

    // ─── Contracts ────────────────────────────
    // Schema: Contract has type, terms, fileUrl, status.
    // No contractName or discountPct in schema.

    async findContracts(brandId: string) {
        await this.findById(brandId);
        return this.prisma.contract.findMany({
            where: { brandId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createContract(
        brandId: string,
        data: {
            type: string;
            startDate?: string;
            endDate?: string;
            terms?: string;
            fileUrl?: string;
            status?: string;
        },
        userId: string,
    ) {
        await this.findById(brandId);

        const contract = await this.prisma.contract.create({
            data: {
                brandId,
                type: data.type,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                endDate: data.endDate ? new Date(data.endDate) : undefined,
                terms: data.terms,
                fileUrl: data.fileUrl,
                status: data.status || 'draft',
            },
        });

        await this.audit.log({
            userId,
            action: 'contract.create',
            entityType: 'contract',
            entityId: contract.id,
            changes: { brandId, type: data.type },
        });

        return contract;
    }

    async updateContract(
        brandId: string,
        contractId: string,
        data: {
            type?: string;
            startDate?: string;
            endDate?: string;
            terms?: string;
            fileUrl?: string;
            status?: string;
        },
        userId: string,
    ) {
        await this.findById(brandId);

        const updateData: Record<string, unknown> = {};
        if (data.type !== undefined) updateData.type = data.type;
        if (data.terms !== undefined) updateData.terms = data.terms;
        if (data.fileUrl !== undefined) updateData.fileUrl = data.fileUrl;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
        if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);

        const contract = await this.prisma.contract.update({
            where: { id: contractId },
            data: updateData,
        });

        await this.audit.log({
            userId,
            action: 'contract.update',
            entityType: 'contract',
            entityId: contractId,
        });

        return contract;
    }
}
