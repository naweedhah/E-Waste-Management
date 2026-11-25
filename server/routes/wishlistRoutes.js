import express from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlist
} from '../controllers/wishlistController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as s from '../validation/schemas.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getWishlist);
router.post('/', validate({ body: s.productIdParams }), addToWishlist);
router.delete('/:productId', validate({ params: s.productIdParams }), removeFromWishlist);
router.get('/check/:productId', validate({ params: s.productIdParams }), checkWishlist);

export default router;
