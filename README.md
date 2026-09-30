# Mehryat Atelier — E-Commerce Website

Full-stack MERN e-commerce site for Mehryat Atelier, a premium Pakistani
leather goods brand. Consolidated into as few files as practical:

```
mehryat-atelier/
├── server/
│   ├── server.js       Everything: DB connection, models, auth, all routes
│   ├── seed.js         Seeds 16 sample products (one per real category)
│   └── .env.example    Copy to .env and fill in
└── client/
    └── src/
        ├── App.jsx      Everything: API client, contexts, all components,
        │                all pages (storefront + admin), routing
        ├── main.jsx      Entry point
        └── index.css     Tailwind + brand styles
```

## Stack
React (Vite) + Tailwind · Node/Express · MongoDB (Mongoose) · JWT auth

## Setup

### 1. Backend
```bash
cd server
cp .env.example .env
# edit .env: paste your MongoDB URI and set a JWT_SECRET

npm install
npm run seed     # populates 16 sample products
npm run dev       # API on http://localhost:5000
```

### 2. Frontend (new terminal)
```bash
cd client
npm install
npm run dev       # site on http://localhost:5173
```

Don't have MongoDB yet? Create a free cluster at mongodb.com/atlas, click
Connect → Drivers → copy the connection string into `MONGO_URI` in `.env`.

### 3. Make yourself an admin
1. Register an account on the site.
2. In MongoDB (Atlas UI or Compass), open the `users` collection, find your
   user, change `role` from `"customer"` to `"admin"`.
3. Log out and back in — the "Admin" link appears in the header.

## What's Built
- Customer accounts with full registration: name, email, password, phone
  (with country code), and full delivery address (house number, street,
  city, state, postal code, country)
- Forgot password / reset password via emailed link (see Email section
  below — works in "console mode" until real SMTP credentials are added)
- Full catalog: 16 real Mehryat Atelier categories, two size classes,
  pre-seeded with realistic placeholder names/prices/descriptions
- Cart, checkout with two clearly labeled payment options: **Pay Before
  Delivery (Bank Transfer)** and **Pay After Delivery (Cash on Delivery)**
- Order tracking: full status history (Placed → Processing → Shipped →
  Delivered), each stage stamped with date **and** day of week
- Customers can cancel their own order (e.g. if they entered wrong
  details) any time before it ships — the cancellation shows immediately
  on their order page, which is how they're "notified"
- Floating WhatsApp button on every page — opens a chat with the business
  number (edit `WHATSAPP_NUMBER` near the top of `App.jsx` if it changes)
- Admin dashboard: **orders placed today**, total orders, total sales,
  order status updates, and full product management — add new products,
  edit price/description/stock, and **upload real product photos directly
  from the admin panel** (saved to `server/uploads/`, no code or database
  tool needed)
- Homepage laid out in the Bellroy pattern you shared (hero → shop-by-
  category tiles → featured products → brand-value trio → craft statement),
  restyled in Mehryat's black/espresso/cognac/gold palette

## Email (Forgot Password)
"Forgot Password" is fully built, but actually **sending** the email
requires real SMTP credentials. Until you add them to `.env`, the reset
link simply prints to the terminal running `npm run dev` — useful for
testing, but customers won't receive anything by email yet.

To make it send real emails, fill in `.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youraddress@gmail.com
SMTP_PASS=your_16_character_app_password
SMTP_FROM=Mehryat Atelier <youraddress@gmail.com>
```
(For Gmail, `SMTP_PASS` must be a Google "App Password", not your normal
login password — Google requires this for third-party apps.) Any SMTP
provider works the same way — a dedicated service like SendGrid, Mailgun,
or Brevo is a good option once this goes live, since Gmail has daily
sending limits.

## Still Needed From the Client (marked TBD in their info form)
Real logo, real product photos/names/prices, processing time, courier
name, bank transfer account details, business address, socials, return
policy. Placeholder data is used everywhere until these arrive.

## Deployment
Deployment puts the site on the internet at a real address, so the owner
and real customers can use it from anywhere — not just on your computer.

You need three separate pieces, each hosted somewhere:
1. **Database** — MongoDB Atlas (you already have this set up and working)
2. **Backend** — the `server/` folder, hosted on Render (free tier is fine to start)
3. **Frontend** — the `client/` folder, hosted on Vercel (free tier is fine to start)

### Step 1 — Put the code on GitHub
Both Render and Vercel deploy by connecting to a GitHub repository.
1. Create a free account at github.com if you don't have one
2. Create a new repository (e.g. `mehryat-atelier`)
3. From your project folder, run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/mehryat-atelier.git
   git push -u origin main
   ```
   (`.env` is already in `.gitignore`, so your real credentials never get
   uploaded to GitHub — good, keep it that way.)

### Step 2 — Deploy the backend (Render)
1. Go to render.com → sign up/log in → **New +** → **Web Service**
2. Connect your GitHub repo
3. Set:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Under **Environment**, add these variables (same values as your local `.env`):
   - `MONGO_URI`
   - `JWT_SECRET`
   - `CLIENT_URL` — leave a placeholder for now, e.g. `https://placeholder.com` (you'll update this in Step 4)
   - `SMTP_*` variables if you have real email credentials by then
5. Click **Create Web Service**. Once deployed, Render gives you a URL like
   `https://mehryat-atelier-api.onrender.com` — copy this, you'll need it next.

**Important limitation:** Render's free tier wipes locally-stored files
(like uploaded product photos in `server/uploads/`) whenever the service
restarts or redeploys. This means admin-uploaded photos are **not
permanent** on the free tier. For a real launch, either upgrade to a paid
Render disk, or switch image storage to a service like Cloudinary — happy
to help set that up when you're ready to go fully live.

### Step 3 — Deploy the frontend (Vercel)
1. Go to vercel.com → sign up/log in → **Add New** → **Project**
2. Import the same GitHub repo
3. Set:
   - **Root Directory:** `client`
   - **Framework Preset:** Vite (should auto-detect)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Under **Environment Variables**, add:
   - `VITE_API_URL` = the Render backend URL from Step 2 (e.g. `https://mehryat-atelier-api.onrender.com`) — **no trailing slash, no `/api` at the end**
5. Click **Deploy**. Vercel gives you a URL like `https://mehryat-atelier.vercel.app`.

### Step 4 — Connect the two
Go back to Render → your backend service → **Environment** → update
`CLIENT_URL` to your real Vercel URL from Step 3 (e.g.
`https://mehryat-atelier.vercel.app`). Save — Render will redeploy
automatically. This is what allows the frontend to actually talk to the
backend (CORS).

### Step 5 — Custom domain (optional)
If the client owns `mehryatatelier.com`, both Vercel and Render let you
attach a custom domain under their **Domains** settings — you'd point the
domain's DNS at Vercel (for the main site) and optionally a subdomain like
`api.mehryatatelier.com` at Render (for the backend).

### After deploying
- Re-run the "Create an admin user" steps above, but now register the
  account on your **live** site instead of `localhost:5173`
- Test the full flow live: register, browse, checkout, place an order,
  and check the admin dashboard — all on the real URLs
