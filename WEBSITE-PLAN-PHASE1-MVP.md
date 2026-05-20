# PHASE 1 MVP — WEBSITE PLAN
## Real Estate Visual Marketing Studio
## Alicante & Costa Blanca | Remote Digital Services Worldwide

---

## 1. FINAL PHASE 1 SITEMAP

| # | Page | URL | Purpose |
|---|------|-----|---------|
| 1 | Homepage | `/` | Hero, value proposition, convert visitors |
| 2 | Services | `/services` | All 9 services as sections (Remote + Local) |
| 3 | Portfolio | `/portfolio` | Gallery with category filters |
| 4 | Pricing | `/pricing` | Transparent per-image/service pricing |
| 5 | Order | `/order` | Online order system for remote services |
| 6 | About | `/about` | Story, team, credentials |
| 7 | FAQ | `/faq` | Common questions, reduce friction |
| 8 | Contact | `/contact` | Booking for local services + general inquiries |
| 9 | Privacy Policy | `/privacy` | GDPR compliance |
| 10 | Terms & Conditions | `/terms` | Order policies, revision policy, liability |

**Total: 10 pages**

### Navigation Structure:
```
[Logo]  Services | Portfolio | Pricing | Order | About | FAQ | Contact
```

### Footer Links:
```
Services | Portfolio | Pricing | About | FAQ | Contact | Privacy | Terms
```


---

## 2. HOMEPAGE WIREFRAME

```
┌─────────────────────────────────────────────────────────────────┐
│ [Logo]    Services | Portfolio | Pricing | Order | About | FAQ  │
│                                                    | Contact    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ████████████████████████████████████████████████████████████   │
│  █                                                           █  │
│  █            HERO — Full-width before/after image            █  │
│  █                   or background video                      █  │
│  █                                                           █  │
│  █   H1: "Real Estate Visual Marketing That Sells Faster"    █  │
│  █                                                           █  │
│  █   P: Virtual staging & photo editing worldwide.            █  │
│  █      Photography & video in Alicante & Costa Blanca.       █  │
│  █                                                           █  │
│  █   [ Order Online ]    [ View Portfolio ]                   █  │
│  █                                                           █  │
│  █   Trust bar: X properties | 48h delivery | Costa Blanca   █  │
│  █                                                           █  │
│  ████████████████████████████████████████████████████████████   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SECTION: TWO SERVICE CATEGORIES                                │
│  H2: "Two Ways We Help You Sell"                                │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │ REMOTE DIGITAL SERVICES │  │ LOCAL SERVICES               │  │
│  │ "Order from anywhere"   │  │ "Alicante & Costa Blanca"    │  │
│  │                         │  │                              │  │
│  │ • Virtual Staging       │  │ • Real Estate Photography    │  │
│  │ • Virtual Renovation    │  │ • 360 Virtual Tours          │  │
│  │ • 3D Floor Plans        │  │ • Property Video Tours       │  │
│  │ • Photo Editing         │  │ • Drone Photography*         │  │
│  │ • Decluttering          │  │   (*where permitted)         │  │
│  │                         │  │                              │  │
│  │ [ Order Online → ]      │  │ [ Book a Shoot → ]           │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SECTION: BEFORE/AFTER SHOWCASE                                 │
│  H2: "See the Transformation"                                   │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │◄──[SLIDER]──►│  │◄──[SLIDER]──►│  │◄──[SLIDER]──►│          │
│  │  Before/After │  │  Before/After │  │  Before/After │         │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  [ View Full Portfolio → ]                                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SECTION: HOW IT WORKS                                          │
│  H2: "Simple Process, Stunning Results"                         │
│                                                                 │
│  Remote:                                                        │
│  [1. Upload photos] → [2. Choose style] → [3. Get results 24-48h]│
│                                                                 │
│  Local:                                                         │
│  [1. Book online] → [2. We shoot] → [3. Files delivered 24-48h] │
│                                                                 │
│  [ Start Your Order → ]                                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SECTION: PORTFOLIO PREVIEW                                     │
│  H2: "Our Latest Work"                                          │
│                                                                 │
│  [img] [img] [img] [img]                                        │
│  [img] [img] [img] [img]                                        │
│                                                                 │
│  [ See All Projects → ]                                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SECTION: TESTIMONIALS                                          │
│  H2: "What Agents Say"                                          │
│                                                                 │
│  ◄ [ "Quote..." — Agent Name, Company ] ►                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SECTION: FINAL CTA                                             │
│  H2: "Ready to Elevate Your Listings?"                          │
│                                                                 │
│  [ Order Remote Services ]    [ Book a Local Shoot ]            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  FOOTER                                                         │
│  Logo | Nav links | Service area cities | Social icons          │
│  Privacy | Terms | © 2026                                       │
└─────────────────────────────────────────────────────────────────┘
```


---

## 3. SERVICES PAGE WIREFRAME (`/services`)

```
┌─────────────────────────────────────────────────────────────────┐
│  HERO                                                           │
│  H1: "Complete Visual Marketing for Real Estate"                │
│  P: "Digital services for agents worldwide.                     │
│      On-location shoots in Alicante & Costa Blanca."            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ═══════════════════════════════════════════════════════════     │
│  SECTION: REMOTE DIGITAL SERVICES                               │
│  H2: "Remote Digital Services — Order from Anywhere"            │
│  P: "Upload photos, choose preferences, receive results         │
│      in 24-48 hours."                                           │
│  ═══════════════════════════════════════════════════════════     │
│                                                                 │
│  ┌─── SERVICE BLOCK: VIRTUAL STAGING ──────────────────────┐   │
│  │ [Before/After image]                                     │   │
│  │ H3: Virtual Staging                                      │   │
│  │ Description (2-3 sentences)                              │   │
│  │ What you get: • Furnished room render • Multiple styles  │   │
│  │ • 1 revision included • High-res JPG                     │   │
│  │ Price: From €XX/image                                    │   │
│  │ [ Order Virtual Staging → ]                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── SERVICE BLOCK: VIRTUAL RENOVATION ───────────────────┐   │
│  │ [Before/After image]                                     │   │
│  │ H3: Virtual Renovation                                   │   │
│  │ Description (2-3 sentences)                              │   │
│  │ What you get: • Realistic renovation render • Materials  │   │
│  │ selection • 1 revision • High-res JPG                    │   │
│  │ Price: From €XX/image                                    │   │
│  │ [ Order Virtual Renovation → ]                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── SERVICE BLOCK: 3D FLOOR PLANS ──────────────────────┐    │
│  │ [Sample floor plan image]                                │   │
│  │ H3: 3D Floor Plans                                       │   │
│  │ Description (2-3 sentences)                              │   │
│  │ What you get: • 2D or 3D plan • Accurate measurements   │   │
│  │ • Branded option • PDF + JPG                             │   │
│  │ Price: From €XX/plan                                     │   │
│  │ [ Order Floor Plan → ]                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── SERVICE BLOCK: PHOTO EDITING ───────────────────────┐    │
│  │ [Before/After image]                                     │   │
│  │ H3: Real Estate Photo Editing                            │   │
│  │ Description (2-3 sentences)                              │   │
│  │ What you get: • HDR blending • Sky replacement • Color   │   │
│  │ correction • Lens correction • High-res files            │   │
│  │ Price: From €XX/image                                    │   │
│  │ [ Order Photo Editing → ]                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── SERVICE BLOCK: DECLUTTERING ────────────────────────┐    │
│  │ [Before/After image]                                     │   │
│  │ H3: Decluttering / Object Removal                        │   │
│  │ Description (2-3 sentences)                              │   │
│  │ What you get: • Clean image • Objects removed •          │   │
│  │ Realistic fill • High-res JPG                            │   │
│  │ Price: From €XX/image                                    │   │
│  │ [ Order Decluttering → ]                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ═══════════════════════════════════════════════════════════     │
│  SECTION: LOCAL SERVICES                                        │
│  H2: "On-Location Services — Alicante & Costa Blanca"           │
│  P: "Our team comes to your property. Covering Alicante         │
│      province from Denia to Torrevieja."                        │
│  ═══════════════════════════════════════════════════════════     │
│                                                                 │
│  ┌─── SERVICE BLOCK: REAL ESTATE PHOTOGRAPHY ─────────────┐    │
│  │ [Gallery row: 3-4 sample photos]                         │   │
│  │ H3: Real Estate Photography                              │   │
│  │ Description + equipment + deliverables                   │   │
│  │ Price: From €XXX/property                                │   │
│  │ [ Book a Shoot → ]                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── SERVICE BLOCK: 360 VIRTUAL TOURS ───────────────────┐    │
│  │ [360 tour embed or screenshot]                           │   │
│  │ H3: 360 Virtual Tours                                    │   │
│  │ Description + what's included                            │   │
│  │ Price: From €XXX/property                                │   │
│  │ [ Book a Tour → ]                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── SERVICE BLOCK: VIDEO TOURS ─────────────────────────┐    │
│  │ [Video thumbnail or embed]                               │   │
│  │ H3: Property Video Tours                                 │   │
│  │ Description + deliverables                               │   │
│  │ Price: From €XXX/property                                │   │
│  │ [ Book Video Tour → ]                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── SERVICE BLOCK: DRONE PHOTOGRAPHY ───────────────────┐    │
│  │ [Aerial sample photo]                                    │   │
│  │ H3: Drone / Aerial Photography & Video                   │   │
│  │ Description + note about legal restrictions              │   │
│  │ ⚠️ "Available only where flight regulations permit"      │   │
│  │ Price: From €XXX                                         │   │
│  │ [ Request a Quote → ]                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  SECTION: SERVICE AREA MAP                                      │
│  Visual map of Alicante / Costa Blanca coverage                 │
│  Cities: Alicante, Benidorm, Torrevieja, Javea, Denia,          │
│  Calpe, Orihuela Costa, Elche, Santa Pola, Villajoyosa...       │
├─────────────────────────────────────────────────────────────────┤
│  CTA BAR                                                        │
│  "Not sure what you need?"                                      │
│  [ Order Online ] [ Contact Us for Advice ]                     │
└─────────────────────────────────────────────────────────────────┘
```


---

## 4. ORDER PAGE WIREFRAME (`/order`)

```
┌─────────────────────────────────────────────────────────────────┐
│  H1: "Order Remote Services"                                    │
│  P: "Upload your photos, select preferences, and receive        │
│      results in 24-48 hours."                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────┐  ┌─────────────────────┐  │
│  │          MAIN FORM              │  │  ORDER SUMMARY       │  │
│  │                                 │  │  (sticky sidebar)    │  │
│  │  ─── STEP 1: SELECT SERVICE ── │  │                      │  │
│  │                                 │  │  Service: —          │  │
│  │  ┌─────┐┌─────┐┌─────┐┌─────┐ │  │  Items: 0            │  │
│  │  │Stag-││Reno-││Floor││Photo│ │  │  Price/item: €—       │  │
│  │  │ing  ││vate ││Plan ││Edit │ │  │  ──────────────       │  │
│  │  └─────┘└─────┘└─────┘└─────┘ │  │  Est. Total: €0      │  │
│  │                                 │  │                      │  │
│  │  ─── STEP 2: ADD ITEMS ─────── │  │                      │  │
│  │                                 │  │                      │  │
│  │  ┌─ ITEM CARD #1 ───────────┐  │  │                      │  │
│  │  │ [📁 Upload Photo]         │  │  │                      │  │
│  │  │                           │  │  │                      │  │
│  │  │ Room type: [Dropdown ▼]   │  │  │                      │  │
│  │  │ Style: [Dropdown ▼]       │  │  │                      │  │
│  │  │ Notes: [___________]      │  │  │                      │  │
│  │  │ Ref link: [___________]   │  │  │                      │  │
│  │  │ Ref image: [📁 Upload]    │  │  │                      │  │
│  │  │                    [🗑️]    │  │  │                      │  │
│  │  └───────────────────────────┘  │  │                      │  │
│  │                                 │  │                      │  │
│  │  ┌─ ITEM CARD #2 ───────────┐  │  │                      │  │
│  │  │ (same fields...)          │  │  │                      │  │
│  │  └───────────────────────────┘  │  │                      │  │
│  │                                 │  │                      │  │
│  │  [ + Add Another Image ]        │  │                      │  │
│  │                                 │  │                      │  │
│  │  ─── STEP 3: YOUR DETAILS ──── │  │                      │  │
│  │                                 │  │                      │  │
│  │  Name*: [_______________]       │  │                      │  │
│  │  Email*: [_______________]      │  │                      │  │
│  │  Phone*: [_______________]      │  │                      │  │
│  │  Company: [_______________]     │  │                      │  │
│  │                                 │  │                      │  │
│  │  ☐ I agree to Terms &          │  │                      │  │
│  │    Conditions                   │  │                      │  │
│  │                                 │  │  ┌────────────────┐  │  │
│  │                                 │  │  │ SUBMIT ORDER   │  │  │
│  │                                 │  │  └────────────────┘  │  │
│  │                                 │  │                      │  │
│  │                                 │  │  "No payment now.    │  │
│  │                                 │  │   We confirm &       │  │
│  │                                 │  │   invoice after      │  │
│  │                                 │  │   review."           │  │
│  └─────────────────────────────────┘  └─────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ON SUBMIT → CONFIRMATION STATE:                                │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ✅ "Thank you! Order #VS-0042 received."                │   │
│  │                                                           │   │
│  │  "We'll review your files and confirm details             │   │
│  │   within 2 hours during business hours."                  │   │
│  │                                                           │   │
│  │  "A confirmation email has been sent to your@email.com"   │   │
│  │                                                           │   │
│  │  [ Place Another Order ]  [ Back to Homepage ]            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Form Fields by Service Type:

#### VIRTUAL STAGING
| Field | Type | Required |
|-------|------|----------|
| Original photo | File upload (JPG/PNG, max 20MB) | ✅ |
| Room type | Dropdown: Living Room, Bedroom, Kitchen, Bathroom, Dining Room, Office, Outdoor/Terrace, Other | ✅ |
| Interior style | Dropdown: Modern, Scandinavian, Mid-Century, Industrial, Coastal, Classic, Minimalist, Rustic, Luxury, Other | ✅ |
| Notes / instructions | Textarea | ❌ |
| Reference link | URL input | ❌ |
| Reference image | File upload | ❌ |

#### VIRTUAL RENOVATION
| Field | Type | Required |
|-------|------|----------|
| Original photo | File upload | ✅ |
| Renovation instructions | Textarea | ✅ |
| Elements to keep | Textarea | ❌ |
| Elements to remove | Textarea | ❌ |
| Elements to replace | Textarea | ❌ |
| Preferred materials / style | Textarea | ❌ |
| Reference link | URL input | ❌ |
| Reference image | File upload | ❌ |
| Additional notes | Textarea | ❌ |

#### 3D FLOOR PLANS
| Field | Type | Required |
|-------|------|----------|
| Upload files (plan/sketch/photos) | File upload (multiple) | ✅ |
| Property type | Dropdown: Apartment, House, Villa, Commercial, Other | ✅ |
| Number of floors | Number input (1-10) | ✅ |
| Output type | Radio: 2D / 3D / Both | ✅ |
| Notes | Textarea | ❌ |

#### REAL ESTATE PHOTO EDITING
| Field | Type | Required |
|-------|------|----------|
| Original photo | File upload | ✅ |
| Editing required | Checkboxes: Color correction, HDR blending, Sky replacement, Lens correction, Object removal, Twilight conversion, Grass/garden enhancement, Other | ✅ (min 1) |
| Notes / instructions | Textarea | ❌ |
| Reference image | File upload | ❌ |


---

## 5. PORTFOLIO PAGE WIREFRAME (`/portfolio`)

```
┌─────────────────────────────────────────────────────────────────┐
│  H1: "Our Work"                                                 │
│  P: "Real results for real estate professionals."               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FILTER TABS:                                                   │
│  [ All ] [ Virtual Staging ] [ Renovation ] [ Photography ]     │
│  [ Video & Drone ] [ Floor Plans ]                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MASONRY GRID:                                                  │
│                                                                 │
│  ┌─────────┐ ┌──────────────┐ ┌─────────┐                     │
│  │         │ │              │ │         │                       │
│  │  img 1  │ │    img 2     │ │  img 3  │                       │
│  │         │ │              │ │         │                       │
│  │ [tag]   │ │   [tag]      │ │ [tag]   │                       │
│  └─────────┘ └──────────────┘ └─────────┘                       │
│  ┌──────────────┐ ┌─────────┐ ┌─────────┐                     │
│  │              │ │         │ │         │                       │
│  │    img 4     │ │  img 5  │ │  img 6  │                       │
│  │              │ │         │ │         │                       │
│  │   [tag]      │ │ [tag]   │ │ [tag]   │                       │
│  └──────────────┘ └─────────┘ └─────────┘                       │
│                                                                 │
│  (Each image: clickable → opens lightbox with                   │
│   before/after comparison or full-size view)                    │
│                                                                 │
│  [ Load More ] (if >12 items)                                   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  CTA BAR                                                        │
│  "Like what you see?"                                           │
│  [ Order the Same Results → ]  [ Contact Us → ]                 │
└─────────────────────────────────────────────────────────────────┘
```

### Portfolio Item Data Model:
```
{
  id: string,
  title: string,
  category: "virtual-staging" | "renovation" | "photography" | "video-drone" | "floor-plans",
  imageBefore: string (URL),  // optional for non-staging
  imageAfter: string (URL),
  thumbnail: string (URL),
  description: string,        // optional short caption
  tags: string[]              // e.g. ["Modern", "Living Room", "Apartment"]
}
```


---

## 6. RECOMMENDED COMPONENT STRUCTURE

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (header, footer, fonts)
│   ├── page.tsx                  # Homepage
│   ├── services/
│   │   └── page.tsx              # Services page
│   ├── portfolio/
│   │   └── page.tsx              # Portfolio page
│   ├── pricing/
│   │   └── page.tsx              # Pricing page
│   ├── order/
│   │   └── page.tsx              # Order page
│   ├── about/
│   │   └── page.tsx              # About page
│   ├── faq/
│   │   └── page.tsx              # FAQ page
│   ├── contact/
│   │   └── page.tsx              # Contact page
│   ├── privacy/
│   │   └── page.tsx              # Privacy Policy
│   ├── terms/
│   │   └── page.tsx              # Terms & Conditions
│   └── api/
│       └── order/
│           └── route.ts          # Order submission API endpoint
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx            # Navigation bar
│   │   ├── Footer.tsx            # Site footer
│   │   ├── MobileMenu.tsx        # Mobile hamburger menu
│   │   └── Container.tsx         # Max-width wrapper
│   │
│   ├── ui/                       # Reusable UI primitives
│   │   ├── Button.tsx            # Primary/secondary/ghost variants
│   │   ├── Card.tsx              # Content card
│   │   ├── Badge.tsx             # Tags/labels
│   │   ├── Input.tsx             # Form input
│   │   ├── Textarea.tsx          # Form textarea
│   │   ├── Select.tsx            # Dropdown select
│   │   ├── FileUpload.tsx        # Drag-and-drop file upload
│   │   ├── Checkbox.tsx          # Checkbox input
│   │   ├── RadioGroup.tsx        # Radio button group
│   │   └── Modal.tsx             # Lightbox/modal overlay
│   │
│   ├── sections/                 # Page section components
│   │   ├── Hero.tsx              # Homepage hero
│   │   ├── ServiceCategories.tsx # Two-column service split
│   │   ├── BeforeAfter.tsx       # Before/after slider component
│   │   ├── HowItWorks.tsx        # Process steps
│   │   ├── PortfolioGrid.tsx     # Masonry grid with filters
│   │   ├── Testimonials.tsx      # Testimonial carousel
│   │   ├── PricingTable.tsx      # Pricing cards/table
│   │   ├── CtaBar.tsx            # Full-width CTA banner
│   │   ├── ServiceBlock.tsx      # Individual service section
│   │   ├── ServiceAreaMap.tsx    # Coverage area display
│   │   └── FaqAccordion.tsx      # Expandable FAQ items
│   │
│   └── order/                    # Order page specific
│       ├── ServiceSelector.tsx   # Service type selection cards
│       ├── ItemCard.tsx          # Repeatable item form card
│       ├── StagingFields.tsx     # Virtual staging specific fields
│       ├── RenovationFields.tsx  # Virtual renovation specific fields
│       ├── FloorPlanFields.tsx   # Floor plan specific fields
│       ├── PhotoEditFields.tsx   # Photo editing specific fields
│       ├── ContactDetails.tsx    # Client info form section
│       ├── OrderSummary.tsx      # Sticky sidebar summary
│       └── Confirmation.tsx      # Success message after submit
│
├── lib/
│   ├── pricing.ts               # Pricing constants & calculation logic
│   ├── email.ts                  # Email sending utility (Resend/SendGrid)
│   ├── upload.ts                 # File upload handling (to cloud storage)
│   ├── validation.ts            # Form validation schemas (Zod)
│   └── utils.ts                 # General utilities (cn, formatCurrency)
│
├── data/
│   ├── services.ts              # Service definitions (names, descriptions, prices)
│   ├── portfolio.ts             # Portfolio items data
│   ├── testimonials.ts          # Testimonial data
│   └── faq.ts                   # FAQ questions and answers
│
├── types/
│   └── index.ts                 # TypeScript type definitions
│
└── public/
    ├── images/
    │   ├── portfolio/           # Portfolio images
    │   ├── services/            # Service page images
    │   ├── hero/                # Hero section images/video
    │   └── testimonials/        # Client photos
    ├── fonts/                   # Custom fonts (if any)
    └── favicon.ico
```


---

## 7. RECOMMENDED TECH STACK

### Core Framework
| Technology | Purpose | Why |
|-----------|---------|-----|
| **Next.js 14+** (App Router) | Full-stack React framework | SSG for fast pages, API routes for order form, built-in image optimization, SEO-friendly |
| **TypeScript** | Type safety | Catches errors early, better DX, reliable form handling |
| **Tailwind CSS** | Styling | Rapid development, consistent design, responsive out of the box |

### UI & Interaction
| Technology | Purpose | Why |
|-----------|---------|-----|
| **Framer Motion** | Animations | Smooth page transitions, scroll animations, slider interactions |
| **react-compare-slider** | Before/after component | Lightweight, accessible, touch-friendly |
| **Swiper** or **Embla Carousel** | Testimonial carousel | Performant, mobile-friendly |
| **yet-another-react-lightbox** | Portfolio lightbox | Lightweight, accessible, supports zoom |

### Forms & Validation
| Technology | Purpose | Why |
|-----------|---------|-----|
| **React Hook Form** | Form management | Performant, minimal re-renders, great for complex repeatable fields |
| **Zod** | Schema validation | Type-safe validation on client + server |
| **react-dropzone** | File upload UI | Drag-and-drop, file type/size validation |

### Backend & Infrastructure
| Technology | Purpose | Why |
|-----------|---------|-----|
| **Next.js API Routes** | Order submission endpoint | Same codebase, no separate server needed |
| **Resend** (or SendGrid) | Transactional email | Send order confirmations + admin notifications |
| **Vercel Blob** (or Cloudinary) | File storage | Store uploaded images from orders |
| **Vercel** | Hosting & deployment | Free tier, automatic deploys from GitHub, edge network |

### SEO & Analytics
| Technology | Purpose | Why |
|-----------|---------|-----|
| **next-sitemap** | Auto sitemap generation | SEO essentials |
| **Next.js Metadata API** | SEO meta tags | Built-in, per-page control |
| **Google Analytics 4** | Traffic analytics | Industry standard |
| **Vercel Analytics** (optional) | Performance metrics | Real user monitoring |

### Development
| Technology | Purpose | Why |
|-----------|---------|-----|
| **ESLint + Prettier** | Code quality | Consistent code style |
| **Husky** (optional) | Git hooks | Pre-commit linting |

### Total Estimated Monthly Cost (MVP):
| Item | Cost |
|------|------|
| Vercel hosting (Hobby) | $0 |
| Vercel Blob (1GB) | $0 (included) |
| Resend email (100 emails/day) | $0 (free tier) |
| Domain name | ~€10-15/year |
| **TOTAL** | **~€0-1/month** (domain excluded) |


---

## 8. STEP-BY-STEP IMPLEMENTATION PLAN

### Phase 1A: Foundation (Days 1-2)
```
Step 1: Project Setup
  - Initialize Next.js 14+ with TypeScript + Tailwind CSS + App Router
  - Configure ESLint, Prettier
  - Set up folder structure as defined in Section 6
  - Install core dependencies (framer-motion, react-hook-form, zod, etc.)
  - Configure Tailwind theme (colors, fonts, spacing)
  - Push to GitHub repo

Step 2: Layout & Navigation
  - Build Header component (logo, nav links, mobile menu, "Order" CTA button)
  - Build Footer component (links, service area, social icons, legal links)
  - Build Container/layout wrapper
  - Create root layout.tsx with header + footer
  - Test responsive behavior (mobile, tablet, desktop)
```

### Phase 1B: Static Pages (Days 3-5)
```
Step 3: Homepage
  - Hero section (static image for now, before/after slider placeholder)
  - Service categories section (two-column split)
  - Before/after showcase (implement react-compare-slider)
  - How it works section
  - Portfolio preview grid (placeholder images)
  - Testimonials carousel
  - Final CTA section

Step 4: Services Page
  - Page hero
  - Remote services section (5 service blocks)
  - Local services section (4 service blocks)
  - Service area section
  - Bottom CTA

Step 5: Portfolio Page
  - Filter tabs (category filtering with URL params or client state)
  - Masonry grid layout
  - Lightbox for full-size viewing
  - Before/after viewer for staging items
  - "Load More" or pagination
  - Bottom CTA

Step 6: Pricing Page
  - Two sections: Remote + Local
  - Pricing cards/table
  - Volume discounts section
  - Turnaround options
  - FAQ section specific to pricing
  - CTA buttons linking to /order and /contact

Step 7: About, FAQ, Contact Pages
  - About: Story, values, team (placeholder content)
  - FAQ: Accordion component with categorized questions
  - Contact: Form (name, email, phone, service interest, message)
         + direct contact info (email, phone, WhatsApp, address)
         + embedded Google Map of Alicante (optional)

Step 8: Legal Pages
  - Privacy Policy (GDPR-compliant template content)
  - Terms & Conditions (order policies, revisions, liability)
```

### Phase 1C: Order System (Days 6-9)
```
Step 9: Order Page — Frontend
  - Service selector (clickable cards, URL param pre-selection)
  - Dynamic form that changes fields based on selected service
  - Repeatable item cards (add/remove functionality)
  - File upload with drag-and-drop + preview thumbnails
  - Client details section
  - Form validation (Zod schemas per service type)
  - Order summary sidebar (auto-calculates price estimate)
  - Terms checkbox
  - Submit button with loading state

Step 10: Order Page — Backend
  - API route: POST /api/order
  - Server-side validation (Zod)
  - File upload to Vercel Blob (or Cloudinary)
  - Generate order number (sequential: #VS-001, #VR-001, etc.)
  - Send confirmation email to client (HTML template)
  - Send notification email to admin (full details + file links)
  - Return success response with order number

Step 11: Order Confirmation
  - Success state UI (order number, next steps, email confirmation note)
  - Error handling UI (retry, contact support)
  - Edge cases: large files, slow connections, validation errors
```

### Phase 1D: Polish & SEO (Days 10-12)
```
Step 12: SEO & Performance
  - Add metadata to every page (title, description, OG tags)
  - Implement next-sitemap (auto-generated sitemap.xml)
  - Add structured data (JSON-LD: LocalBusiness, Service)
  - Optimize images (next/image, WebP, lazy loading)
  - Add alt text to all images
  - Test Core Web Vitals (LCP, CLS, FID)

Step 13: Responsive & Cross-browser Testing
  - Test all pages on mobile (375px), tablet (768px), desktop (1440px)
  - Test order form on mobile (critical path)
  - Cross-browser: Chrome, Firefox, Safari, Edge
  - Test file upload on mobile devices

Step 14: Final Review & Deployment
  - Content review (placeholder text replaced with real copy)
  - Link check (no broken internal links)
  - Form testing (submit test orders, verify emails arrive)
  - Deploy to Vercel production
  - Connect custom domain
  - Set up Google Analytics
  - Submit sitemap to Google Search Console
```

### Phase 1 Deliverable Summary:
- 10-page responsive website
- Working online order system (4 service types)
- File upload to cloud storage
- Automatic email notifications (client + admin)
- SEO-optimized with sitemap
- Deployed and live on custom domain


---

## APPENDIX A: MVP vs FUTURE ADVANCED VERSION

| Feature | MVP (Phase 1) | Future (Phase 2+) |
|---------|---------------|-------------------|
| Pages | 10 unified pages | Separate page per service |
| Order system | Form → email to admin | Full dashboard + status tracking |
| Payment | Manual invoice after confirmation | Online payment (Stripe) |
| User accounts | None — email-based | Client login, order history |
| Cart | No (single order per submission) | Multi-service cart |
| Admin panel | Email notifications only | Dashboard with order management |
| File delivery | Manual (Google Drive/email) | Client portal with download links |
| Coupons/Discounts | None | First-order coupon, loyalty pricing |
| Languages | English only | English + Spanish toggle |
| Location pages | Service area on Services page | Dedicated city landing pages |
| Blog | Static or MDX | CMS-powered (Sanity/Contentful) |
| Chat/Support | WhatsApp link | Live chat widget |
| Reviews | Static testimonials | Dynamic reviews integration |
| Booking (local) | Contact form | Calendar booking system |

---

## APPENDIX B: CONTENT YOU NEED TO PREPARE

Before development starts, gather:

### Immediately Needed (blocks development without it):
1. **Brand name** (for logo, domain, meta titles)
2. **Logo** (SVG preferred, or we design a text logo)
3. **Pricing** — actual euro amounts for each service
4. **Contact details** — email, phone, WhatsApp, business address
5. **5-10 portfolio images** per category (before/after pairs for staging)

### Needed Before Launch:
6. **About page content** — your story, experience, values
7. **Testimonials** — 3-5 real client quotes (name + role optional)
8. **FAQ answers** — we'll draft questions, you provide answers
9. **Service area** — exact list of cities/towns you cover
10. **Legal content** — Privacy Policy & Terms (we can draft templates)
11. **Social media links** — Instagram, Facebook, LinkedIn, YouTube
12. **Google Analytics ID** — create GA4 property

### Nice to Have for Launch:
13. **Hero video** (15-30 sec property montage)
14. **Team photo** or founder portrait
15. **Service area map** graphic
16. **Client logos** (agencies you've worked with)

---

## APPENDIX C: ORDER FLOW SUMMARY

```
CLIENT                           SYSTEM                          ADMIN
  │                                │                               │
  │  1. Fills order form           │                               │
  │  2. Uploads files              │                               │
  │  3. Clicks Submit              │                               │
  │ ──────────────────────────────►│                               │
  │                                │  4. Validates data             │
  │                                │  5. Uploads files to cloud     │
  │                                │  6. Generates order #          │
  │                                │  7. Sends confirmation email   │
  │  ◄─────────────────────────────│                               │
  │  (email: "Order received")     │  8. Sends admin notification  │
  │                                │ ──────────────────────────────►│
  │                                │                               │
  │                                │     9. Reviews order           │
  │                                │     10. Confirms price         │
  │  ◄─────────────────────────────────────────────────────────────│
  │  (email: "Confirmed, invoice") │                               │
  │                                │                               │
  │  11. Pays invoice              │                               │
  │ ───────────────────────────────────────────────────────────────►│
  │                                │                               │
  │                                │     12. Completes work         │
  │  ◄─────────────────────────────────────────────────────────────│
  │  (email: "Files ready",        │                               │
  │   download link)               │                               │
  │                                │                               │
```

---

*Document created: May 2026*
*Status: AWAITING APPROVAL*
*Next step: Upon approval, begin Phase 1A implementation*
