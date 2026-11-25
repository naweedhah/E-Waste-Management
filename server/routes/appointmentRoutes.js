import express from 'express';
import {
  createAppointment,
  getMyAppointments,
  getAppointment,
  cancelAppointment,
  updateAppointment,
  getAllAppointments,
  updateAppointmentStatus,
  downloadAppointmentsReportPDF,
  deleteAppointment // ⬅️ ADDED
} from '../controllers/appointmentController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { requireVerified } from '../middleware/auth.js';
import * as s from '../validation/schemas.js';

const router = express.Router();

router.post('/', authenticateToken, authorize('customer'), requireVerified, validate({ body: s.createAppointmentBody }), createAppointment);
router.get('/my', authenticateToken, authorize('customer'), getMyAppointments);
router.get('/all/list', authenticateToken, authorize('admin', 'staff'), getAllAppointments);
router.get('/report/pdf', authenticateToken, authorize('admin', 'staff'), downloadAppointmentsReportPDF);
router.get('/:id', authenticateToken, validate({ params: s.idParams }), getAppointment);
router.patch('/:id', authenticateToken, authorize('customer'), validate({ params: s.idParams, body: s.createAppointmentBody.partial() }), updateAppointment);
router.patch('/:id/cancel', authenticateToken, authorize('customer'), validate({ params: s.idParams }), cancelAppointment);
router.patch('/:id/status', authenticateToken, authorize('admin', 'staff'), validate({ params: s.idParams }), updateAppointmentStatus);


router.delete('/:id', authenticateToken, authorize('admin', 'staff'), validate({ params: s.idParams }), deleteAppointment);

export default router;