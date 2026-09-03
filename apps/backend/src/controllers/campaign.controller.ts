import { Request, Response } from 'express';
import { campaignService } from '../services/campaign.service';
import { CreateCampaignInput, GetCampaignsInput } from '../validators/campaign.validator';

export class CampaignController {
  async createCampaign(req: Request, res: Response) {
    const userId = req.user!.id;
    const body = req.body as CreateCampaignInput;

    const result = await campaignService.createCampaign({
      ...body,
      userId,
    });

    res.status(201).json({
      message: 'Campaign created successfully',
      data: result,
    });
  }

  async getCampaigns(req: Request, res: Response) {
    const userId = req.user!.id;
    const { page, limit } = req.query as unknown as GetCampaignsInput;

    const result = await campaignService.getCampaigns(userId, page, limit);

    res.json({
      data: result.campaigns,
      pagination: result.pagination,
    });
  }

  async getCampaignById(req: Request, res: Response) {
    const userId = req.user!.id;
    const { id } = req.params;

    const result = await campaignService.getCampaignById(id, userId);

    res.json({
      data: result,
    });
  }
}

export const campaignController = new CampaignController();
