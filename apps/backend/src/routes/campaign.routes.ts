import { Router } from 'express';
import { campaignController } from '../controllers/campaign.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody, validateQuery } from '../middleware/validate.middleware';
import { createCampaignSchema, getCampaignsSchema } from '../validators/campaign.validator';

const router = Router();

router.use(requireAuth);

router.post('/', validateBody(createCampaignSchema), campaignController.createCampaign);
router.get('/', validateQuery(getCampaignsSchema), campaignController.getCampaigns);
router.get('/:id', campaignController.getCampaignById);

export default router;
