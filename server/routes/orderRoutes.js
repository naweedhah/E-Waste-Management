import express from 'express';
import {
  createOrder,
  getMyOrders,
  getOrder,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  updateShippingAddress,
  updateOrderAddress,
  downloadOrderPDF,
  deleteOrder // ⬅️ ADDED
} from '../controllers/orderController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { requireVerified } from '../middleware/auth.js';
import * as s from '../validation/schemas.js';

const router = express.Router();

router.post('/', authenticateToken, authorize('customer'), requireVerified, validate({ body: s.createOrderBody }), createOrder);
router.get('/my', authenticateToken, authorize('customer'), getMyOrders);
router.get('/all/list', authenticateToken, authorize('admin', 'staff'), getAllOrders);
router.get('/:id', authenticateToken, validate({ params: s.idParams }), getOrder);
router.get('/:id/pdf', authenticateToken, validate({ params: s.idParams }), downloadOrderPDF);
router.patch('/:id/cancel', authenticateToken, authorize('customer'), validate({ params: s.idParams }), cancelOrder);
router.patch('/:id/address', authenticateToken, authorize('customer'), validate({ params: s.idParams, body: s.updateAddressBody }), updateShippingAddress);
router.patch('/:id/status', authenticateToken, authorize('admin', 'staff'), validate({ params: s.idParams, body: s.orderStatusBody }), updateOrderStatus);


router.delete('/:id', authenticateToken, authorize('admin', 'staff'), validate({ params: s.idParams }), deleteOrder);

export default router;