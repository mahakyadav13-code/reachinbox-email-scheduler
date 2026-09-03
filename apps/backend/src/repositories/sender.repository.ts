import { prisma } from '../config/database';
import { Sender } from '../types';

export class SenderRepository {
  async findById(id: string): Promise<Sender | null> {
    return prisma.sender.findUnique({ where: { id } });
  }

  async findByUserId(userId: string): Promise<Sender[]> {
    return prisma.sender.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUserIdAndEmail(userId: string, email: string): Promise<Sender | null> {
    return prisma.sender.findUnique({
      where: {
        userId_email: { userId, email },
      },
    });
  }

  async create(data: {
    userId: string;
    name: string;
    email: string;
    provider?: string;
  }): Promise<Sender> {
    return prisma.sender.create({ data });
  }

  async update(id: string, data: Partial<Sender>): Promise<Sender> {
    return prisma.sender.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.sender.delete({ where: { id } });
  }
}

export const senderRepository = new SenderRepository();
