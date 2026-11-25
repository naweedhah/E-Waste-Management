import express from 'express';
import { createContactMessage, listContactMessages } from '../controllers/contactController.js';
import { authenticateToken } from '../middleware/auth.js';        // <-- add
import { authorize } from '../middleware/authorize.js';  
import { validate } from '../middleware/validate.js';
import * as s from '../validation/schemas.js';

const router = express.Router();

// Public submit (no auth required)
router.post('/', express.json(), validate({ body: s.contactBody }), createContactMessage);

router.get(
  '/',
  authenticateToken,
  authorize('admin'),
  listContactMessages
);

export default router;