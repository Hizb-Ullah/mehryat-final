/* Seeds the database with 16 realistic placeholder products —
   one per Mehryat Atelier product category — for development/preview.
   Run with: npm run seed */

require("dotenv").config();
const mongoose = require("mongoose");

const PLACEHOLDER_IMG = "https://placehold.co/800x800/1c1a17/c9a24b?text=Mehryat+Atelier";
const longSize = { length: 8.5, width: 5, height: 1.5 };
const standardSize = { length: 4.5, width: 6, height: 1.5 };

const productSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const Product = mongoose.model("Product", productSchema);

const products = [
  // Entry tier (Rs. 1,990–2,490) — card holders
  { name: "Mini C-Holder (1 Side, 3 Pockets)", category: "Mini C-Holder (1 Side, 3 Pockets)", tier: "Entry", sizeClass: "Standard Size", dimensions: standardSize, price: 1990, description: "An ultra-slim single-side card holder with three pockets." },
  { name: "Atlas Card Holder", category: "Atlas Card Holder", tier: "Entry", sizeClass: "Standard Size", dimensions: standardSize, price: 2190, description: "Minimalist card holder with a refined, structured silhouette.", isFeatured: true },
  { name: "Essential C-Holder", category: "Essential C-Holder", tier: "Entry", sizeClass: "Standard Size", dimensions: standardSize, price: 2290, description: "A no-frills essential card holder — clean lines, premium leather." },
  { name: "Urban Classic C-Holder", category: "Urban Classic C-Holder", tier: "Entry", sizeClass: "Standard Size", dimensions: standardSize, price: 2390, description: "A timeless card holder silhouette, reworked with modern stitching detail." },
  { name: "Saddle Slim C-Holder", category: "Saddle Slim C-Holder", tier: "Entry", sizeClass: "Standard Size", dimensions: standardSize, price: 2490, description: "Slim card holder crafted from saddle leather with a rich natural grain." },

  // Core tier (Rs. 2,990–3,990) — everyday wallets
  { name: "Bulky Card Holder", category: "Bulky Card Holder", tier: "Core", sizeClass: "Standard Size", dimensions: standardSize, price: 2990, description: "A sturdy, high-capacity card holder built for everyday carry." },
  { name: "Dollar Size Wallet", category: "Dollar Size", tier: "Core", sizeClass: "Standard Size", dimensions: standardSize, price: 3290, description: "Compact dollar-bill-size wallet, slim and pocket-friendly." },
  { name: "Bifold Hidden Pocket Wallet", category: "Bifold Hidden Pocket", tier: "Core", sizeClass: "Standard Size", dimensions: standardSize, price: 3490, description: "A classic bifold with a discreet hidden pocket for extra security." },
  { name: "Bifold Money Clip Wallet", category: "Bifold Money Clip Wallet", tier: "Core", sizeClass: "Standard Size", dimensions: standardSize, price: 3990, description: "A modern bifold with an integrated money clip for quick access to cash.", isFeatured: true },

  // Premium tier (Rs. 3,990–5,490) — full-featured wallets
  { name: "Full Option Wallet", category: "Full Option", tier: "Premium", sizeClass: "Standard Size", dimensions: standardSize, price: 4290, description: "A complete everyday wallet with dedicated slots for cards, cash and ID." },
  { name: "Bulkey Wallet", category: "Bulkey Wallet", tier: "Premium", sizeClass: "Standard Size", dimensions: standardSize, price: 4590, description: "A robust, high-capacity wallet for those who carry more than the essentials." },
  { name: "Mobile Pouch (Customized)", category: "Mobile Pouch (Customized)", tier: "Premium", sizeClass: "Standard Size", dimensions: standardSize, price: 4990, description: "A handcrafted leather mobile pouch, personalized to your phone size.", isCustomizable: true, isFeatured: true },
  { name: "Shoot Long Wallet", category: "Shoot Long", tier: "Premium", sizeClass: "Long & Passport Size", dimensions: longSize, price: 5290, description: "A sleek long-format wallet with ample card and note storage in rich cognac leather." },
  { name: "Full Option Double Wallet", category: "Full Option Double", tier: "Premium", sizeClass: "Standard Size", dimensions: standardSize, price: 5490, description: "Our most comprehensive wallet — double compartments for cards, cash and coins." },

  // Atelier / Special tier (Rs. 5,990–8,000+) — customized & limited pieces
  { name: "Zipper Long (Customized)", category: "Zipper Long (Customized)", tier: "Atelier / Special", sizeClass: "Long & Passport Size", dimensions: longSize, price: 6990, description: "A secure zip-around long wallet, customizable with initials, in deep brown leather.", isCustomizable: true, isFeatured: true },
  { name: "Special Edition Wallet", category: "Special Edition", tier: "Atelier / Special", sizeClass: "Long & Passport Size", dimensions: longSize, price: 7990, description: "Limited-run wallet in an exclusive finish with subtle gold hardware accents.", isFeatured: true },
];

const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  await Product.deleteMany({});
  const withDefaults = products.map((p) => ({
    ...p,
    slug: slugify(p.name),
    images: [PLACEHOLDER_IMG],
    variants: [
      { color: "Black", sku: `${slugify(p.name)}-blk`, stock: 15 },
      { color: "Deep Brown", sku: `${slugify(p.name)}-brn`, stock: 12 },
      { color: "Tan/Cognac", sku: `${slugify(p.name)}-tan`, stock: 10 },
    ],
    totalStock: 37,
    isActive: true,
  }));
  await Product.insertMany(withDefaults);
  console.log(`Seeded ${withDefaults.length} products for Mehryat Atelier.`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
