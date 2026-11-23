import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateSmsPackageDto,
  UpdateSmsPackageDto,
} from './dto/sms-package.dto';

export interface DefaultPackageDef {
  name: string;
  credits: number;
  price: number;
  currency: string;
  description: string;
  displayOrder: number;
}

export const INITIAL_SMS_PACKAGES: DefaultPackageDef[] = [
  {
    name: 'Starter SMS',
    credits: 100,
    price: 250,
    currency: 'LKR',
    description: 'Perfect for small salons starting with e-bills and client notifications',
    displayOrder: 1,
  },
  {
    name: 'Growth SMS',
    credits: 500,
    price: 1150,
    currency: 'LKR',
    description: 'Popular choice for active salons sending regular booking confirmations and receipts',
    displayOrder: 2,
  },
  {
    name: 'Business SMS',
    credits: 1000,
    price: 2100,
    currency: 'LKR',
    description: 'Best value for high-volume salons and multi-branch operations',
    displayOrder: 3,
  },
];

@Injectable()
export class SmsPackagesService implements OnModuleInit {
  private readonly logger = new Logger(SmsPackagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultPackages().catch((err) => {
      this.logger.warn(`Could not verify default SMS packages: ${err.message || err}`);
    });
  }

  async seedDefaultPackages(): Promise<void> {
    const count = await this.prisma.smsPackage.count();
    if (count > 0) return;

    this.logger.log('Seeding initial SMS credit packages...');
    for (const pkg of INITIAL_SMS_PACKAGES) {
      await this.prisma.smsPackage.create({
        data: {
          name: pkg.name,
          credits: pkg.credits,
          price: pkg.price,
          currency: pkg.currency,
          description: pkg.description,
          displayOrder: pkg.displayOrder,
          isActive: true,
        },
      });
    }
    this.logger.log(`✓ Seeded ${INITIAL_SMS_PACKAGES.length} SMS packages.`);
  }

  /**
   * Returns active SMS packages available for purchase by salon owners.
   */
  async listActivePackages() {
    return this.prisma.smsPackage.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { credits: 'asc' }],
    });
  }

  async getActivePackages() {
    return this.listActivePackages();
  }

  /**
   * Returns all packages for Super Admin management (including inactive).
   */
  async listAllPackages() {
    return this.prisma.smsPackage.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });
  }

  async getAllPackages() {
    return this.listAllPackages();
  }

  async getPackageById(id: string) {
    const pkg = await this.prisma.smsPackage.findUnique({
      where: { id },
    });
    if (!pkg) {
      throw new NotFoundException(`SMS package with ID ${id} not found.`);
    }
    return pkg;
  }

  async createPackage(dto: CreateSmsPackageDto) {
    if (dto.credits <= 0) {
      throw new BadRequestException('Credits must be greater than zero.');
    }
    if (dto.price < 0) {
      throw new BadRequestException('Price cannot be negative.');
    }

    return this.prisma.smsPackage.create({
      data: {
        name: dto.name.trim(),
        credits: dto.credits,
        price: dto.price,
        currency: dto.currency?.toUpperCase() || 'LKR',
        description: dto.description?.trim() || null,
        isActive: dto.isActive ?? true,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
  }

  async updatePackage(id: string, dto: UpdateSmsPackageDto) {
    await this.getPackageById(id);

    if (dto.credits !== undefined && dto.credits <= 0) {
      throw new BadRequestException('Credits must be greater than zero.');
    }
    if (dto.price !== undefined && dto.price < 0) {
      throw new BadRequestException('Price cannot be negative.');
    }

    return this.prisma.smsPackage.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.credits !== undefined ? { credits: dto.credits } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.currency ? { currency: dto.currency.toUpperCase() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
      },
    });
  }

  async togglePackageStatus(id: string) {
    const pkg = await this.getPackageById(id);
    return this.prisma.smsPackage.update({
      where: { id },
      data: { isActive: !pkg.isActive },
    });
  }

  async deletePackage(id: string) {
    const pkg = await this.getPackageById(id);

    const transactionCount = await this.prisma.smsCreditTransaction.count({
      where: { packageId: id },
    });

    if (transactionCount > 0) {
      // Package has historical purchase records: soft-delete to preserve history!
      return this.prisma.smsPackage.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.smsPackage.delete({
      where: { id },
    });
  }
}
