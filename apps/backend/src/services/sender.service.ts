import { senderRepository } from '../repositories/sender.repository';
import { ConflictError, NotFoundError, ForbiddenError } from '../utils/errors';
import { Sender } from '../types';

export class SenderService {
  async createSender(
    userId: string,
    data: { name: string; email: string; provider?: string }
  ): Promise<Sender> {
    // Check if sender with this email already exists for user
    const existing = await senderRepository.findByUserIdAndEmail(userId, data.email);
    if (existing) {
      throw new ConflictError('Sender with this email already exists');
    }

    return senderRepository.create({
      userId,
      name: data.name,
      email: data.email,
      provider: data.provider || 'ethereal',
    });
  }

  async getSenders(userId: string): Promise<Sender[]> {
    return senderRepository.findByUserId(userId);
  }

  async getSenderById(senderId: string, userId: string): Promise<Sender> {
    const sender = await senderRepository.findById(senderId);
    
    if (!sender) {
      throw new NotFoundError('Sender not found');
    }

    if (sender.userId !== userId) {
      throw new ForbiddenError('Access denied');
    }

    return sender;
  }

  async updateSender(
    senderId: string,
    userId: string,
    data: Partial<Sender>
  ): Promise<Sender> {
    const sender = await this.getSenderById(senderId, userId);

    return senderRepository.update(sender.id, data);
  }

  async deleteSender(senderId: string, userId: string): Promise<void> {
    const sender = await this.getSenderById(senderId, userId);
    await senderRepository.delete(sender.id);
  }
}

export const senderService = new SenderService();
