import { Router } from 'express';
import { emailController } from '../controllers/email.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateQuery } from '../middleware/validate.middleware';
import { getEmailsSchema, searchEmailsSchema } from '../validators/email.validator';

const router = Router();

router.use(requireAuth);

router.get('/scheduled', validateQuery(getEmailsSchema), emailController.getScheduledEmails);
router.get('/sent', validateQuery(getEmailsSchema), emailController.getSentEmails);
router.get('/search', validateQuery(searchEmailsSchema), emailController.searchEmails);
router.get('/stats', emailController.getDashboardStats);
router.get('/queue-stats', emailController.getQueueStats);

export default router;
