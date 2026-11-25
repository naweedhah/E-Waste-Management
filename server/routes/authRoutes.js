// server/routes/authRoutes.js
import express from 'express';
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  verifyOTP,
  resendOTP,
  logout,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { loginLimiter, otpLimiter, emailSendLimiter } from '../middleware/rateLimit.js';
import * as s from '../validation/schemas.js';

const router = express.Router();

// IMPORTANT: only one register route, with multer
router.post('/register', emailSendLimiter, upload.single('image'), validate({ body: s.registerBody }), register);

router.post('/login', loginLimiter, validate({ body: s.loginBody }), login);
router.post('/verify-otp', authenticateToken, otpLimiter, validate({ body: s.verifyOtpBody }), verifyOTP);
router.post('/resend-otp', authenticateToken, emailSendLimiter, resendOTP);
router.get('/me', authenticateToken, getMe);

// Forgot password routes (public)
router.post('/forgot-password', emailSendLimiter, validate({ body: s.forgotPasswordBody }), forgotPassword);
router.post('/reset-password', otpLimiter, validate({ body: s.resetPasswordBody }), resetPassword);

// (optional) allow profile update with a new image as well
router.put('/profile', authenticateToken, upload.single('image'), updateProfile);

router.put('/change-password', authenticateToken, validate({ body: s.changePasswordBody }), changePassword);
router.post('/logout', authenticateToken, logout);

export default router;