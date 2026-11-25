import { z } from 'zod';

/* ------------------------------- Building blocks ------------------------------ */

export const BRANCHES = ['Colombo Fort', 'Kandy City', 'Galle Main', 'Negombo'];
export const TIME_SLOTS = [
  '9:00 AM - 11:00 AM',
  '11:00 AM - 1:00 PM',
  '2:00 PM - 4:00 PM',
  '4:00 PM - 6:00 PM',
];
export const CATEGORIES = ['laptops', 'smartphones', 'wearables', 'tablets', 'accessories'];
export const CONDITIONS = ['excellent', 'good', 'fair', 'poor'];
export const PAYMENT_METHODS = ['Credit Card', 'PayPal', 'Cash on Delivery'];
export const MAX_ITEM_QUANTITY = 20;
const BOOKING_WINDOW_DAYS = 60;

export const objectId = z.string().trim().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const email = z.string().trim().toLowerCase().pipe(z.email('Please enter a valid email address'));

// Sri Lankan mobile/landline written as 10 digits starting with 0 (e.g. 0771234567).
const phone = z.string().trim().regex(/^0\d{9}$/, 'Phone must be 10 digits starting with 0');

/** At least 8 characters with a letter and a number. Existing accounts are not re-validated. */
const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const otp = z.string().trim().regex(/^\d{6}$/, 'The code must be 6 digits');

const name = z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name cannot exceed 60 characters');

/* ------------------------------------ Params ---------------------------------- */

export const idParams = z.object({ id: objectId });
export const productIdParams = z.object({ productId: objectId });

/* ------------------------------------- Auth ----------------------------------- */

export const registerBody = z.object({
  name,
  email,
  password: newPassword,
  phone: phone.optional().or(z.literal('').transform(() => undefined)),
});

export const loginBody = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128),
});

export const verifyOtpBody = z.object({ otp });

export const forgotPasswordBody = z.object({ email });

export const resetPasswordBody = z.object({ email, otp, newPassword });

export const changePasswordBody = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword,
  })
  .refine((b) => b.currentPassword !== b.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });

/* ------------------------------------ Cart ------------------------------------ */

const quantity = z.coerce
  .number()
  .int('Quantity must be a whole number')
  .min(1, 'Quantity must be at least 1')
  .max(MAX_ITEM_QUANTITY, `You can order at most ${MAX_ITEM_QUANTITY} of an item`);

export const addToCartBody = z.object({ productId: objectId, quantity: quantity.default(1) });
export const updateCartItemBody = z.object({ quantity });

/* ------------------------------------ Orders ---------------------------------- */

export const shippingAddress = z.object({
  street: z.string().trim().min(3, 'Street is required').max(200),
  city: z.string().trim().min(2, 'City is required').max(80),
  state: z.string().trim().max(80).optional(),
  // Sri Lankan postal codes are 5 digits.
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'Postal code must be 5 digits')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  country: z.string().trim().max(60).default('Sri Lanka'),
});

export const createOrderBody = z.object({
  shippingAddress,
  paymentMethod: z.enum(PAYMENT_METHODS).default('Cash on Delivery'),
});

export const updateAddressBody = z.object({ shippingAddress });

export const orderStatusBody = z.object({
  orderStatus: z.enum(['Processing', 'Approved', 'Shipped', 'Delivered', 'Cancelled']),
  trackingNumber: z.string().trim().max(60).optional(),
  note: z.string().trim().max(500).optional(),
});

/* --------------------------------- Appointments ------------------------------- */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last = new Date(today);
    last.setDate(last.getDate() + BOOKING_WINDOW_DAYS);
    return date.getMonth() === m - 1 && date >= today && date <= last;
  }, `Pick a date between today and ${BOOKING_WINDOW_DAYS} days from now`);

export const createAppointmentBody = z.object({
  date: isoDate,
  timeSlot: z.enum(TIME_SLOTS, 'Pick one of the listed time slots'),
  branch: z.enum(BRANCHES, 'Pick one of our branches'),
  items: z
    .array(
      z.object({
        itemName: z.string().trim().min(2, 'Item name is required').max(100),
        quantity: z.coerce.number().int().min(1).max(50),
        category: z.string().trim().max(50).optional(),
        condition: z.string().trim().max(50).optional(),
        description: z.string().trim().max(500).optional(),
      }).passthrough(),
    )
    .min(1, 'Add at least one item')
    .max(20, 'At most 20 item lines per appointment'),
  notes: z.string().trim().max(1000).optional(),
});

/* ----------------------------------- Products --------------------------------- */

/**
 * Catalogue query. `status` and large pages are only honoured for signed-in staff/admins; the
 * controller forces `status=listed` and `limit<=50` for everyone else (see getProducts).
 */
export const productQuery = z
  .object({
    search: z.string().trim().max(100).optional(),
    category: z.enum(CATEGORIES).optional(),
    condition: z.enum(CONDITIONS).optional(),
    status: z.enum(['listed', 'unlisted', 'out_of_stock', 'all']).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    sort: z.enum(['createdAt', 'price', 'name']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(12),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: 'minPrice cannot be greater than maxPrice',
    path: ['minPrice'],
  });

export const PUBLIC_PAGE_LIMIT = 50;

// Multipart form fields arrive as strings, hence the coercion.
const productFields = {
  name: z.string().trim().min(3).max(100),
  category: z.enum(CATEGORIES),
  condition: z.enum(CONDITIONS).optional(),
  price: z.coerce.number().min(0, 'Price cannot be negative').max(10_000_000),
  description: z.string().trim().max(1000).optional(),
  brand: z.string().trim().max(60).optional(),
  stockQuantity: z.coerce.number().int().min(0, 'Stock cannot be negative').max(100_000),
  lowStockThreshold: z.coerce.number().int().min(0).max(10_000).optional(),
  status: z.enum(['listed', 'unlisted', 'out_of_stock']).optional(),
};

export const createProductBody = z.object(productFields).passthrough();
export const updateProductBody = z.object(productFields).partial().passthrough();

export const updateStockBody = z.object({
  quantity: z.coerce.number().int('Quantity must be a whole number').min(1, 'Quantity must be at least 1').max(100_000),
  action: z.enum(['increment', 'decrement'], 'Action must be "increment" or "decrement"'),
  note: z.string().trim().max(500).optional(),
});

/* ------------------------------------ Contact --------------------------------- */

export const contactBody = z.object({
  name,
  email,
  phone,
  topic: z.string().trim().min(2).max(80),
  branch: z.string().trim().min(2).max(80),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
  agree: z.coerce.boolean().optional(),
});

/* ------------------------------------- Admin ---------------------------------- */

export const createStaffBody = z.object({
  name,
  email,
  password: newPassword,
  phone: phone.optional(),
  assignedBranch: z.enum(BRANCHES),
});

export const updateRoleBody = z.object({ role: z.enum(['customer', 'staff', 'admin']) });
