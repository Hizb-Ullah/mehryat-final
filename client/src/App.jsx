/* ============================================================================
   MEHRYAT ATELIER — FRONTEND (single-file React app)
   Everything lives here: API client, Auth/Cart context, shared components,
   every page (storefront + admin), and routing.
   ============================================================================ */

import { createContext, useContext, useEffect, useState } from "react";
import { Routes, Route, Link, NavLink, Navigate, Outlet, useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import axios from "axios";

/* ============================================================================
   1. API CLIENT
   API_URL is read from VITE_API_URL (set this in production to your deployed
   backend's URL, e.g. https://mehryat-api.onrender.com). Left blank, it
   defaults to relative paths, which work during local development via the
   Vite dev server proxy in vite.config.js.
============================================================================ */
const API_URL = import.meta.env.VITE_API_URL || "";
const api = axios.create({ baseURL: `${API_URL}/api` });

// Product photos uploaded via the admin panel are stored on the backend and
// referenced by a relative path like "/uploads/169...-photo.jpg". In
// production the frontend and backend are on different domains, so that
// path needs the backend's URL in front of it. Placeholder image URLs
// (which already start with "http") are left untouched.
function mediaUrl(path) {
  if (!path) return path;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

api.interceptors.request.use((config) => {
  const stored = localStorage.getItem("ma_user");
  if (stored) {
    const { token } = JSON.parse(stored);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ============================================================================
   2. CONTEXTS — Auth + Cart
============================================================================ */
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("ma_user");
    return stored ? JSON.parse(stored) : null;
  });

  const persist = (data) => {
    localStorage.setItem("ma_user", JSON.stringify(data));
    setUser(data);
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    persist(data);
    return data;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    persist(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("ma_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
const useAuth = () => useContext(AuthContext);

const CartContext = createContext(null);

function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    const stored = localStorage.getItem("ma_cart");
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem("ma_cart", JSON.stringify(items));
  }, [items]);

  const addItem = (product, quantity = 1, color) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product === product._id && i.color === color);
      if (existing) {
        return prev.map((i) =>
          i.product === product._id && i.color === color ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { product: product._id, name: product.name, price: product.price, image: mediaUrl(product.images?.[0]), color, quantity }];
    });
  };

  const updateQuantity = (product, color, quantity) => {
    setItems((prev) =>
      prev.map((i) => (i.product === product && i.color === color ? { ...i, quantity } : i)).filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (product, color) => {
    setItems((prev) => prev.filter((i) => !(i.product === product && i.color === color)));
  };

  const clearCart = () => setItems([]);
  const itemsTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clearCart, itemsTotal, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}
const useCart = () => useContext(CartContext);

/* ============================================================================
   3. SHARED COMPONENTS
============================================================================ */
const navLinkClass = ({ isActive }) =>
  `text-sm tracking-widest2 uppercase transition-colors ${isActive ? "text-gold" : "text-ink/80 hover:text-ink"}`;

function Header() {
  const { itemCount } = useCart();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  return (
    <header className="bg-parchment text-ink sticky top-0 z-40 border-b border-stone/15">
      {/* Slim announcement bar — matches the reference site's maroon promo strip */}
      <div className="bg-gold text-parchment text-center text-xs tracking-wide py-2 px-4">
        Nationwide delivery across Pakistan &middot; Cash on Delivery &amp; Bank Transfer available
      </div>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
        <Link to="/" className="font-display text-2xl tracking-wide text-gold italic">
          Mehryat <span className="text-ink not-italic">Atelier</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          <NavLink to="/" end className={navLinkClass}>Home</NavLink>
          <NavLink to="/shop" className={navLinkClass}>Shop</NavLink>
          <NavLink to="/about" className={navLinkClass}>About</NavLink>
          <NavLink to="/contact" className={navLinkClass}>Contact</NavLink>
        </nav>
        <div className="flex items-center gap-5">
          <div className="hidden md:flex items-center gap-5">
            {user ? (
              <div className="flex items-center gap-4">
                <Link to="/orders" className={navLinkClass({ isActive: false })}>My Orders</Link>
                {user.role === "admin" && <Link to="/admin" className={navLinkClass({ isActive: false })}>Admin</Link>}
                <button onClick={logout} className="text-sm tracking-widest2 uppercase text-ink/80 hover:text-ink">Logout</button>
              </div>
            ) : (
              <Link to="/login" className={navLinkClass({ isActive: false })}>Login</Link>
            )}
          </div>
          <Link to="/cart" className="relative text-sm tracking-widest2 uppercase text-ink/80 hover:text-ink">
            Cart
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-gold text-parchment text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>
          {/* Hamburger toggle — mobile only */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            className="md:hidden flex flex-col justify-center gap-1.5 w-6 h-6"
          >
            <span className={`block h-0.5 bg-ink transition-transform duration-300 ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block h-0.5 bg-ink transition-opacity duration-300 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 bg-ink transition-transform duration-300 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${menuOpen ? "max-h-96 border-t border-stone/15" : "max-h-0"}`}>
        <nav className="flex flex-col px-6 py-4 gap-1">
          <NavLink to="/" end className={({ isActive }) => `py-3 text-sm tracking-widest2 uppercase ${isActive ? "text-gold" : "text-ink/80"}`}>Home</NavLink>
          <NavLink to="/shop" className={({ isActive }) => `py-3 text-sm tracking-widest2 uppercase ${isActive ? "text-gold" : "text-ink/80"}`}>Shop</NavLink>
          <NavLink to="/about" className={({ isActive }) => `py-3 text-sm tracking-widest2 uppercase ${isActive ? "text-gold" : "text-ink/80"}`}>About</NavLink>
          <NavLink to="/contact" className={({ isActive }) => `py-3 text-sm tracking-widest2 uppercase ${isActive ? "text-gold" : "text-ink/80"}`}>Contact</NavLink>
          <div className="h-px bg-stone/15 my-2" />
          {user ? (
            <>
              <Link to="/orders" className="py-3 text-sm tracking-widest2 uppercase text-ink/80">My Orders</Link>
              {user.role === "admin" && <Link to="/admin" className="py-3 text-sm tracking-widest2 uppercase text-ink/80">Admin</Link>}
              <button onClick={logout} className="py-3 text-left text-sm tracking-widest2 uppercase text-ink/80">Logout</button>
            </>
          ) : (
            <Link to="/login" className="py-3 text-sm tracking-widest2 uppercase text-ink/80">Login</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-mist text-ink/70 mt-24 border-t border-stone/15">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div>
          <h3 className="font-display text-xl text-gold italic mb-3">Mehryat <span className="text-ink not-italic">Atelier</span></h3>
          <p className="text-sm leading-relaxed max-w-xs">
            A modern Pakistani leather house crafting timeless, functional leather goods with a premium, international feel.
          </p>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-widest2 text-gold mb-3 font-semibold">Contact</h4>
          <p className="text-sm">Phone / WhatsApp: 0319 6157309</p>
          <p className="text-sm">support@mehryaatelier.com</p>
          <p className="text-sm mt-2">Nationwide delivery across Pakistan</p>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-widest2 text-gold mb-3 font-semibold">Shop</h4>
          <p className="text-sm">Wallets &amp; Card Holders</p>
          <p className="text-sm">Customized Pieces</p>
          <p className="text-sm">Special Editions</p>
        </div>
      </div>
      <div className="stitch-rule opacity-40" />
      <p className="text-center text-xs py-5">&copy; {new Date().getFullYear()} Mehryat Atelier. All rights reserved.</p>
    </footer>
  );
}

function ProductCard({ product }) {
  return (
    <Link to={`/product/${product.slug}`} className="group block">
      <div className="aspect-square overflow-hidden bg-stone/10">
        <img src={mediaUrl(product.images?.[0])} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="mt-4 flex items-start justify-between">
        <div>
          <p className="eyebrow">{product.category}</p>
          <h3 className="font-display text-lg mt-1">{product.name}</h3>
        </div>
        <p className="font-body text-sm text-espresso whitespace-nowrap ml-4 mt-1">Rs {product.price?.toLocaleString()}</p>
      </div>
    </Link>
  );
}

// Floating WhatsApp chat button — visible on every page.
// Update WHATSAPP_NUMBER (in international format, no + or spaces) if the
// business number ever changes.
const WHATSAPP_NUMBER = "923196157309";

function WhatsAppButton() {
  const message = encodeURIComponent("Hi! I have a question about Mehryat Atelier products.");
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
    >
      <svg viewBox="0 0 32 32" className="w-8 h-8 fill-white">
        <path d="M16.004 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.44 1.73 6.37L3.2 28.8l6.62-1.7a12.74 12.74 0 0 0 6.18 1.58h.005c7.06 0 12.8-5.74 12.8-12.8s-5.74-12.68-12.82-12.68zm0 23.06h-.004a10.6 10.6 0 0 1-5.4-1.48l-.387-.23-4.02 1.05 1.07-3.92-.253-.402a10.55 10.55 0 0 1-1.62-5.62c0-5.85 4.76-10.61 10.62-10.61 2.84 0 5.5 1.1 7.51 3.12a10.55 10.55 0 0 1 3.11 7.5c0 5.85-4.77 10.61-10.62 10.61zm5.82-7.94c-.32-.16-1.9-.94-2.19-1.04-.29-.11-.51-.16-.72.16-.21.32-.83 1.04-1.02 1.25-.19.21-.38.24-.7.08-.32-.16-1.34-.49-2.56-1.57-.95-.85-1.58-1.89-1.77-2.21-.19-.32-.02-.49.14-.65.14-.14.32-.38.48-.56.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.72-1.74-.99-2.38-.26-.62-.53-.54-.72-.55h-.62c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.67s1.14 3.1 1.3 3.31c.16.21 2.24 3.42 5.43 4.79.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.13-.29-.21-.61-.37z" />
      </svg>
    </a>
  );
}

function ProtectedRoute({ adminOnly = false }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}

/* ============================================================================
   4. PAGES — Storefront
============================================================================ */

// ---- Home (Bellroy-inspired: hero, category tiles, feature trio, style grid) ----
// Auto-advancing hero image slider with smooth sliding transitions, dot
// indicators, and manual prev/next controls. Pure CSS transform + React
// state — no external carousel library needed.
const HERO_SLIDES = [
  {
    eyebrow: "Handcrafted in Pakistan",
    heading: "Leather made for a",
    highlight: "lifetime of carry.",
    body: "Mehryat Atelier crafts timeless, functional leather goods — combining refined design with everyday practicality, built to a premium international standard.",
    caption: "Mehryat Atelier",
  },
  {
    eyebrow: "New Arrivals",
    heading: "Precision-cut,",
    highlight: "hand-stitched.",
    body: "Every seam is placed by hand. Every edge is burnished to last. This is leather goods made the slow way, on purpose.",
    caption: "New Arrivals",
  },
  {
    eyebrow: "Atelier / Special",
    heading: "For the pieces",
    highlight: "you'll carry for years.",
    body: "Our limited Atelier tier — exclusive finishes, subtle gold hardware, and customization for those who want something singular.",
    caption: "Atelier / Special",
  },
];

function HeroSlider() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  const goTo = (i) => setIndex(i);
  const prev = () => setIndex((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  const next = () => setIndex((i) => (i + 1) % HERO_SLIDES.length);

  return (
    <section className="relative bg-parchment text-ink overflow-hidden border-b border-stone/15">
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {HERO_SLIDES.map((slide, i) => (
            <div key={i} className="w-full flex-shrink-0">
              <div className="max-w-7xl mx-auto px-6 lg:px-10 py-28 lg:py-40 grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <p className="eyebrow mb-5">{slide.eyebrow}</p>
                  <h1 className="font-display text-5xl lg:text-6xl leading-[1.05] mb-6 text-ink">
                    {slide.heading}<span className="block italic text-gold">{slide.highlight}</span>
                  </h1>
                  <p className="text-stone max-w-md leading-relaxed mb-9">{slide.body}</p>
                  <div className="flex gap-4">
                    <Link to="/shop" className="btn-primary">Shop the Collection</Link>
                    <Link to="/about" className="btn-outline">Our Story</Link>
                  </div>
                </div>
                <div className="relative aspect-[4/5] hero-animated-bg flex items-center justify-center">
                  <p className="relative z-10 font-display text-2xl md:text-3xl text-espresso italic px-8 text-center">
                    {slide.caption}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prev / Next arrows */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-ink/5 hover:bg-ink/10 text-ink transition-colors"
      >
        &larr;
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-ink/5 hover:bg-ink/10 text-ink transition-colors"
      >
        &rarr;
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-8 bg-gold" : "w-1.5 bg-ink/20 hover:bg-ink/35"}`}
          />
        ))}
      </div>
    </section>
  );
}

function Home() {
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tiers, setTiers] = useState([]);

  useEffect(() => {
    api.get("/products/featured").then((res) => setFeatured(res.data)).catch(() => {});
    api.get("/products/categories").then((res) => setCategories(res.data.slice(0, 6))).catch(() => {});
    api.get("/tiers/all").then((res) => setTiers(res.data)).catch(() => {});
  }, []);

  return (
    <div>
      <HeroSlider />

      {/* Shop by price tier — Entry / Core / Premium / Atelier-Special */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <div className="text-center mb-12">
          <p className="eyebrow mb-2">Find Your Fit</p>
          <h2 className="font-display text-3xl">Shop by Collection</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tiers.map((tier) => (
            <Link
              key={tier.name}
              to={`/shop?tier=${encodeURIComponent(tier.name)}`}
              className="relative aspect-[3/4] bg-ink overflow-hidden group flex flex-col items-center justify-end p-6 text-center"
            >
              <img
                src={`https://placehold.co/600x800/1c1a17/c9a24b?text=${encodeURIComponent(tier.name)}`}
                alt={tier.name}
                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500"
              />
              <p className="relative font-display text-xl text-parchment z-10">{tier.name}</p>
              <p className="relative text-xs text-gold tracking-widest2 uppercase mt-2 z-10">
                Rs {tier.min?.toLocaleString()}&ndash;{tier.max?.toLocaleString()}
              </p>
            </Link>
          ))}
          {tiers.length === 0 && (
            <p className="text-stone col-span-full text-center">Collections will appear here shortly.</p>
          )}
        </div>
      </section>

      {/* Shop by category — tile grid, Bellroy "shop by activity" pattern */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <div className="text-center mb-12">
          <p className="eyebrow mb-2">Explore</p>
          <h2 className="font-display text-3xl">Shop by Category</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat}
              to={`/shop?category=${encodeURIComponent(cat)}`}
              className="relative aspect-[4/3] bg-espresso overflow-hidden group flex items-end p-5"
            >
              <img
                src="https://placehold.co/600x450/2e1f16/c9a24b?text=Mehryat+Atelier"
                alt={cat}
                className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
              />
              <p className="relative text-parchment font-display text-lg z-10">{cat}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-10"><div className="stitch-rule my-4" /></div>

      {/* Featured products */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="eyebrow mb-2">Signature Pieces</p>
            <h2 className="font-display text-3xl">Featured This Season</h2>
          </div>
          <Link to="/shop" className="text-sm tracking-widest2 uppercase text-espresso hover:text-gold">View All &rarr;</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-12">
          {featured.map((p) => <ProductCard key={p._id} product={p} />)}
          {featured.length === 0 && <p className="text-stone col-span-full">Featured products will appear here once added.</p>}
        </div>
      </section>

      {/* Feature trio — Bellroy "Better with age / Considered materials / Leather crafted" pattern */}
      <section className="bg-parchment border-y border-stone/15">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 grid md:grid-cols-3 gap-12">
          {[
            { title: "Considered Craftsmanship", body: "Every piece is cut, stitched and finished by hand, built to age gracefully with daily use." },
            { title: "Premium Leather", body: "We source full-grain leather chosen for its texture, durability and the way it develops character over time." },
            { title: "Timeless Design", body: "Minimal, masculine silhouettes designed to outlast trends — carry pieces you'll still love in ten years." },
          ].map((f) => (
            <div key={f.title}>
              <h3 className="font-display text-xl mb-3">{f.title}</h3>
              <p className="text-stone leading-relaxed text-sm">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Craft statement — light, editorial, matching the reference site's
          "Luxury, Legacy, Leather" intro block */}
      <section className="bg-parchment border-t border-stone/15">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-24 text-center">
          <p className="eyebrow mb-4">Craftsmanship</p>
          <h2 className="font-display text-3xl lg:text-4xl italic leading-snug text-ink">
            "Quality craftsmanship, refined design, and practical functionality — a distinctive Pakistani brand
            with an international feel."
          </h2>
        </div>
      </section>
    </div>
  );
}

function Shop() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("category") || "";
  const activeTier = searchParams.get("tier") || "";

  useEffect(() => {
    api.get("/products/categories").then((res) => setCategories(res.data)).catch(() => {});
    api.get("/tiers/all").then((res) => setTiers(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (activeCategory) params.category = activeCategory;
    if (activeTier) params.tier = activeTier;
    api.get("/products", { params }).then((res) => setProducts(res.data)).finally(() => setLoading(false));
  }, [activeCategory, activeTier]);

  const selectCategory = (cat) => {
    const next = {};
    if (cat) next.category = cat;
    if (activeTier) next.tier = activeTier;
    setSearchParams(next);
  };

  const selectTier = (tier) => {
    const next = {};
    if (tier) next.tier = tier;
    if (activeCategory) next.category = activeCategory;
    setSearchParams(next);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
      <div className="mb-12">
        <p className="eyebrow mb-2">The Collection</p>
        <h1 className="font-display text-4xl">Shop All Wallets &amp; Card Holders</h1>
      </div>

      {/* Visual collection tiles — same style as the homepage, shown above the
          filters so the Shop page also doubles as a browsable landing point
          for someone who arrives here directly. Clicking a tile filters the
          grid below to that tier. */}
      <div className="mb-14">
        <p className="text-xs uppercase tracking-widest2 text-stone mb-4">Shop by Collection</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tiers.map((t) => (
            <button
              key={t.name}
              onClick={() => selectTier(activeTier === t.name ? "" : t.name)}
              className={`relative aspect-[3/4] bg-ink overflow-hidden group flex flex-col items-center justify-end p-6 text-center transition-all ${activeTier === t.name ? "ring-2 ring-gold" : ""}`}
            >
              <img
                src={`https://placehold.co/600x800/1c1a17/c9a24b?text=${encodeURIComponent(t.name)}`}
                alt={t.name}
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${activeTier === t.name ? "opacity-90" : "opacity-60 group-hover:opacity-80 group-hover:scale-105"}`}
              />
              <p className="relative font-display text-xl text-parchment z-10">{t.name}</p>
              <p className="relative text-xs text-gold tracking-widest2 uppercase mt-2 z-10">
                Rs {t.min?.toLocaleString()}&ndash;{t.max?.toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest2 text-stone mb-3">Collection</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => selectTier("")} className={`text-xs uppercase tracking-widest2 px-4 py-2 border ${!activeTier ? "bg-ink text-parchment border-ink" : "border-stone/30 text-espresso hover:border-ink"}`}>All</button>
          {tiers.map((t) => (
            <button key={t.name} onClick={() => selectTier(t.name)} className={`text-xs uppercase tracking-widest2 px-4 py-2 border ${activeTier === t.name ? "bg-ink text-parchment border-ink" : "border-stone/30 text-espresso hover:border-ink"}`}>
              {t.name} <span className="opacity-60">(Rs {t.min?.toLocaleString()}&ndash;{t.max?.toLocaleString()})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-12">
        <p className="text-xs uppercase tracking-widest2 text-stone mb-3">Category</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => selectCategory("")} className={`text-xs uppercase tracking-widest2 px-4 py-2 border ${!activeCategory ? "bg-ink text-parchment border-ink" : "border-stone/30 text-espresso hover:border-ink"}`}>All</button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => selectCategory(cat)} className={`text-xs uppercase tracking-widest2 px-4 py-2 border ${activeCategory === cat ? "bg-ink text-parchment border-ink" : "border-stone/30 text-espresso hover:border-ink"}`}>{cat}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-stone">Loading products...</p>
      ) : products.length === 0 ? (
        <p className="text-stone">No products found for this filter yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-14">
          {products.map((p) => <ProductCard key={p._id} product={p} />)}
        </div>
      )}
    </div>
  );
}

function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    api.get(`/products/${slug}`).then((res) => {
      setProduct(res.data);
      setColor(res.data.variants?.[0]?.color || "");
    });
  }, [slug]);

  if (!product) return <div className="max-w-7xl mx-auto px-6 py-24 text-stone">Loading...</div>;

  const handleAddToCart = () => {
    addItem(product, quantity, color);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 grid lg:grid-cols-2 gap-16">
      <div className="aspect-square bg-stone/10">
        <img src={mediaUrl(product.images?.[0])} alt={product.name} className="w-full h-full object-cover" />
      </div>
      <div>
        <p className="eyebrow mb-3">{product.category}</p>
        <h1 className="font-display text-4xl mb-4">{product.name}</h1>
        <p className="text-2xl text-espresso mb-6">Rs {product.price?.toLocaleString()}</p>
        <p className="text-stone leading-relaxed mb-8">{product.description}</p>
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest2 mb-2">Dimensions ({product.sizeClass})</p>
          <p className="text-sm text-stone">{product.dimensions?.length}" L &times; {product.dimensions?.width}" W &times; {product.dimensions?.height}" H</p>
        </div>
        {product.variants?.length > 0 && (
          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest2 mb-3">Color</p>
            <div className="flex gap-3">
              {product.variants.map((v) => (
                <button key={v.color} onClick={() => setColor(v.color)} className={`px-4 py-2 text-sm border ${color === v.color ? "border-ink bg-ink text-parchment" : "border-stone/30"}`}>{v.color}</button>
              ))}
            </div>
          </div>
        )}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest2 mb-3">Quantity</p>
          <div className="flex items-center border border-stone/30 w-fit">
            <button className="px-4 py-2" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>&minus;</button>
            <span className="px-5">{quantity}</span>
            <button className="px-4 py-2" onClick={() => setQuantity((q) => q + 1)}>+</button>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={handleAddToCart} className="btn-primary">{added ? "Added ✓" : "Add to Cart"}</button>
          <button onClick={() => { handleAddToCart(); navigate("/cart"); }} className="btn-outline">Buy Now</button>
        </div>
      </div>
    </div>
  );
}

function Cart() {
  const { items, updateQuantity, removeItem, itemsTotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleCheckout = () => navigate(user ? "/checkout" : "/login?redirect=/checkout");

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-3xl mb-4">Your cart is empty</h1>
        <Link to="/shop" className="btn-primary mt-6">Continue Shopping</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-10 py-16">
      <h1 className="font-display text-4xl mb-10">Your Cart</h1>
      <div className="divide-y divide-stone/20">
        {items.map((item) => (
          <div key={`${item.product}-${item.color}`} className="py-6 flex gap-6 items-center">
            <img src={mediaUrl(item.image)} alt={item.name} className="w-24 h-24 object-cover bg-stone/10" />
            <div className="flex-1">
              <h3 className="font-display text-lg">{item.name}</h3>
              <p className="text-sm text-stone">Color: {item.color}</p>
              <p className="text-sm text-espresso mt-1">Rs {item.price.toLocaleString()}</p>
            </div>
            <div className="flex items-center border border-stone/30">
              <button className="px-3 py-1" onClick={() => updateQuantity(item.product, item.color, item.quantity - 1)}>&minus;</button>
              <span className="px-4">{item.quantity}</span>
              <button className="px-3 py-1" onClick={() => updateQuantity(item.product, item.color, item.quantity + 1)}>+</button>
            </div>
            <p className="w-28 text-right">Rs {(item.price * item.quantity).toLocaleString()}</p>
            <button onClick={() => removeItem(item.product, item.color)} className="text-stone hover:text-ink text-sm">Remove</button>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-10">
        <div className="w-full max-w-sm">
          <div className="flex justify-between text-lg mb-6"><span>Subtotal</span><span>Rs {itemsTotal.toLocaleString()}</span></div>
          <button onClick={handleCheckout} className="btn-primary w-full">Proceed to Checkout</button>
        </div>
      </div>
    </div>
  );
}

function Checkout() {
  const { items, itemsTotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [address, setAddress] = useState({
    fullName: user?.name || "", phone: "", houseNumber: "", street: "",
    city: "", state: "", postalCode: "", country: "",
  });

  useEffect(() => {
    api.get("/users/me").then((res) => {
      const saved = res.data.savedAddress;
      if (saved) {
        setAddress((a) => ({
          ...a,
          fullName: saved.fullName || res.data.name,
          phone: saved.phone || res.data.phone || "",
          houseNumber: saved.houseNumber || "",
          street: saved.street || "",
          city: saved.city || "",
          state: saved.state || "",
          postalCode: saved.postalCode || "",
          country: saved.country || "",
        }));
      }
    }).catch(() => {});
  }, []);

  const handleChange = (e) => setAddress({ ...address, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = { items: items.map((i) => ({ product: i.product, quantity: i.quantity, color: i.color })), shippingAddress: address, paymentMethod };
      const { data } = await api.post("/orders", payload);
      clearCart();
      navigate(`/orders/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong placing your order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-10 py-16 grid lg:grid-cols-2 gap-16">
      <form onSubmit={handleSubmit}>
        <h1 className="font-display text-3xl mb-8">Shipping Details</h1>
        {error && <p className="text-red-700 text-sm mb-4">{error}</p>}
        <div className="space-y-4">
          <input required name="fullName" placeholder="Full Name" value={address.fullName} onChange={handleChange} className="input" />
          <input required name="phone" placeholder="Phone Number with country code, e.g. +923001234567" value={address.phone} onChange={handleChange} className="input" />
          <div className="grid grid-cols-2 gap-4">
            <input required name="houseNumber" placeholder="House Number" value={address.houseNumber} onChange={handleChange} className="input" />
            <input required name="street" placeholder="Street" value={address.street} onChange={handleChange} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input required name="city" placeholder="City" value={address.city} onChange={handleChange} className="input" />
            <input name="state" placeholder="State / Province" value={address.state} onChange={handleChange} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input name="postalCode" placeholder="Postal Code" value={address.postalCode} onChange={handleChange} className="input" />
            <input name="country" placeholder="Country" value={address.country} onChange={handleChange} className="input" />
          </div>
        </div>
        <h2 className="font-display text-2xl mt-10 mb-4">Payment Method</h2>
        <div className="space-y-3">
          <label className={`flex items-center gap-3 border px-4 py-3 cursor-pointer ${paymentMethod === "Bank Transfer" ? "border-ink" : "border-stone/30"}`}>
            <input type="radio" name="paymentMethod" checked={paymentMethod === "Bank Transfer"} onChange={() => setPaymentMethod("Bank Transfer")} />
            <span>Pay Before Delivery <span className="text-stone text-sm">(Bank Transfer)</span></span>
          </label>
          <label className={`flex items-center gap-3 border px-4 py-3 cursor-pointer ${paymentMethod === "COD" ? "border-ink" : "border-stone/30"}`}>
            <input type="radio" name="paymentMethod" checked={paymentMethod === "COD"} onChange={() => setPaymentMethod("COD")} />
            <span>Pay After Delivery <span className="text-stone text-sm">(Cash on Delivery)</span></span>
          </label>
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full mt-10">{submitting ? "Placing Order..." : "Place Order"}</button>
      </form>
      <div>
        <h2 className="font-display text-2xl mb-6">Order Summary</h2>
        <div className="divide-y divide-stone/20">
          {items.map((item) => (
            <div key={`${item.product}-${item.color}`} className="py-4 flex justify-between">
              <div><p>{item.name}</p><p className="text-sm text-stone">{item.color} &times; {item.quantity}</p></div>
              <p>Rs {(item.price * item.quantity).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-lg pt-6 border-t border-stone/30 mt-2"><span>Total</span><span>Rs {itemsTotal.toLocaleString()}</span></div>
      </div>
    </div>
  );
}

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(form.email, form.password);
      navigate(searchParams.get("redirect") || "/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-24">
      <h1 className="font-display text-3xl mb-8">Sign In</h1>
      {error && <p className="text-red-700 text-sm mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
        <input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" />
        <button type="submit" className="btn-primary w-full">Sign In</button>
      </form>
      <p className="text-sm text-stone mt-4"><Link to="/forgot-password" className="text-ink underline">Forgot your password?</Link></p>
      <p className="text-sm text-stone mt-2">Don't have an account? <Link to="/register" className="text-ink underline">Create one</Link></p>
    </div>
  );
}

function ForgotPassword() {
  // emailEnabled comes from the server: emailed reset links only work once
  // SMTP is configured. When it isn't, the page leads with "request a new
  // password from our team" so customers are never promised an email that
  // will never arrive.
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [helpMessage, setHelpMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [helpSubmitting, setHelpSubmitting] = useState(false);

  useEffect(() => {
    api.get("/auth/reset-options").then((res) => setEmailEnabled(Boolean(res.data.emailEnabled))).catch(() => {});
  }, []);

  const handleSendLink = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const requestHelp = async (e) => {
    if (e) e.preventDefault();
    if (!email) {
      setError("Enter your email above first, then request help.");
      return;
    }
    setError("");
    setHelpMessage("");
    setHelpSubmitting(true);
    try {
      const { data } = await api.post("/auth/request-password-help", { email });
      setHelpMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setHelpSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-24">
      <h1 className="font-display text-3xl mb-4">Forgot Your Password?</h1>
      {error && <p className="text-red-700 text-sm mb-4">{error}</p>}

      {emailEnabled ? (
        <>
          <p className="text-sm text-stone mb-8">Enter your account email and we'll send you a link to reset your password.</p>
          {message && <p className="text-espresso text-sm mb-4">{message}</p>}
          <form onSubmit={handleSendLink} className="space-y-4">
            <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? "Sending..." : "Send Reset Link"}</button>
          </form>
          <div className="mt-8 pt-8 border-t border-stone/20">
            <p className="text-sm text-stone mb-3">Didn't get the email, or don't have access to it anymore?</p>
            {helpMessage ? (
              <p className="text-espresso text-sm">{helpMessage}</p>
            ) : (
              <button onClick={requestHelp} disabled={helpSubmitting} className="btn-outline w-full">
                {helpSubmitting ? "Sending Request..." : "Request a New Password From Our Team"}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-stone mb-8">
            Enter your account email. Our team will send you a new password on the phone / WhatsApp number registered on your account.
          </p>
          {helpMessage ? (
            <div className="border border-stone/20 p-5 text-sm text-espresso">{helpMessage}</div>
          ) : (
            <form onSubmit={requestHelp} className="space-y-4">
              <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
              <button type="submit" disabled={helpSubmitting} className="btn-primary w-full">
                {helpSubmitting ? "Sending Request..." : "Request a New Password"}
              </button>
            </form>
          )}
        </>
      )}

      <p className="text-sm text-stone mt-6"><Link to="/login" className="text-ink underline">Back to Sign In</Link></p>
    </div>
  );
}

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post(`/auth/reset-password/${token}`, { password });
      setMessage(data.message);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Could not reset password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-24">
      <h1 className="font-display text-3xl mb-8">Set a New Password</h1>
      {message && <p className="text-espresso text-sm mb-4">{message}</p>}
      {error && <p className="text-red-700 text-sm mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input required type="password" minLength={6} placeholder="New Password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        <input required type="password" minLength={6} placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" />
        <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? "Saving..." : "Reset Password"}</button>
      </form>
    </div>
  );
}

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "",
    country: "", state: "", city: "", postalCode: "", street: "", houseNumber: "",
  });
  const [error, setError] = useState("");

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-24">
      <h1 className="font-display text-3xl mb-8">Create Account</h1>
      {error && <p className="text-red-700 text-sm mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs uppercase tracking-widest2 text-stone pt-2">Account</p>
        <input required placeholder="Full Name" value={form.name} onChange={set("name")} className="input" />
        <input required type="email" placeholder="Email" value={form.email} onChange={set("email")} className="input" />
        <input required type="password" placeholder="Password" minLength={6} value={form.password} onChange={set("password")} className="input" />
        <input required placeholder="Phone Number with country code, e.g. +923001234567" value={form.phone} onChange={set("phone")} className="input" />

        <p className="text-xs uppercase tracking-widest2 text-stone pt-4">Delivery Address</p>
        <div className="grid grid-cols-2 gap-4">
          <input placeholder="House Number" value={form.houseNumber} onChange={set("houseNumber")} className="input" />
          <input placeholder="Street" value={form.street} onChange={set("street")} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input placeholder="City" value={form.city} onChange={set("city")} className="input" />
          <input placeholder="State / Province" value={form.state} onChange={set("state")} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input placeholder="Postal Code" value={form.postalCode} onChange={set("postalCode")} className="input" />
          <input placeholder="Country" value={form.country} onChange={set("country")} className="input" />
        </div>

        <button type="submit" className="btn-primary w-full">Create Account</button>
      </form>
      <p className="text-sm text-stone mt-6">Already have an account? <Link to="/login" className="text-ink underline">Sign in</Link></p>
    </div>
  );
}

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get("/orders/mine").then((res) => setOrders(res.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const cancelOrder = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Cancel this order? This can't be undone.")) return;
    try {
      await api.put(`/orders/${id}/cancel`, { reason: "Cancelled by customer — incomplete or incorrect order details" });
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Could not cancel this order");
    }
  };

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-24 text-stone">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-10 py-16">
      <h1 className="font-display text-4xl mb-10">My Orders</h1>
      {orders.length === 0 ? (
        <p className="text-stone">You haven't placed any orders yet.</p>
      ) : (
        <div className="divide-y divide-stone/20">
          {orders.map((order) => {
            const placed = order.statusHistory?.[0];
            const canCancel = !["Shipped", "Delivered", "Cancelled"].includes(order.status);
            return (
              <Link key={order._id} to={`/orders/${order._id}`} className="py-6 flex items-center justify-between hover:bg-stone/5 px-2 -mx-2">
                <div>
                  <p className="font-display text-lg">{order.orderNumber}</p>
                  <p className="text-sm text-stone">Placed {placed && `${new Date(placed.date).toLocaleDateString()} (${placed.dayOfWeek})`}</p>
                  <p className="text-sm text-stone">Payment: {order.paymentMethod}</p>
                  {order.messages?.length > 0 && order.messages[order.messages.length - 1].from === "admin" && (
                    <p className="text-xs text-gold mt-1">Reply from our team &mdash; open to read</p>
                  )}
                </div>
                <div className="text-right">
                  <p className={`text-xs uppercase tracking-widest2 ${order.status === "Cancelled" ? "text-red-700" : "text-gold"}`}>{order.status}</p>
                  <p className="mt-1">Rs {order.totalAmount.toLocaleString()}</p>
                  {canCancel && (
                    <button onClick={(e) => cancelOrder(order._id, e)} className="text-xs text-stone hover:text-red-700 underline mt-2">
                      Cancel Order
                    </button>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Shared order pieces: message thread + status history ----
// Two-way message thread on an order. `viewer` is "admin" or "customer":
// your own messages sit on the right, the other side's on the left.
function MessageThread({ messages = [], viewer, onSend }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError("");
    try {
      await onSend(text.trim());
      setText("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not send your message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {messages.length === 0 ? (
        <p className="text-sm text-stone mb-4">No messages yet.</p>
      ) : (
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {messages.map((m, i) => {
            const mine = m.from === viewer;
            return (
              <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-4 py-3 text-sm ${mine ? "bg-ink text-parchment" : "border border-stone/30"}`}>
                  <p className="text-[10px] uppercase tracking-widest2 opacity-70 mb-1">
                    {m.from === "admin" ? "Mehryat Atelier" : "Customer"} &middot; {new Date(m.date).toLocaleString()}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="text-red-700 text-sm mb-2">{error}</p>}
      <form onSubmit={submit} className="flex gap-3 items-end">
        <textarea rows={2} maxLength={1000} placeholder="Write a message..." value={text} onChange={(e) => setText(e.target.value)} className="input flex-1" />
        <button type="submit" disabled={sending || !text.trim()} className="btn-primary">{sending ? "Sending..." : "Send"}</button>
      </form>
    </div>
  );
}

// Every status change on an order, newest first, with any note the team added
// (e.g. a courier tracking number, or the reason for a cancellation).
function OrderUpdates({ history = [] }) {
  return (
    <ol className="space-y-3">
      {[...history].reverse().map((h, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${h.status === "Cancelled" ? "bg-red-600" : "bg-gold"}`} />
          <div>
            <p>
              <span className="font-semibold">{h.status}</span>{" "}
              <span className="text-stone">&mdash; {new Date(h.date).toLocaleString()} ({h.dayOfWeek})</span>
            </p>
            {h.note && <p className="text-stone">{h.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

const STAGES = ["Placed", "Processing", "Shipped", "Delivered"];

function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);

  const load = () => api.get(`/orders/${id}`).then((res) => setOrder(res.data));
  useEffect(() => { load(); }, [id]);

  if (!order) return <div className="max-w-4xl mx-auto px-6 py-24 text-stone">Loading...</div>;

  const historyFor = (status) => order.statusHistory.find((h) => h.status === status);
  const currentStageIndex = STAGES.indexOf(order.status);
  const canCancel = !["Shipped", "Delivered", "Cancelled"].includes(order.status);
  const cancellation = order.statusHistory.find((h) => h.status === "Cancelled");

  const sendMessage = async (text) => {
    const { data } = await api.post(`/orders/${id}/messages`, { text });
    setOrder(data);
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this order? This can't be undone.")) return;
    try {
      await api.put(`/orders/${id}/cancel`, { reason: "Cancelled by customer — incomplete or incorrect order details" });
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Could not cancel this order");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 lg:px-10 py-16">
      <div className="flex items-start justify-between mb-2">
        <p className="eyebrow">Order {order.orderNumber}</p>
        {canCancel && (
          <button onClick={handleCancel} className="text-sm text-stone hover:text-red-700 underline">Cancel This Order</button>
        )}
      </div>
      <h1 className="font-display text-3xl mb-10">Order Tracking</h1>
      {order.status !== "Cancelled" ? (
        <div className="mb-14">
          <div className="flex justify-between relative">
            <div className="absolute top-3 left-0 right-0 h-px bg-stone/30" />
            {STAGES.map((stage, idx) => {
              const reached = idx <= currentStageIndex;
              const record = historyFor(stage);
              return (
                <div key={stage} className="relative z-10 flex-1 flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${reached ? "bg-gold border-gold" : "bg-parchment border-stone/40"}`} />
                  <p className={`mt-3 text-xs uppercase tracking-widest2 ${reached ? "text-ink" : "text-stone"}`}>{stage}</p>
                  {record && <p className="text-xs text-stone mt-1 text-center">{new Date(record.date).toLocaleDateString()}<br />{record.dayOfWeek}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 text-red-800 px-5 py-4 mb-10">
          <p className="font-semibold mb-1">This order has been cancelled.</p>
          {cancellation && (
            <p className="text-sm">
              {cancellation.note} — {new Date(cancellation.date).toLocaleDateString()} ({cancellation.dayOfWeek})
            </p>
          )}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-10 mb-14">
        <div>
          <h2 className="font-display text-xl mb-3">Shipping Address</h2>
          <p className="text-sm text-stone leading-relaxed">
            {order.shippingAddress?.fullName}<br />
            {order.shippingAddress?.houseNumber} {order.shippingAddress?.street}<br />
            {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.postalCode}<br />
            {order.shippingAddress?.country}<br />
            {order.shippingAddress?.phone}
          </p>
        </div>
        <div>
          <h2 className="font-display text-xl mb-3">Payment</h2>
          <p className="text-sm text-stone">
            Method: {order.paymentMethod === "COD" ? "Pay After Delivery (Cash on Delivery)" : "Pay Before Delivery (Bank Transfer)"}
          </p>
          <p className="text-sm text-stone">Status: {order.paymentStatus}</p>
          {order.expectedProcessingDate && <p className="text-sm text-stone mt-2">Expected processing by {new Date(order.expectedProcessingDate).toLocaleDateString()}</p>}
        </div>
      </div>
      <h2 className="font-display text-xl mb-4">Order Updates</h2>
      <div className="mb-14"><OrderUpdates history={order.statusHistory} /></div>

      <h2 className="font-display text-xl mb-2">Messages</h2>
      <p className="text-sm text-stone mb-4">Questions about this order, or missing details? Message our team here &mdash; our replies appear below.</p>
      <div className="mb-14"><MessageThread messages={order.messages} viewer="customer" onSend={sendMessage} /></div>

      <h2 className="font-display text-xl mb-4">Items</h2>
      <div className="divide-y divide-stone/20 mb-10">
        {order.items.map((item, idx) => (
          <div key={idx} className="py-4 flex justify-between">
            <div><p>{item.name}</p><p className="text-sm text-stone">{item.color} &times; {item.quantity}</p></div>
            <p>Rs {(item.price * item.quantity).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-lg border-t border-stone/30 pt-6"><span>Total</span><span>Rs {order.totalAmount.toLocaleString()}</span></div>
    </div>
  );
}

function About() {
  return (
    <div className="max-w-3xl mx-auto px-6 lg:px-10 py-24">
      <p className="eyebrow mb-3">Our Story</p>
      <h1 className="font-display text-4xl mb-8">The Mehryat Atelier Philosophy</h1>
      <p className="text-stone leading-relaxed mb-6">Mehryat Atelier is a modern Pakistani leather brand focused on creating timeless, functional and premium leather products for everyday use.</p>
      <p className="text-stone leading-relaxed mb-6">Our goal is to combine quality craftsmanship, refined design and practical functionality while building a distinctive Pakistani brand with a premium international feel.</p>
      <div className="stitch-rule my-12" />
      <p className="text-stone leading-relaxed">Every piece is designed to communicate craftsmanship, quality, exclusivity and trust — without ever feeling overly complicated or flashy.</p>
    </div>
  );
}

function Contact() {
  return (
    <div className="max-w-2xl mx-auto px-6 lg:px-10 py-24">
      <p className="eyebrow mb-3">Get in Touch</p>
      <h1 className="font-display text-4xl mb-10">Contact Us</h1>
      <div className="space-y-6">
        <div><p className="text-xs uppercase tracking-widest2 text-gold mb-1">Phone / WhatsApp</p><p className="text-lg">0319 6157309</p></div>
        <div><p className="text-xs uppercase tracking-widest2 text-gold mb-1">Email</p><p className="text-lg">support@mehryaatelier.com</p></div>
        <div><p className="text-xs uppercase tracking-widest2 text-gold mb-1">Delivery</p><p className="text-lg">Nationwide delivery across Pakistan</p></div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-6 py-32 text-center">
      <h1 className="font-display text-5xl mb-4">404</h1>
      <p className="text-stone mb-8">This page could not be found.</p>
      <Link to="/" className="btn-primary">Return Home</Link>
    </div>
  );
}

/* ============================================================================
   5. PAGES — Admin
============================================================================ */
const adminLinkClass = ({ isActive }) => `block px-4 py-3 text-sm uppercase tracking-widest2 ${isActive ? "bg-ink text-parchment" : "text-espresso hover:bg-stone/10"}`;

function AdminLayout() {
  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 grid lg:grid-cols-[220px_1fr] gap-10">
      <aside className="border border-stone/20 h-fit">
        <NavLink to="/admin" end className={adminLinkClass}>Overview</NavLink>
        <NavLink to="/admin/products" className={adminLinkClass}>Products</NavLink>
        <NavLink to="/admin/orders" className={adminLinkClass}>Orders</NavLink>
        <NavLink to="/admin/password-requests" className={adminLinkClass}>Password Requests</NavLink>
      </aside>
      <div><Outlet /></div>
    </div>
  );
}

function AdminOverview() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/admin/overview").then((res) => setData(res.data)); }, []);
  if (!data) return <p className="text-stone">Loading...</p>;

  const stats = [
    { label: "Orders Today", value: data.ordersToday },
    { label: "Total Orders", value: data.totalOrders },
    { label: "Total Products", value: data.totalProducts },
    { label: "Total Customers", value: data.totalCustomers },
    { label: "Total Sales", value: `Rs ${data.totalSales.toLocaleString()}` },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl mb-8">Dashboard Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
        {stats.map((s) => (
          <div key={s.label} className="border border-stone/20 p-5">
            <p className="text-xs uppercase tracking-widest2 text-stone mb-2">{s.label}</p>
            <p className="font-display text-2xl">{s.value}</p>
          </div>
        ))}
      </div>
      <h2 className="font-display text-xl mb-4">Recent Orders</h2>
      <div className="divide-y divide-stone/20 border-t border-stone/20">
        {data.recentOrders.map((order) => (
          <Link key={order._id} to="/admin/orders" className="py-4 flex justify-between items-center hover:bg-stone/5">
            <div><p>{order.orderNumber}</p><p className="text-sm text-stone">{order.customer?.name}</p></div>
            <p className="text-xs uppercase tracking-widest2 text-gold">{order.status}</p>
            <p>Rs {order.totalAmount.toLocaleString()}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

const EMPTY_PRODUCT_FORM = {
  name: "", category: "", tier: "", sizeClass: "Standard Size", price: "", description: "",
  images: [], isFeatured: false, isActive: true,
  variants: [{ color: "Black", stock: 10 }, { color: "Deep Brown", stock: 10 }, { color: "Tan/Cognac", stock: 10 }],
};

// Shared create/edit form — a simple inline panel (no modal library needed).
function ProductForm({ initial, categories, tiers, onSaved, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_PRODUCT_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const data = new FormData();
      data.append("image", file);
      const res = await api.post("/admin/upload", data, { headers: { "Content-Type": "multipart/form-data" } });
      setField("images", [...(form.images || []), res.data.url]);
    } catch (err) {
      setError(err.response?.data?.message || "Image upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeImage = (url) => setField("images", form.images.filter((i) => i !== url));

  const updateVariantStock = (color, stock) => {
    setField("variants", form.variants.map((v) => (v.color === color ? { ...v, stock: Number(stock) } : v)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        totalStock: form.variants.reduce((sum, v) => sum + Number(v.stock || 0), 0),
        dimensions: form.sizeClass === "Long & Passport Size"
          ? { length: 8.5, width: 5, height: 1.5 }
          : { length: 4.5, width: 6, height: 1.5 },
      };
      if (form._id) {
        await api.put(`/admin/products/${form._id}`, payload);
      } else {
        if (!payload.images || payload.images.length === 0) {
          payload.images = ["https://placehold.co/800x800/1c1a17/c9a24b?text=Mehryat+Atelier"];
        }
        await api.post("/admin/products", payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border border-stone/20 p-6 mb-8 bg-parchment">
      <h2 className="font-display text-xl mb-6">{form._id ? "Edit Product" : "Add New Product"}</h2>
      {error && <p className="text-red-700 text-sm mb-4">{error}</p>}

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <input required placeholder="Product Name" value={form.name} onChange={(e) => setField("name", e.target.value)} className="input" />
        <select required value={form.category} onChange={(e) => setField("category", e.target.value)} className="input">
          <option value="">Select Category</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select required value={form.tier} onChange={(e) => setField("tier", e.target.value)} className="input">
          <option value="">Select Price Tier</option>
          {tiers.map((t) => <option key={t.name} value={t.name}>{t.name} (Rs {t.min?.toLocaleString()}&ndash;{t.max?.toLocaleString()})</option>)}
        </select>
        <select value={form.sizeClass} onChange={(e) => setField("sizeClass", e.target.value)} className="input">
          <option>Standard Size</option>
          <option>Long & Passport Size</option>
        </select>
        <input required type="number" min="0" placeholder="Price (Rs)" value={form.price} onChange={(e) => setField("price", e.target.value)} className="input" />
      </div>

      <textarea placeholder="Description" value={form.description} onChange={(e) => setField("description", e.target.value)} className="input mb-4" rows={3} />

      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest2 mb-2">Stock by Color</p>
        <div className="grid grid-cols-3 gap-3">
          {form.variants.map((v) => (
            <div key={v.color} className="flex items-center gap-2">
              <span className="text-sm w-24">{v.color}</span>
              <input type="number" min="0" value={v.stock} onChange={(e) => updateVariantStock(v.color, e.target.value)} className="input py-1" />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest2 mb-2">Product Photos</p>
        <div className="flex flex-wrap gap-3 mb-3">
          {(form.images || []).map((url) => (
            <div key={url} className="relative w-20 h-20">
              <img src={mediaUrl(url)} alt="" className="w-full h-full object-cover border border-stone/20" />
              <button type="button" onClick={() => removeImage(url)} className="absolute -top-2 -right-2 bg-ink text-parchment w-5 h-5 rounded-full text-xs">×</button>
            </div>
          ))}
        </div>
        <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} disabled={uploading} className="text-sm" />
        {uploading && <p className="text-xs text-stone mt-1">Uploading...</p>}
      </div>

      <div className="flex items-center gap-6 mb-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isFeatured} onChange={(e) => setField("isFeatured", e.target.checked)} /> Featured on homepage
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setField("isActive", e.target.checked)} /> Visible on site
        </label>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving || uploading} className="btn-primary">{saving ? "Saving..." : "Save Product"}</button>
        <button type="button" onClick={onCancel} className="btn-outline">Cancel</button>
      </div>
    </form>
  );
}

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...product} = edit
  const load = () => api.get("/admin/products").then((res) => setProducts(res.data));

  useEffect(() => {
    load();
    api.get("/categories/all").then((res) => setCategories(res.data)).catch(() => {});
    api.get("/tiers/all").then((res) => setTiers(res.data)).catch(() => {});
  }, []);

  const toggleActive = async (product) => { await api.put(`/admin/products/${product._id}`, { isActive: !product.isActive }); load(); };
  const deleteProduct = async (id) => { if (!confirm("Delete this product?")) return; await api.delete(`/admin/products/${id}`); load(); };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-display text-3xl">Products</h1>
        {!editing && <button onClick={() => setEditing({})} className="btn-primary">+ Add New Product</button>}
      </div>

      {editing && (
        <ProductForm
          initial={editing._id ? editing : null}
          categories={categories}
          tiers={tiers}
          onSaved={() => { setEditing(null); load(); }}
          onCancel={() => setEditing(null)}
        />
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone/30 text-left uppercase tracking-widest2 text-xs text-stone">
            <th className="py-3">Photo</th><th className="py-3">Name</th><th className="py-3">Category</th><th className="py-3">Price</th><th className="py-3">Stock</th><th className="py-3">Active</th><th className="py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone/10">
          {products.map((p) => (
            <tr key={p._id}>
              <td className="py-3"><img src={mediaUrl(p.images?.[0])} alt="" className="w-12 h-12 object-cover" /></td>
              <td className="py-3">{p.name}</td>
              <td className="py-3">{p.category}</td>
              <td className="py-3">Rs {p.price.toLocaleString()}</td>
              <td className="py-3">{p.totalStock}</td>
              <td className="py-3">
                <button onClick={() => toggleActive(p)} className={`text-xs px-3 py-1 border ${p.isActive ? "border-gold text-gold" : "border-stone/40 text-stone"}`}>{p.isActive ? "Active" : "Hidden"}</button>
              </td>
              <td className="py-3 space-x-3">
                <button onClick={() => setEditing(p)} className="text-espresso hover:text-gold">Edit</button>
                <button onClick={() => deleteProduct(p._id)} className="text-stone hover:text-red-700">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ORDER_STATUSES = ["Placed", "Processing", "Shipped", "Delivered", "Cancelled"];

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");

  const load = () => {
    const params = filter ? { status: filter } : {};
    api.get("/admin/orders", { params }).then((res) => setOrders(res.data));
  };
  useEffect(() => { load(); }, [filter]);

  // Last message is from the customer = they're waiting for our reply.
  const awaitingReply = (o) => o.messages?.length > 0 && o.messages[o.messages.length - 1].from === "customer";

  const updateStatus = async (id, status) => {
    let note;
    if (status === "Cancelled") {
      note = prompt("Reason for cancelling (the customer will see this):");
      if (note === null) { load(); return; } // admin backed out — reset the dropdown
    }
    try {
      await api.put(`/admin/orders/${id}/status`, { status, note });
    } catch (err) {
      alert(err.response?.data?.message || "Could not update this order");
    }
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-display text-3xl">Orders</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border border-stone/30 px-3 py-2 text-sm bg-transparent">
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {orders.length === 0 ? (
        <p className="text-stone">No orders{filter ? ` with status "${filter}"` : " yet"}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone/30 text-left uppercase tracking-widest2 text-xs text-stone">
                <th className="py-3">Order #</th><th className="py-3">Customer</th><th className="py-3">Payment</th><th className="py-3">Total</th><th className="py-3">Status</th><th className="py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone/10">
              {orders.map((order) => (
                <tr key={order._id}>
                  <td className="py-3">
                    <Link to={`/admin/orders/${order._id}`} className="text-espresso hover:text-gold underline">{order.orderNumber}</Link>
                    {awaitingReply(order) && <span className="block text-xs text-gold mt-1">Customer replied</span>}
                  </td>
                  <td className="py-3">{order.customer?.name}<br /><span className="text-stone text-xs">{order.customer?.phone}</span></td>
                  <td className="py-3">{order.paymentMethod}<br /><span className={`text-xs ${order.paymentStatus === "Paid" ? "text-gold" : "text-stone"}`}>{order.paymentStatus}</span></td>
                  <td className="py-3">Rs {order.totalAmount.toLocaleString()}</td>
                  <td className="py-3">
                    <select value={order.status} onChange={(e) => updateStatus(order._id, e.target.value)} className="border border-stone/30 px-2 py-1 bg-transparent text-xs">
                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="py-3"><Link to={`/admin/orders/${order._id}`} className="text-xs uppercase tracking-widest2 text-stone hover:text-ink whitespace-nowrap">Manage &rarr;</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Everything the admin needs for ONE order: customer + delivery details, items,
// payment, status updates with notes, cancel with a reason, and the message
// thread with the customer.
function AdminOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/admin/orders/${id}`).then((res) => { setOrder(res.data); setStatus(res.data.status); });
  useEffect(() => { load(); }, [id]);

  // Runs an API call that returns the updated order; shows any error on the page.
  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await fn();
      setOrder(data);
      setStatus(data.status);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!order) return <p className="text-stone">Loading...</p>;

  const updateStatus = async () => {
    if (status === order.status) { setError("Choose a different status first."); return; }
    if (await run(() => api.put(`/admin/orders/${id}/status`, { status, note }))) setNote("");
  };
  const cancelOrder = async () => {
    if (!confirm("Cancel this order? The customer will see it as cancelled, along with your reason.")) return;
    if (await run(() => api.put(`/admin/orders/${id}/status`, { status: "Cancelled", note: cancelReason }))) setCancelReason("");
  };
  const setPayment = (paymentStatus) => run(() => api.put(`/admin/orders/${id}/payment`, { paymentStatus }));
  const sendMessage = async (text) => {
    const { data } = await api.post(`/admin/orders/${id}/messages`, { text });
    setOrder(data);
  };

  const phoneDigits = (order.customer?.phone || "").replace(/\D/g, "");
  const canCancel = !["Cancelled", "Delivered"].includes(order.status);
  const a = order.shippingAddress || {};
  const placed = order.statusHistory?.[0];
  const paymentLabel = order.paymentMethod === "COD" ? "Pay After Delivery (Cash on Delivery)" : "Pay Before Delivery (Bank Transfer)";

  return (
    <div>
      <Link to="/admin/orders" className="text-sm text-stone hover:text-ink">&larr; All Orders</Link>

      <div className="flex flex-wrap items-end justify-between gap-4 mt-3 mb-8">
        <div>
          <p className="eyebrow mb-1">Order</p>
          <h1 className="font-display text-3xl">{order.orderNumber}</h1>
          {placed && <p className="text-sm text-stone mt-1">Placed {new Date(placed.date).toLocaleString()} ({placed.dayOfWeek})</p>}
        </div>
        <span className={`text-xs uppercase tracking-widest2 px-3 py-1 border ${order.status === "Cancelled" ? "border-red-300 text-red-700" : "border-gold text-gold"}`}>{order.status}</span>
      </div>

      {error && <p className="text-red-700 text-sm mb-4">{error}</p>}

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <section className="border border-stone/20 p-5">
          <h2 className="font-display text-lg mb-3">Customer</h2>
          <p className="text-sm">{order.customer?.name}</p>
          <p className="text-sm text-stone">{order.customer?.email}</p>
          <p className="text-sm text-stone mb-3">{order.customer?.phone}</p>
          {phoneDigits && (
            <a
              href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hello ${order.customer?.name}, this is Mehryat Atelier about your order ${order.orderNumber}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold text-xs"
            >
              Message on WhatsApp
            </a>
          )}
        </section>
        <section className="border border-stone/20 p-5">
          <h2 className="font-display text-lg mb-3">Delivery Address</h2>
          <p className="text-sm text-stone leading-relaxed">
            {a.fullName}<br />
            {a.houseNumber} {a.street}<br />
            {a.city}{a.state ? `, ${a.state}` : ""} {a.postalCode}<br />
            {a.country}<br />
            {a.phone}
          </p>
        </section>
      </div>

      <section className="border border-stone/20 p-5 mb-6">
        <h2 className="font-display text-lg mb-3">Payment</h2>
        <p className="text-sm text-stone">Method: {paymentLabel}</p>
        <p className="text-sm mb-3">Status: <span className={order.paymentStatus === "Paid" ? "text-gold font-semibold" : "text-stone"}>{order.paymentStatus}</span></p>
        {order.paymentStatus === "Pending" ? (
          <button onClick={() => setPayment("Paid")} disabled={busy} className="btn-outline text-xs">Mark as Paid</button>
        ) : (
          <button onClick={() => setPayment("Pending")} disabled={busy} className="btn-outline text-xs">Mark as Pending</button>
        )}
      </section>

      <section className="border border-stone/20 p-5 mb-6">
        <h2 className="font-display text-lg mb-3">Items</h2>
        <div className="divide-y divide-stone/10">
          {order.items.map((item, idx) => (
            <div key={idx} className="py-3 flex items-center gap-4">
              {item.image && <img src={mediaUrl(item.image)} alt="" className="w-12 h-12 object-cover bg-stone/10" />}
              <div className="flex-1">
                <p className="text-sm">{item.name}</p>
                <p className="text-xs text-stone">{item.color} &times; {item.quantity}</p>
              </div>
              <p className="text-sm">Rs {(item.price * item.quantity).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-stone/20 pt-3 mt-2">
          <span>Total</span>
          <span className="font-display text-lg">Rs {order.totalAmount.toLocaleString()}</span>
        </div>
      </section>

      <section className="border border-stone/20 p-5 mb-6">
        <h2 className="font-display text-lg mb-3">Update Progress</h2>
        <p className="text-xs text-stone mb-3">The customer sees each step, and your note, on their order page.</p>
        <div className="grid md:grid-cols-[180px_1fr_auto] gap-3">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the customer, e.g. courier tracking number" className="input" />
          <button onClick={updateStatus} disabled={busy} className="btn-primary">Update</button>
        </div>
      </section>

      {canCancel && (
        <section className="border border-red-200 p-5 mb-6">
          <h2 className="font-display text-lg mb-3 text-red-800">Cancel This Order</h2>
          <p className="text-xs text-stone mb-3">Use this if the order details are incomplete or wrong. The customer is shown the reason on their order page.</p>
          <div className="grid md:grid-cols-[1fr_auto] gap-3">
            <input value={cancelReason} maxLength={500} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason, e.g. delivery address incomplete" className="input" />
            <button onClick={cancelOrder} disabled={busy} className="border border-red-700 text-red-700 px-7 py-3 text-sm tracking-widest2 uppercase hover:bg-red-700 hover:text-white transition-colors">Cancel Order</button>
          </div>
        </section>
      )}

      <section className="border border-stone/20 p-5 mb-6">
        <h2 className="font-display text-lg mb-3">Order History</h2>
        <OrderUpdates history={order.statusHistory} />
      </section>

      <section className="border border-stone/20 p-5">
        <h2 className="font-display text-lg mb-3">Messages With Customer</h2>
        <MessageThread messages={order.messages} viewer="admin" onSend={sendMessage} />
      </section>
    </div>
  );
}

function AdminPasswordRequests() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("Pending");
  const [resolvedInfo, setResolvedInfo] = useState(null); // { newPassword, customer }

  const load = () => {
    const params = filter ? { status: filter } : {};
    api.get("/admin/password-requests", { params }).then((res) => setRequests(res.data));
  };
  useEffect(() => { load(); }, [filter]);

  const resolve = async (id) => {
    if (!confirm("Generate a new password for this customer? You'll need to send it to them yourself.")) return;
    const { data } = await api.post(`/admin/password-requests/${id}/resolve`);
    setResolvedInfo(data);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-display text-3xl">Password Requests</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border border-stone/30 px-3 py-2 text-sm bg-transparent">
          <option value="Pending">Pending</option>
          <option value="Resolved">Resolved</option>
          <option value="">All</option>
        </select>
      </div>

      {resolvedInfo && (
        <div className="border border-gold bg-parchment p-5 mb-8">
          <p className="font-display text-lg mb-2">New Password Generated</p>
          <p className="text-sm text-stone mb-3">
            Send this to <strong>{resolvedInfo.customer.name}</strong> yourself — it will not be shown again.
            <br />
            Email: {resolvedInfo.customer.email} {resolvedInfo.customer.phone && <>&middot; Phone: {resolvedInfo.customer.phone}</>}
          </p>
          <p className="font-mono text-xl bg-white border border-stone/30 px-4 py-2 inline-block mb-3">{resolvedInfo.newPassword}</p>
          <div className="flex flex-wrap gap-3">
            {resolvedInfo.customer.phone && (
              <a
                href={`https://wa.me/${resolvedInfo.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                  `Hello ${resolvedInfo.customer.name}, your new Mehryat Atelier password is: ${resolvedInfo.newPassword}\nPlease log in with it and keep it private.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold text-xs"
              >
                Send via WhatsApp
              </a>
            )}
            <button onClick={() => navigator.clipboard?.writeText(resolvedInfo.newPassword)} className="btn-outline text-xs">Copy Password</button>
            <button onClick={() => setResolvedInfo(null)} className="btn-outline text-xs">Dismiss</button>
          </div>
        </div>
      )}

      {requests.length === 0 ? (
        <p className="text-stone">No {filter ? filter.toLowerCase() : ""} requests.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone/30 text-left uppercase tracking-widest2 text-xs text-stone">
              <th className="py-3">Customer</th><th className="py-3">Email</th><th className="py-3">Phone</th><th className="py-3">Requested</th><th className="py-3">Status</th><th className="py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone/10">
            {requests.map((r) => (
              <tr key={r._id}>
                <td className="py-3">{r.name}</td>
                <td className="py-3">{r.email}</td>
                <td className="py-3">{r.phone}</td>
                <td className="py-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="py-3">
                  <span className={r.status === "Pending" ? "text-gold" : "text-stone"}>{r.status}</span>
                </td>
                <td className="py-3">
                  {r.status === "Pending" && (
                    <button onClick={() => resolve(r._id)} className="text-espresso hover:text-gold underline">Generate New Password</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ============================================================================
   6. APP ROOT + ROUTES
============================================================================ */
function AppShell() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
          </Route>

          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="orders/:id" element={<AdminOrderDetail />} />
              <Route path="password-requests" element={<AdminPasswordRequests />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppShell />
      </CartProvider>
    </AuthProvider>
  );
}
