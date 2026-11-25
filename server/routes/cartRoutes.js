import express from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
} from '../controllers/cartController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as s from '../validation/schemas.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getCart);
router.post('/', validate({ body: s.addToCartBody }), addToCart);
router.patch('/items/:productId', validate({ params: s.productIdParams, body: s.updateCartItemBody }), updateCartItem);
router.delete('/items/:productId', validate({ params: s.productIdParams }), removeFromCart);
router.delete('/', clearCart);

export default router;
