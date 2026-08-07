This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment variables

Copy `.env.example` to `.env.local` and fill in your project values. Variables required for full functionality:

| Variable                     | Required for                              | Notes                                      |
| ---------------------------- | ----------------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`   | Order system, portfolio admin             | Public — safe to ship to the browser       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Order system                            | Public                                     |
| `SUPABASE_SERVICE_ROLE_KEY`  | Order API routes, portfolio admin         | **Server only.** Never expose to clients   |
| `RESEND_API_KEY`             | Order confirmation + admin emails         | Server only                                |
| `PROPERTY_LEADS_FROM_EMAIL`  | Property viewing-request sender            | Server-only verified Resend address        |
| `PROPERTY_LEADS_CC_EMAIL`    | Optional property-lead operations copy     | Server only                                |
| `ADMIN_EMAIL`                | Where order notifications are sent        | Plain string                               |
| `NEXT_PUBLIC_SITE_URL`       | Canonical metadata + email links          | No trailing slash                          |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public form spam protection           | Public                                     |
| `TURNSTILE_SECRET_KEY`       | Property-lead Turnstile verification      | Server only                                |
| `UPSTASH_REDIS_REST_URL`     | Public endpoint rate limiting             | Server only                                |
| `UPSTASH_REDIS_REST_TOKEN`   | Public endpoint rate limiting             | Server only                                |
| `PROPERTY_LEADS_RATE_LIMIT_SECRET` | Property-lead client hashing        | Server only; at least 32 characters        |
| `PROPERTY_SHOWCASE_TRUSTED_VIDEO_ORIGINS` | Custom property-video embeds | Server-only comma-separated exact HTTPS origins |
| `ADMIN_PASSWORD`             | `/admin/login` + portfolio admin          | **Server only.** Rotating it logs everyone out |

Property lead delivery is per listing: every published property that accepts
viewing requests needs a valid `agent.email` in its saved showcase document.
That realtor email is the primary recipient. `PROPERTY_LEADS_CC_EMAIL` adds an
operations copy only; the application does not use a silent fallback recipient.

## Database setup (Supabase)

Two SQL files under `supabase/` describe the schema. Run them in order in the Supabase SQL editor:

1. `supabase/schema.sql` — orders + order_items + sequences + the private `order-files` storage bucket. **Already in production.**
2. `supabase/portfolio.sql` — `portfolio_items` table + the public `portfolio` storage bucket. Required for `/admin/portfolio` and the homepage / pricing-page portfolio sections.

Property viewing requests additionally require the reviewed, manually applied
`supabase/add-property-leads.sql` migration. It creates a private, service-role-only
lead table; do not apply it automatically from application code or CI.

Property Showcase pages also depend on `supabase/add-property-showcase-foundation.sql`
for listings and `supabase/site-media.sql` for the public `site-media` bucket used by
property media and custom flyers. There is no repository evidence that any of these
three Property Showcase migrations has been applied to production; verify them in the
Supabase dashboard before publishing real listings. Do not run them from the app or CI.

The database migration files referenced above use idempotent guards so they can
be reviewed and re-run safely.

## Portfolio media admin (`/admin/portfolio`)

The marketing site can show real before/after pairs uploaded by an admin instead of CSS placeholders. Setup:

1. **Apply the migration** — run `supabase/portfolio.sql` in your Supabase project. It creates the `portfolio_items` table and the public `portfolio` storage bucket.
2. **Set `ADMIN_PASSWORD`** in the deployment environment. This is the single shared password used by the login form. Changing it invalidates every existing admin session cookie.
3. **Visit `/admin/login`** and sign in.
4. **Upload before/after pairs** at `/admin/portfolio`. Each item has a service slug, title, optional description and alt text, sort order, and two booleans:
   - `published` — gates the item on the public site (RLS denies unpublished rows to anon).
   - `featured_home` — promotes the item to the homepage service grid (one per service slug).
5. **No redeploy required.** Each admin save invalidates the relevant pages via `revalidatePath('/')` and the matching `/pricing/<service>` URL.

### Portfolio service slugs

| Pricing page                             | Portfolio slug                    |
| ---------------------------------------- | --------------------------------- |
| `/pricing/image-enhancement`             | `image-enhancement`               |
| `/pricing/day-to-dusk`                   | `day-to-dusk`                     |
| `/pricing/virtual-staging`               | `virtual-staging`                 |
| `/pricing/photo-editing` *(legacy URL)*  | `item-removal-virtual-cleaning`   |
| `/pricing/floor-plans`                   | `floor-plans`                     |
| `/pricing/virtual-renovation`            | `virtual-renovation`              |
| `/pricing/360-image-enhancement`         | `360-image-enhancement`           |
| `/pricing/360-virtual-staging`           | `360-virtual-staging`             |
| `/pricing/aerial-editing`                | `aerial-editing`                  |
| `/pricing/development-site-plans`        | `development-site-plans`          |

### Storage buckets

The project owns two Supabase Storage buckets. **Do not change their visibility.**

| Bucket        | Visibility | Purpose                              |
| ------------- | ---------- | ------------------------------------ |
| `order-files` | **Private** | Client uploads attached to orders. Read via signed URLs only |
| `portfolio`   | **Public**  | Marketing portfolio images shown on `/` and pricing pages    |

The `portfolio` bucket is intentionally public-read because everything inside it is curated marketing content. The `order-files` bucket stays private — never re-classify it.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
