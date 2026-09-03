import { Router } from 'express';
import { slackController } from '../controllers/slack.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/connect', slackController.connect);
router.get('/callback', slackController.callback);
router.delete('/disconnect', slackController.disconnect);
router.get('/status', slackController.getStatus);

export default router;
