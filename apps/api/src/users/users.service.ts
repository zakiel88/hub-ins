import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

const USER_SELECT = {
    id: true,
    email: true,
    fullName: true,
    phone: true,
    role: true,
    brandId: true,
    isActive: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    brand: { select: { id: true, name: true, code: true } },
};

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
    ) { }

    /** List all users (admin only) */
    async findAll() {
        return this.prisma.user.findMany({
            select: USER_SELECT,
            orderBy: { createdAt: 'desc' },
        });
    }

    /** Get single user by ID */
    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: USER_SELECT,
        });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    /** Create a new user */
    async create(data: {
        email: string;
        password: string;
        fullName: string;
        phone?: string;
        role: string;
        brandId?: string;
        sendInvite?: boolean;
    }) {
        const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
        if (existing) throw new ConflictException('Email already in use');

        const passwordHash = await bcrypt.hash(data.password, 10);
        const user = await this.prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                fullName: data.fullName,
                phone: data.phone || null,
                role: data.role,
                brandId: data.brandId || null,
            },
            select: USER_SELECT,
        });

        this.logger.log(`User created: ${user.email} (role: ${user.role})`);

        // Send welcome email with credentials
        if (data.sendInvite !== false) {
            await this.mailService.sendWelcomeEmail(data.email, data.fullName, data.password);
        }

        return user;
    }

    /** Admin updates user profile */
    async update(id: string, data: {
        fullName?: string;
        phone?: string | null;
        role?: string;
        brandId?: string | null;
    }) {
        await this.ensureExists(id);
        const user = await this.prisma.user.update({
            where: { id },
            data,
            select: USER_SELECT,
        });
        this.logger.log(`User updated: ${user.email}`);
        return user;
    }

    /** User updates own profile (name, phone) */
    async updateMyProfile(userId: string, data: { fullName?: string; phone?: string | null }) {
        await this.ensureExists(userId);
        return this.prisma.user.update({
            where: { id: userId },
            data,
            select: USER_SELECT,
        });
    }

    /** Admin changes a user's password */
    async changePassword(id: string, newPassword: string) {
        await this.ensureExists(id);
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({ where: { id }, data: { passwordHash } });
        this.logger.log(`Password changed for user: ${id}`);
    }

    /** User changes their own password */
    async changeMyPassword(userId: string, currentPassword: string, newPassword: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch) throw new ConflictException('Current password is incorrect');

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
        this.logger.log(`User changed own password: ${user.email}`);
    }

    /** Toggle user active status */
    async toggleActive(id: string) {
        const user = await this.ensureExists(id);
        const updated = await this.prisma.user.update({
            where: { id },
            data: { isActive: !user.isActive },
            select: { id: true, email: true, isActive: true },
        });
        this.logger.log(`User ${updated.isActive ? 'activated' : 'deactivated'}: ${updated.email}`);
        return updated;
    }

    private async ensureExists(id: string) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }
}
