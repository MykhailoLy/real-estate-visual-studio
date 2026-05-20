# ARCHITECTURE DECISION: Backend & Storage

## Option A vs Option B Comparison

---

## THE TWO OPTIONS

### Option A: Vercel Blob + Resend (File-Only Backend)
```
Next.js App → API Route → Vercel Blob (file storage) → Resend (emails)
                        → No database
                        → Orders tracked via email only
```

### Option B: Supabase + Resend (Full Backend)
```
Next.js App → API Route → Supabase Database (order records)
                        → Supabase Storage (uploaded files)
                        → Resend (emails)
```

---

## DETAILED COMPARISON

| Criteria | Option A (Vercel Blob) | Option B (Supabase) |
|----------|----------------------|---------------------|
| **File storage** | Vercel Blob (1 GB free, $0.023/GB after) | Supabase Storage (1 GB free, $0.021/GB after) |
| **Database** | None | PostgreSQL (500 MB free) |
| **Order records** | Only in email | Stored in database with status, timestamps |
| **Query orders** | Not possible | Full SQL queries, filters, sorting |
| **Authentication** | Not included | Built-in (Supabase Auth — free) |
| **Admin dashboard (future)** | Need to build from scratch + add a DB later | Query orders directly, build UI on top |
| **Client accounts (future)** | Need to add auth system later | Enable Supabase Auth (already there) |
| **Order status tracking** | Not possible without DB | Add `status` column, query by client |
| **Payment integration (future)** | Hard — no order record to update | Easy — update order record after payment |
| **Coupons (future)** | No place to store/validate | `coupons` table with validation logic |
| **File organization** | Flat blob storage | Organized in buckets by order/service |
| **Migration effort (MVP → V2)** | HIGH — must add database layer later | LOW — extend existing schema |
| **Setup complexity (MVP)** | Simpler — fewer moving parts | Slightly more — but still straightforward |
| **Vendor lock-in** | Vercel only | Supabase is open-source Postgres (portable) |
| **Backups** | Blob only (no data to backup) | Database backups (Pro plan), pg_dump anytime |

---

## COST COMPARISON (MVP Phase)

### Option A: Vercel Blob
| Resource | Free Tier | Monthly Cost |
|----------|-----------|-------------|
| Vercel Hosting (Hobby) | Included | $0 |
| Vercel Blob Storage | 1 GB | $0 |
| Vercel Blob Operations | 10K simple ops | $0 |
| Resend (email) | 100/day | $0 |
| **TOTAL** | | **$0/month** |

### Option B: Supabase + Vercel
| Resource | Free Tier | Monthly Cost |
|----------|-----------|-------------|
| Vercel Hosting (Hobby) | Included | $0 |
| Supabase Database | 500 MB | $0 |
| Supabase Storage | 1 GB | $0 |
| Supabase Auth | 50K MAU | $0 |
| Supabase API | Unlimited requests | $0 |
| Resend (email) | 100/day | $0 |
| **TOTAL** | | **$0/month** |

**Both options are free for MVP.** The cost difference only appears at scale (Pro plans).

---

## FUTURE SCALING COST

| Growth Stage | Option A | Option B |
|-------------|----------|----------|
| MVP (0-50 orders/month) | $0 | $0 |
| Growing (50-500 orders) | $0 + need to add DB ($25+) | $0 (still free tier) |
| Established (500+ orders) | $20 Vercel Pro + $25+ DB | $25 Supabase Pro |
| With admin dashboard | Major refactor required | Natural extension |

---

## MIGRATION PAIN: OPTION A → ADDING A DATABASE LATER

If you start with Option A and later need accounts/dashboard:
1. Choose and set up a database (Supabase, PlanetScale, etc.)
2. Design schema from scratch
3. Create migration scripts for any historical data (from where? emails?)
4. Rewrite API routes to write to DB instead of just emailing
5. Add authentication layer
6. Rebuild order retrieval logic
7. **Estimated effort: 2-4 days of refactoring**

If you start with Option B:
1. Add new columns/tables as needed
2. Build admin UI on top of existing data
3. Enable auth (already configured)
4. **Estimated effort: 0 days of refactoring — just extend**

---

## RECOMMENDATION

### ✅ OPTION B: Supabase + Resend

**Reasons:**

1. **Zero cost difference for MVP** — Both options are $0/month on free tiers.

2. **Future-proof from day one** — Every future feature you listed (accounts, order history, admin dashboard, statuses, coupons, payments) requires a database. Starting with one means zero migration pain.

3. **Order records are valuable data** — Even in MVP, having orders in a database means you can:
   - See how many orders you've received
   - Track which services are most popular
   - Know your conversion rate
   - Find a specific order without searching email

4. **Supabase is open-source Postgres** — No vendor lock-in. You can export your data anytime, or even self-host Supabase later.

5. **Built-in auth ready when needed** — When you want client accounts, it's one configuration change, not a whole new system.

6. **Storage is equivalent** — Supabase Storage and Vercel Blob are essentially the same price and capability. Supabase Storage organizes files into buckets (by order), which is cleaner.

7. **Admin dashboard becomes trivial** — Want to see all orders? `SELECT * FROM orders`. Want pending orders? `WHERE status = 'pending'`. This is impossible without a database.

8. **Setup complexity is minimal** — Adding Supabase to a Next.js project takes ~15 minutes. It's one `npm install` and a few environment variables.

---

## MVP DATABASE SCHEMA (Simple)

```sql
-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,        -- e.g., "VS-0001"
  service_type TEXT NOT NULL,               -- "virtual-staging" | "virtual-renovation" | "floor-plans" | "photo-editing"
  status TEXT DEFAULT 'pending',            -- "pending" | "confirmed" | "in-progress" | "delivered"
  
  -- Client info
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_company TEXT,
  
  -- Order details
  item_count INTEGER NOT NULL,
  estimated_total DECIMAL(10,2),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL,
  
  -- File references (Supabase Storage paths)
  original_photo_url TEXT,
  reference_image_url TEXT,
  
  -- Service-specific fields (stored as JSONB for flexibility)
  details JSONB NOT NULL,
  -- For staging: { "room_type": "Living Room", "style": "Modern", "notes": "...", "reference_link": "..." }
  -- For renovation: { "instructions": "...", "keep": "...", "remove": "...", "replace": "...", "materials": "..." }
  -- For floor plans: { "property_type": "Apartment", "floors": 2, "output_type": "3D" }
  -- For photo editing: { "editing_types": ["Sky replacement", "HDR"], "notes": "..." }
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order number sequence (auto-increment per service type)
CREATE TABLE order_sequences (
  service_type TEXT PRIMARY KEY,
  last_number INTEGER DEFAULT 0
);

-- Initialize sequences
INSERT INTO order_sequences (service_type, last_number) VALUES
  ('virtual-staging', 0),
  ('virtual-renovation', 0),
  ('floor-plans', 0),
  ('photo-editing', 0);
```

### Storage Bucket Structure:
```
orders/
├── VS-0001/
│   ├── item-1-original.jpg
│   ├── item-1-reference.jpg
│   ├── item-2-original.jpg
│   └── item-2-reference.png
├── VS-0002/
│   └── ...
├── VR-0001/
│   └── ...
└── FP-0001/
    ├── floor-plan-sketch.pdf
    └── photos/
        ├── photo-1.jpg
        └── photo-2.jpg
```

---

## FINAL TECH STACK (CONFIRMED)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 14+ (App Router) | Full-stack React, SSG, API routes |
| **Language** | TypeScript | Type safety |
| **Styling** | Tailwind CSS | Rapid, consistent styling |
| **Database** | Supabase (PostgreSQL) | Order records, future accounts |
| **File Storage** | Supabase Storage | Uploaded images/files |
| **Email** | Resend | Order confirmations + admin notifications |
| **Auth (future)** | Supabase Auth | Client accounts when ready |
| **Hosting** | Vercel | Free tier, auto-deploy from GitHub |
| **Forms** | React Hook Form + Zod | Validation, repeatable fields |
| **UI Libs** | Framer Motion, react-compare-slider, Embla Carousel | Animations, before/after, carousels |
| **File Upload** | react-dropzone | Drag-and-drop uploads |

### Environment Variables Needed:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  (server-side only)

# Resend
RESEND_API_KEY=re_xxxxx

# App Config
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
ADMIN_EMAIL=your@email.com
```

---

## INITIAL PROJECT SETUP PLAN

### Step 1: Initialize Next.js Project
```
- npx create-next-app@latest with:
  - TypeScript: Yes
  - Tailwind CSS: Yes
  - App Router: Yes
  - ESLint: Yes
  - src/ directory: Yes
  - import alias: @/
- Remove boilerplate (default page content, unused CSS)
```

### Step 2: Install Dependencies
```
Core UI:
- framer-motion
- react-compare-slider
- embla-carousel-react
- yet-another-react-lightbox
- lucide-react (icons)
- clsx + tailwind-merge (className utility)

Forms:
- react-hook-form
- @hookform/resolvers
- zod
- react-dropzone

Backend:
- @supabase/supabase-js
- resend
- next-sitemap
```

### Step 3: Set Up Supabase Project
```
- Create Supabase project (free tier)
- Run schema migration (orders, order_items, order_sequences tables)
- Create storage bucket: "order-files" (private)
- Set storage policies (authenticated upload for API, public read disabled)
- Get connection credentials (URL, anon key, service role key)
```

### Step 4: Configure Project Structure
```
- Create folder structure as defined in WEBSITE-PLAN-PHASE1-MVP.md Section 6
- Set up Tailwind theme (colors, fonts, breakpoints)
- Create lib/supabase.ts (client initialization)
- Create lib/utils.ts (cn helper, formatCurrency)
- Create types/index.ts (Order, OrderItem, Service types)
- Create data/ files (services, pricing constants)
```

### Step 5: Environment & Deployment Config
```
- Create .env.local with all required variables
- Create .env.example (template without secrets)
- Add .env.local to .gitignore
- Configure next.config.ts (image domains, etc.)
- Test: npm run dev starts without errors
- Test: Supabase connection works
- Commit and push initial setup to GitHub
```

### Deliverable After Setup:
```
✅ Next.js app running locally (empty pages)
✅ Tailwind configured with custom theme
✅ Supabase connected (database + storage)
✅ All dependencies installed
✅ Folder structure in place
✅ Type definitions created
✅ Environment variables configured
✅ Pushed to GitHub, deployable on Vercel
```

---

*Decision made: May 2026*
*Status: AWAITING APPROVAL*
*Next step: Upon approval, execute the setup plan (Step 1-5)*
