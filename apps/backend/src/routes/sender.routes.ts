import { Router } from 'express';
import { senderController } from '../controllers/sender.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createSenderSchema } from '../validators/sender.validator';

const router = Router();

router.use(requireAuth);

router.post('/', validateBody(createSenderSchema), senderController.createSender);
router.get('/', senderController.getSenders);
router.get('/:id', senderController.getSenderById);
router.put('/:id', senderController.updateSender);
router.delete('/:id', senderController.deleteSender);

export default router;
