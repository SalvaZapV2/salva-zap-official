import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShopsService {
  constructor(private prisma: PrismaService) {}

  async create(ownerId: string, name: string) {
    return this.prisma.shop.create({
      data: {
        name,
        ownerId,
      },
    });
  }

  async findOne(id: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: {
        waba: true,
      },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    return shop;
  }

  async findByOwner(ownerId: string) {
    return this.prisma.shop.findMany({
      where: { ownerId },
      include: {
        waba: true,
      },
    });
  }

  async update(id: string, ownerId: string, updateData: { name?: string }) {
    // Verify shop exists and belongs to user
    const shop = await this.prisma.shop.findUnique({
      where: { id },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    if (shop.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have permission to update this shop');
    }

    // Update shop
    return this.prisma.shop.update({
      where: { id },
      data: updateData,
      include: {
        waba: true,
      },
    });
  }

  async remove(id: string, ownerId: string) {
    // Verify shop exists and belongs to user
    const shop = await this.prisma.shop.findUnique({
      where: { id },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    if (shop.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have permission to delete this shop');
    }

    // Delete shop (cascade will delete associated WABA accounts)
    await this.prisma.shop.delete({
      where: { id },
    });

    return { message: 'Shop deleted successfully' };
  }
}

