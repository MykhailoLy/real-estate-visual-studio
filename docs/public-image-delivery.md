# Public image delivery

All ordinary public property and portfolio raster images use
`src/components/media/OptimizedImage.tsx`. Its named delivery contexts in
`image-delivery.ts` are the only source of the responsive `sizes` and quality
rules. The component uses `next/image`, so public Supabase Storage source URLs
are requested server-side through `/_next/image` and returned as AVIF or WebP
according to the browser's `Accept` header.

`PropertyGallery` renders only its visible compact tiles. Once a lightbox frame
has loaded, it may mount one hidden `OptimizedImagePreloader` for the following
frame. It never mounts or preloads a complete gallery. The lightbox itself uses
the `property-lightbox` profile; source files are not used for normal viewing.
An original, when a property supplies one, must remain a separate explicit
download action.

## Intentional exceptions

- 360-degree tours, video players, and external embeds remain provider-owned
  iframe experiences. Their interactive assets are not ordinary page photos.
- SVG files are intentionally left to the browser/Next.js SVG handling; they do
  not benefit from raster optimization.
- `PropertyMarketingDownloads` uses a same-origin generated brochure preview,
  not a Supabase property-photo URL. `marketing-material-renderer.tsx` renders
  images inside server-side `ImageResponse` output, so it does not create a
  browser Storage request.
- `/local` currently uses `ServicePlaceholder` CSS/SVG illustrations only; it
  has no ordinary raster photo source to migrate. Future local portfolio photos
  should use an `OptimizedImage` portfolio context.
- Authenticated uploads, local object-URL previews, delivery downloads, admin
  media tooling, and email renderers are not public visual delivery surfaces.
