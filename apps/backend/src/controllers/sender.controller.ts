import { Request, Response } from 'express';
import { senderService } from '../services/sender.service';
import { CreateSenderInput } from '../validators/sender.validator';

export class SenderController {
  async createSender(req: Request<{}, {}, CreateSenderInput>, res: Response) {
    const userId = req.user!.id;
    const sender = await senderService.createSender(userId, req.body);

    res.status(201).json({
      message: 'Sender created successfully',
      data: sender,
    });
  }

  async getSenders(req: Request, res: Response) {
    const userId = req.user!.id;
    const senders = await senderService.getSenders(userId);

    res.json({
      data: senders,
    });
  }

  async getSenderById(req: Request, res: Response) {
    const userId = req.user!.id;
    const { id } = req.params;

    const sender = await senderService.getSenderById(id, userId);

    res.json({
      data: sender,
    });
  }

  async updateSender(req: Request, res: Response) {
    const userId = req.user!.id;
    const { id } = req.params;

    const sender = await senderService.updateSender(id, userId, req.body);

    res.json({
      message: 'Sender updated successfully',
      data: sender,
    });
  }

  async deleteSender(req: Request, res: Response) {
    const userId = req.user!.id;
    const { id } = req.params;

    await senderService.deleteSender(id, userId);

    res.json({
      message: 'Sender deleted successfully',
    });
  }
}

export const senderController = new SenderController();
