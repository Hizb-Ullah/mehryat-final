/* ============================================================================
   MEHRYAT ATELIER — BACKEND API (single-file server)
   Everything lives here: DB connection, models, auth, and all routes.
   Run with: npm install && npm run seed && npm run dev
   ============================================================================ */

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const nodemailer = require("nodemailer");

/* ---------------------------------------------------------------------------
   EMAIL — used for password-reset links.
   If SMTP_HOST is not set in .env, emails are not actually sent; the reset
   link is printed to this console instead, so development can continue
   without real email credentials. Fill in SMTP_* in .env once the client
   provides real email/SMTP details, and real emails will start sending
   automatically — no code changes needed.
--------------------------------------------------------------------------- */
const emailConfigured = Boolean(process.env.SMTP_HOST);
const mailer = emailConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

async function sendPasswordResetEmail(toEmail, resetUrl) {
  if (!emailConfigured) {
    console.log("\n=== PASSWORD RESET (email not configured — dev mode) ===");
    console.log(`To: ${toEmail}`);
    console.log(`Reset link: ${resetUrl}`);
    console.log("==========================================================\n");
    return;
  }
  await mailer.sendMail({
    from: process.env.SMTP_FROM || "Mehryat Atelier <no-reply@mehryaatelier.com>",
    to: toEmail,
    subject: "Reset your Mehryat Atelier password",
    html: `
      <p>We received a request to reset your Mehryat Atelier account password.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a> (this link expires in 1 hour).</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}

/* ---------------------------------------------------------------------------
   1. DATABASE CONNECTION
--------------------------------------------------------------------------- */
async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
}

/* ---------------------------------------------------------------------------
   2. MODELS
--------------------------------------------------------------------------- */

// ---- User ----
const addressSchema = new mongoose.Schema(
  {
    fullName: String,
    phone: String,       // stored with country code, e.g. +923196157309
    country: String,
    state: String,        // province / state
    city: String,
    postalCode: String,
    street: String,
    houseNumber: String,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    phone: { type: String, trim: true, required: true }, // includes country code
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    savedAddress: addressSchema,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model("User", userSchema);

// ---- Product ----
const variantSchema = new mongoose.Schema(
  { color: String, sku: String, stock: { type: Number, default: 0 } },
  { _id: false }
);

const PRODUCT_CATEGORIES = [
  "Mobile Pouch (Customized)",
  "Shoot Long",
  "Zipper Long (Customized)",
  "Full Option Double",
  "Full Option",
  "Bifold Hidden Pocket",
  "Dollar Size",
  "Bulky Card Holder",
  "Atlas Card Holder",
  "Mini C-Holder (1 Side, 3 Pockets)",
  "Essential C-Holder",
  "Saddle Slim C-Holder",
  "Urban Classic C-Holder",
  "Bulkey Wallet",
  "Special Edition",
  "Bifold Money Clip Wallet",
];

// Price tiers — a second way to browse the catalog, alongside product
// category. Each tier has an indicative price range shown to customers.
const PRICE_TIERS = ["Entry", "Core", "Premium", "Atelier / Special"];
const TIER_PRICE_RANGES = {
  "Entry": { min: 1990, max: 2490 },
  "Core": { min: 2990, max: 3990 },
  "Premium": { min: 3990, max: 5490 },
  "Atelier / Special": { min: 5990, max: 8000 },
};

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    category: { type: String, required: true, enum: PRODUCT_CATEGORIES },
    tier: { type: String, enum: PRICE_TIERS, required: true },
    sizeClass: { type: String, enum: ["Long & Passport Size", "Standard Size"], required: true },
    dimensions: { length: Number, width: Number, height: Number },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    images: [{ type: String }],
    variants: [variantSchema],
    totalStock: { type: Number, default: 0 },
    isCustomizable: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
productSchema.index({ name: "text", description: "text" });

const Product = mongoose.model("Product", productSchema);

// ---- Order ----
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: String,
    image: String,
    price: Number,
    quantity: { type: Number, required: true, min: 1 },
    color: String,
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["Placed", "Processing", "Shipped", "Delivered", "Cancelled"], required: true },
    date: { type: Date, default: Date.now },
    dayOfWeek: String,
    note: String,
  },
  { _id: false }
);

// Messages between the customer and our team, shown on the order page for both.
const orderMessageSchema = new mongoose.Schema(
  {
    from: { type: String, enum: ["admin", "customer"], required: true },
    text: { type: String, required: true, maxlength: 1000 },
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [orderItemSchema],
    shippingAddress: addressSchema,
    paymentMethod: { type: String, enum: ["COD", "Bank Transfer"], required: true },
    paymentStatus: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
    itemsTotal: { type: Number, required: true },
    shippingFee: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ["Placed", "Processing", "Shipped", "Delivered", "Cancelled"], default: "Placed" },
    statusHistory: [statusHistorySchema],
    messages: [orderMessageSchema],
    expectedProcessingDate: Date,
  },
  { timestamps: true }
);

orderSchema.methods.pushStatus = function (status, note) {
  const now = new Date();
  this.status = status;
  this.statusHistory.push({
    status,
    date: now,
    dayOfWeek: now.toLocaleDateString("en-US", { weekday: "long" }),
    note,
  });
};

const Order = mongoose.model("Order", orderSchema);


// ---- Password Reset Request ----
// A manual fallback alongside the email-link reset above: useful right now
// since real email isn't configured yet, and useful long-term as a way for
// customers to reach a human if the email link doesn't work for them.
const passwordResetRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    email: String,
    name: String,
    phone: String,
    status: { type: String, enum: ["Pending", "Resolved"], default: "Pending" },
    resolvedAt: Date,
  },
  { timestamps: true }
);
const PasswordResetRequest = mongoose.model("PasswordResetRequest", passwordResetRequestSchema);

/* ---------------------------------------------------------------------------
   3. AUTH MIDDLEWARE
--------------------------------------------------------------------------- */
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ message: "User no longer exists" });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }
}

function adminOnly(req, res, next) {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ message: "Admin access required" });
}

/* ---------------------------------------------------------------------------
   4. APP + ROUTES
--------------------------------------------------------------------------- */
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "*", credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

/* ---------------------------------------------------------------------------
   PRODUCT IMAGE UPLOADS
   If CLOUDINARY_* env vars are set, uploaded photos go to Cloudinary (a free
   image hosting service) and persist permanently — required once deployed,
   since Render's free tier wipes local files on every redeploy/restart.
   Without those env vars (e.g. during local development), files just save
   to /server/uploads and are served at /uploads/<filename> — no external
   account needed to keep developing locally.
--------------------------------------------------------------------------- */
const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

let upload;
let uploadToCloudinary;

if (cloudinaryConfigured) {
  const cloudinary = require("cloudinary").v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  // Keep the file in memory just long enough to stream it to Cloudinary —
  // nothing is written to local disk in this mode.
  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = /jpeg|jpg|png|webp/;
      const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
      cb(ok ? null : new Error("Only JPG, PNG or WEBP images are allowed"), ok);
    },
  });
  uploadToCloudinary = (buffer) =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "mehryat-atelier" },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(buffer);
    });
} else {
  const uploadsDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
  app.use("/uploads", express.static(uploadsDir));

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, safeName);
    },
  });
  upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = /jpeg|jpg|png|webp/;
      const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
      cb(ok ? null : new Error("Only JPG, PNG or WEBP images are allowed"), ok);
    },
  });
}

app.get("/api/health", (req, res) => res.json({ status: "ok", brand: "Mehryat Atelier API" }));

// ---------- AUTH ----------
app.post("/api/auth/register", async (req, res, next) => {
  try {
    const {
      name, email, password, phone,
      country, state, city, postalCode, street, houseNumber,
    } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: "Name, email, password and phone are required" });
    }
    // Basic international phone check: optional leading +, 7–15 digits total.
    if (!/^\+?[1-9]\d{6,14}$/.test(phone.replace(/[\s-]/g, ""))) {
      return res.status(400).json({ message: "Please enter a valid phone number with country code, e.g. +923001234567" });
    }
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    const user = await User.create({
      name, email, password, phone,
      savedAddress: { fullName: name, phone, country, state, city, postalCode, street, houseNumber },
    });
    res.status(201).json({
      _id: user._id, name: user.name, email: user.email, role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) { next(err); }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    res.json({
      _id: user._id, name: user.name, email: user.email, role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) { next(err); }
});

// Tells the frontend whether emailed reset links actually work right now
// (they only do once SMTP_* is configured). The Forgot Password page uses
// this to lead with "request a new password from our team" when email is off,
// instead of promising an email that will never arrive.
app.get("/api/auth/reset-options", (req, res) => res.json({ emailEnabled: emailConfigured }));

// ---------- FORGOT / RESET PASSWORD (emailed link — only works once SMTP is configured) ----------
app.post("/api/auth/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    // Always respond the same way whether or not the email exists,
    // so people can't use this to check which emails are registered.
    if (!user) {
      return res.json({ message: "If an account exists for this email, a reset link has been sent." });
    }
    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password/${rawToken}`;
    await sendPasswordResetEmail(user.email, resetUrl);

    res.json({ message: "If an account exists for this email, a reset link has been sent." });
  } catch (err) { next(err); }
});

app.post("/api/auth/reset-password/:token", async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ message: "This reset link is invalid or has expired" });
    }
    user.password = password; // pre-save hook will hash it
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ message: "Password updated successfully. You can now log in." });
  } catch (err) { next(err); }
});

// Manual fallback: customer asks a human for help instead of using the
// email link. Creates a request the admin can see and act on.
app.post("/api/auth/request-password-help", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });
    const user = await User.findOne({ email });
    // Same non-revealing response either way — don't confirm which emails exist.
    if (!user) {
      return res.json({ message: "If an account exists for this email, our team will send you a new password on the phone / WhatsApp number registered on that account." });
    }
    const existing = await PasswordResetRequest.findOne({ user: user._id, status: "Pending" });
    if (!existing) {
      await PasswordResetRequest.create({
        user: user._id, email: user.email, name: user.name, phone: user.phone,
      });
    }
    res.json({ message: "If an account exists for this email, our team will send you a new password on the phone / WhatsApp number registered on that account." });
  } catch (err) { next(err); }
});

// ---------- USERS ----------
app.get("/api/users/me", protect, (req, res) => res.json(req.user));

app.put("/api/users/me", protect, async (req, res, next) => {
  try {
    const { name, phone, savedAddress } = req.body;
    const user = await User.findById(req.user._id);
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (savedAddress) user.savedAddress = savedAddress;
    await user.save();
    res.json(user);
  } catch (err) { next(err); }
});

// ---------- PRODUCTS (public) ----------
app.get("/api/products", async (req, res, next) => {
  try {
    const { category, tier, search } = req.query;
    const query = { isActive: true };
    if (category) query.category = category;
    if (tier) query.tier = tier;
    if (search) query.$text = { $search: search };
    res.json(await Product.find(query).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
});

app.get("/api/products/categories", async (req, res, next) => {
  try {
    res.json(await Product.distinct("category", { isActive: true }));
  } catch (err) { next(err); }
});

// All 16 fixed category names (not just ones with active products) —
// used by the admin "create product" form so every category is selectable
// even before it has a product in it.
app.get("/api/categories/all", (req, res) => res.json(PRODUCT_CATEGORIES));

// The 4 fixed price tiers with their indicative price ranges, used for the
// homepage "Shop by Price" tiles and the admin product form.
app.get("/api/tiers/all", (req, res) => {
  res.json(PRICE_TIERS.map((name) => ({ name, ...TIER_PRICE_RANGES[name] })));
});

app.get("/api/products/featured", async (req, res, next) => {
  try {
    res.json(await Product.find({ isActive: true, isFeatured: true }).limit(8));
  } catch (err) { next(err); }
});

app.get("/api/products/:slug", async (req, res, next) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) { next(err); }
});

// ---------- ORDERS (customer) ----------
function generateOrderNumber() {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MA-${ts}-${rand}`;
}

app.post("/api/orders", protect, async (req, res, next) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order must contain at least one item" });
    }
    if (!["COD", "Bank Transfer"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    let itemsTotal = 0;
    const resolvedItems = [];
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) return res.status(404).json({ message: `Product not found: ${item.product}` });
      itemsTotal += product.price * item.quantity;
      resolvedItems.push({
        product: product._id, name: product.name, image: product.images?.[0] || "",
        price: product.price, quantity: item.quantity, color: item.color,
      });
    }

    const shippingFee = 0;
    const order = new Order({
      orderNumber: generateOrderNumber(),
      customer: req.user._id,
      items: resolvedItems,
      shippingAddress,
      paymentMethod,
      itemsTotal,
      shippingFee,
      totalAmount: itemsTotal + shippingFee,
    });
    order.pushStatus("Placed", "Order placed by customer");

    const expected = new Date();
    expected.setDate(expected.getDate() + 2);
    order.expectedProcessingDate = expected;

    await order.save();
    res.status(201).json(order);
  } catch (err) { next(err); }
});

app.get("/api/orders/mine", protect, async (req, res, next) => {
  try {
    res.json(await Order.find({ customer: req.user._id }).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
});

app.get("/api/orders/:id", protect, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.customer.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to view this order" });
    }
    res.json(order);
  } catch (err) { next(err); }
});

// Customer sends a message on their own order (e.g. to give missing details
// or ask a question). Shows up for the admin on that order's page.
app.post("/api/orders/:id/messages", protect, async (req, res, next) => {
  try {
    const text = String(req.body.text || "").trim();
    if (!text) return res.status(400).json({ message: "Message cannot be empty" });
    if (text.length > 1000) return res.status(400).json({ message: "Message is too long (max 1000 characters)" });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (order.messages.length >= 200) {
      return res.status(400).json({ message: "Message limit reached for this order. Please contact us on WhatsApp." });
    }
    order.messages.push({ from: "customer", text });
    await order.save();
    res.status(201).json(order);
  } catch (err) { next(err); }
});

// Customer cancels their own order — only allowed before it has shipped,
// e.g. if they entered incomplete/wrong info at checkout. The cancellation
// immediately shows on their own order-tracking page (that's the
// "automatic notification" — there's no separate email/SMS step).
app.put("/api/orders/:id/cancel", protect, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to cancel this order" });
    }
    if (["Shipped", "Delivered", "Cancelled"].includes(order.status)) {
      return res.status(400).json({ message: `This order can no longer be cancelled (status: ${order.status})` });
    }
    order.pushStatus("Cancelled", req.body.reason || "Cancelled by customer");
    await order.save();
    res.json(order);
  } catch (err) { next(err); }
});

// ---------- ADMIN ----------
const admin = express.Router();
admin.use(protect, adminOnly);

admin.get("/overview", async (req, res, next) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalOrders, totalProducts, totalCustomers, ordersToday, recentOrders] = await Promise.all([
      Order.countDocuments(),
      Product.countDocuments(),
      User.countDocuments({ role: "customer" }),
      Order.countDocuments({ createdAt: { $gte: startOfToday } }),
      Order.find().sort({ createdAt: -1 }).limit(10).populate("customer", "name email"),
    ]);
    const statusCounts = await Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
    const salesAgg = await Order.aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      { $group: { _id: null, totalSales: { $sum: "$totalAmount" } } },
    ]);
    res.json({
      totalOrders, totalProducts, totalCustomers, ordersToday,
      totalSales: salesAgg[0]?.totalSales || 0,
      statusCounts, recentOrders,
    });
  } catch (err) { next(err); }
});

admin.get("/products", async (req, res, next) => {
  try { res.json(await Product.find().sort({ createdAt: -1 })); } catch (err) { next(err); }
});

admin.post("/products", async (req, res, next) => {
  try { res.status(201).json(await Product.create(req.body)); } catch (err) { next(err); }
});

// Upload a product image. Returns { url } — paste that url into the
// product's images array via the normal PUT /admin/products/:id call.
admin.post("/upload", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image file received" });
    if (cloudinaryConfigured) {
      const result = await uploadToCloudinary(req.file.buffer);
      return res.status(201).json({ url: result.secure_url });
    }
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  } catch (err) { next(err); }
});

admin.put("/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) { next(err); }
});

admin.delete("/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (err) { next(err); }
});

admin.get("/orders", async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    res.json(await Order.find(query).sort({ createdAt: -1 }).populate("customer", "name email phone"));
  } catch (err) { next(err); }
});

// Full details of one order, for the admin order page.
admin.get("/orders/:id", async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate("customer", "name email phone");
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) { next(err); }
});

// Change an order's status. The optional note (e.g. a courier tracking number,
// or the reason for cancelling) is saved in the order history and shown to
// the customer on their order page.
admin.put("/orders/:id/status", async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const validStatuses = ["Placed", "Processing", "Shipped", "Delivered", "Cancelled"];
    if (!validStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status === status) {
      return res.status(400).json({ message: `This order is already ${status}` });
    }
    const cleanNote = typeof note === "string" ? note.trim().slice(0, 500) : "";
    order.pushStatus(status, cleanNote || (status === "Cancelled" ? "Cancelled by our team" : undefined));
    await order.save();
    await order.populate("customer", "name email phone");
    res.json(order);
  } catch (err) { next(err); }
});

// Mark payment received / pending (e.g. once a bank transfer has arrived).
admin.put("/orders/:id/payment", async (req, res, next) => {
  try {
    const { paymentStatus } = req.body;
    if (!["Pending", "Paid"].includes(paymentStatus)) {
      return res.status(400).json({ message: "Invalid payment status" });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    order.paymentStatus = paymentStatus;
    await order.save();
    await order.populate("customer", "name email phone");
    res.json(order);
  } catch (err) { next(err); }
});

// Admin replies to / messages the customer about an order.
admin.post("/orders/:id/messages", async (req, res, next) => {
  try {
    const text = String(req.body.text || "").trim();
    if (!text) return res.status(400).json({ message: "Message cannot be empty" });
    if (text.length > 1000) return res.status(400).json({ message: "Message is too long (max 1000 characters)" });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.messages.length >= 200) {
      return res.status(400).json({ message: "Message limit reached for this order" });
    }
    order.messages.push({ from: "admin", text });
    await order.save();
    await order.populate("customer", "name email phone");
    res.status(201).json(order);
  } catch (err) { next(err); }
});

admin.get("/customers", async (req, res, next) => {
  try {
    res.json(await User.find({ role: "customer" }).select("-password").sort({ createdAt: -1 }));
  } catch (err) { next(err); }
});

// ---------- Password reset requests ----------
admin.get("/password-requests", async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    res.json(await PasswordResetRequest.find(query).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
});

// Generates a new random password for the user, saves it, marks the
// request resolved, and returns the plaintext password ONCE in this
// response — the admin copies it and sends it to the customer directly
// (WhatsApp, call, etc). It is never stored or shown again after this.
admin.post("/password-requests/:id/resolve", async (req, res, next) => {
  try {
    const request = await PasswordResetRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    const user = await User.findById(request.user);
    if (!user) return res.status(404).json({ message: "That customer's account no longer exists" });

    const newPassword = crypto.randomBytes(4).toString("hex"); // 8-character temp password
    user.password = newPassword; // pre-save hook hashes it
    await user.save();

    request.status = "Resolved";
    request.resolvedAt = new Date();
    await request.save();

    res.json({
      message: "Password reset. Copy it below and send it to the customer.",
      newPassword,
      customer: { name: user.name, email: user.email, phone: user.phone },
    });
  } catch (err) { next(err); }
});

app.use("/api/admin", admin);

// ---------- 404 + error handler ----------
app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

/* ---------------------------------------------------------------------------
   5. START
--------------------------------------------------------------------------- */
connectDB();
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Mehryat Atelier API running on port ${PORT}`));

module.exports = { app, User, Product, Order, PRODUCT_CATEGORIES };
