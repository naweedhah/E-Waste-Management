import Product from '../models/Product.js';
import Discount from '../models/Discount.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { adjustStock } from '../services/inventory.js';
import { PUBLIC_PAGE_LIMIT } from '../validation/schemas.js';

// @desc    Get all products with filters
// @route   GET /api/products
// @access  Public
export const getProducts = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    condition,
    minPrice,
    maxPrice,
    sort = 'createdAt',
    order = 'desc',
    page = 1,
    limit: requestedLimit = 12,
    status: requestedStatus,
  } = req.query;

  // Shoppers only ever see listed products; staff/admin inventory screens can see everything.
  const isStaff = ['admin', 'staff'].includes(req.user?.role);
  const status = isStaff ? (requestedStatus === 'all' ? undefined : (requestedStatus ?? 'listed')) : 'listed';
  const limit = isStaff ? requestedLimit : Math.min(requestedLimit, PUBLIC_PAGE_LIMIT);

  // Build query
  let query = {};

  // Text search
  if (search) {
    query.$text = { $search: search };
  }

  // Filters
  if (category) query.category = category;
  if (condition) query.condition = condition;
  if (status) query.status = status;

  // Price range
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  // Pagination
  const skip = (Number(page) - 1) * Number(limit);

  // Sort
  const sortOrder = order === 'asc' ? 1 : -1;
  let sortQuery = {};
  
  if (sort === 'price') {
    sortQuery.price = sortOrder;
  } else if (sort === 'name') {
    sortQuery.name = sortOrder;
  } else {
    sortQuery.createdAt = sortOrder;
  }

  // Execute query
  const products = await Product.find(query)
    .sort(sortQuery)
    .limit(Number(limit))
    .skip(skip)
    .populate('activeDiscount');

  // Get total count for pagination
  const total = await Product.countDocuments(query);

  // Calculate final prices with discounts
  const productsWithPrices = products.map(product => {
    const productObj = product.toObject();
    
    if (product.activeDiscount && product.activeDiscount.isActive) {
      productObj.finalPrice = product.getFinalPrice(product.activeDiscount);
      productObj.hasDiscount = true;
      productObj.discount = product.activeDiscount;
    } else {
      productObj.finalPrice = product.price;
      productObj.hasDiscount = false;
    }

    return productObj;
  });

  res.json({
    success: true,
    count: products.length,
    total,
    totalPages: Math.ceil(total / Number(limit)),
    currentPage: Number(page),
    products: productsWithPrices
  });
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('activeDiscount');

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const productObj = product.toObject();
  
  if (product.activeDiscount && product.activeDiscount.isActive) {
    productObj.finalPrice = product.getFinalPrice(product.activeDiscount);
    productObj.hasDiscount = true;
    productObj.discount = product.activeDiscount;
  } else {
    productObj.finalPrice = product.price;
    productObj.hasDiscount = false;
  }

  res.json({
    success: true,
    product: productObj
  });
});

// @desc    Create product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    category,
    condition,
    price,
    description = '',
    brand = '',
    stockQuantity = 0,
    lowStockThreshold = 10,
    tags,
    status,
  } = req.body;

  // ✅ FIXED: Store image in images array
  const images = req.file ? [`/uploads/${req.file.filename}`] : [];

  // Cast numerics
  const prod = await Product.create({
    name,
    category,
    condition,
    price: Number(price),
    description,
    brand,
    stockQuantity: Number(stockQuantity),
    lowStockThreshold: Number(lowStockThreshold),
    images, // ✅ Use images array
    tags,
    status: status || 'listed',
  });

  res.status(201).json({ success: true, message: 'Product created successfully', product: prod });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  // Allowed fields
  const payload = {};
  [
    'name',
    'category',
    'condition',
    'description',
    'brand',
    'tags',
    'status',
  ].forEach((k) => {
    if (k in req.body) payload[k] = req.body[k];
  });

  if ('price' in req.body) payload.price = Number(req.body.price);
  if ('stockQuantity' in req.body) payload.stockQuantity = Number(req.body.stockQuantity);
  if ('lowStockThreshold' in req.body) payload.lowStockThreshold = Number(req.body.lowStockThreshold);


  if (req.file) {
  const newImagePath = `/uploads/${req.file.filename}`;

  payload.images = [newImagePath]; 
}

  const updated = await Product.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  res.json({ success: true, message: 'Product updated successfully', product: updated });
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  await product.deleteOne();

  res.json({
    success: true,
    message: 'Product deleted successfully'
  });
});

// @desc    Update product stock
// @route   PATCH /api/products/:id/stock
// @access  Private/Admin/Staff
export const updateStock = asyncHandler(async (req, res) => {
  // Validated by updateStockBody: quantity is a positive integer, action is increment|decrement.
  const { quantity, action, note } = req.body;

  const exists = await Product.exists({ _id: req.params.id });
  if (!exists) {
    res.status(404);
    throw new Error('Product not found');
  }

  // Atomic $inc (no read-modify-write), so two staff members adjusting at once both count.
  const product = await adjustStock(req.params.id, action, quantity);
  if (!product) {
    res.status(409);
    throw new Error('Insufficient stock');
  }

  res.json({
    success: true,
    message: 'Stock updated successfully',
    product: {
      id: product._id,
      name: product.name,
      stockQuantity: product.stockQuantity,
      status: product.status,
      isLowStock: product.isLowStock,
      isOutOfStock: product.isOutOfStock
    },
    note
  });
});

// @desc    Get low stock products
// @route   GET /api/products/low-stock
// @access  Private/Admin/Staff
export const getLowStockProducts = asyncHandler(async (req, res) => {
  const { threshold = 10 } = req.query;

  const products = await Product.find({
    stockQuantity: { $lte: Number(threshold), $gt: 0 },
    status: 'listed'
  }).sort({ stockQuantity: 1 });

  res.json({
    success: true,
    count: products.length,
    threshold: Number(threshold),
    products
  });
});

// @desc    Get out of stock products
// @route   GET /api/products/out-of-stock
// @access  Private/Admin/Staff
export const getOutOfStockProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({
    stockQuantity: 0
  }).sort({ updatedAt: -1 });

  res.json({
    success: true,
    count: products.length,
    products
  });
});