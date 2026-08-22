# Legacy public image backfill runbook

## Scope

This one-off tool converts oversized, currently referenced public images to
the shared gallery WebP profile. It reads references from:

- `site_media_items`: `before_image_path`, `after_image_path`, `image_path`,
  and `poster_image_path`
- `portfolio_items`: `before_image_path` and `after_image_path`

Only objects in `site-media` and `portfolio` are eligible. Panorama rows and
`panorama_image_path` are excluded. `property_showcases` is never a backfill
candidate and is never mutated; its JSON content is read only by the later
cleanup safety report. `order-files` and `deliverables` are never queried or
mutated. External embed/video rows with no referenced poster contain no
candidate.

The tool uses the same gallery profile as browser admin uploads. The
floor-plan profile is not used.

## Safety model

- The default mode is dry run and has no database, Storage, or local-file
  writes.
- Apply requires both `--apply` and `PUBLIC_MEDIA_BACKFILL_CONFIRM=YES`.
- Apply also requires an explicit local audit-manifest path.
- Every row and source object is re-read immediately before work begins.
- A new unique `.webp` object is uploaded in the same bucket and folder with
  `contentType: image/webp`, `cacheControl: 31536000`, and `upsert: false`.
- The uploaded object's size and MIME type are verified before the database is
  touched.
- One exact row and one exact column are updated with guards on both `id` and
  the expected old path.
- The updated row is re-read and verified.
- Original objects are always retained. The tool has no delete operation.
- A verified upload is journaled before the guarded DB update. If the update
  then fails or conflicts, the manifest and console identify the new object as
  an uncommitted cleanup candidate; it is not deleted automatically.
- The stable manifest identity is the exact table, row id, column, and old
  path. On resume, an `uploaded-uncommitted` entry is authoritative: the tool
  reuses its new path, verifies that object still exists with the journaled
  size and `image/webp` MIME type, and performs no second upload. A missing or
  mismatched object fails closed.
- Manifest replacements use a complete temporary file in the same directory
  followed by an atomic rename, reducing the chance that interruption leaves a
  truncated audit journal, including on Windows.
- A failed post-update verification is fatal and stops the sequential run.

Do not run apply against production until the complete dry-run output has been
reviewed and approved manually.

## Required environment variable names

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_MEDIA_BACKFILL_CONFIRM` (apply only)

Keep the service-role value in a server-side operator environment. Never place
it in a browser-visible variable, committed file, command transcript, or PR.

## Dry run

```powershell
npm.cmd run media:backfill:dry-run
```

The report lists the table, row id, column, bucket, old path, byte size, MIME
type, intended new WebP path, section/service/title context, and selection
reason for every candidate. Totals include candidate count, original bytes,
the theoretical target ceiling, and savings at the gallery target ceiling.
Skips are summarized by reason.

Any ambiguous stored path aborts discovery before apply is possible. A dry run
does not create a manifest.

## Apply

After separately providing the two Supabase environment variables and
reviewing dry-run output:

```powershell
$env:PUBLIC_MEDIA_BACKFILL_CONFIRM = "YES"
npm.cmd run media:backfill:apply -- --manifest C:\path\outside-repo\public-media-backfill.json
```

The manifest parent directory must already exist. Keep the same manifest when
resuming an interrupted run. The manifest reuses any verified uncommitted
object for the same exact old reference and never creates a replacement path
for a missing or mismatched recorded upload. Completed rows point to names
ending in `-legacy-gallery.webp`, so a fresh discovery skips them. A row changed
by an administrator is reported as a conflict rather than overwritten.

To stop safely, press `Ctrl+C`. Processing is sequential. The current original
object remains untouched. Review the manifest for `uploaded-uncommitted`,
`failed`, `conflict`, or `fatal` entries before resuming. If interruption occurs
after upload verification, the new object path is journaled before any DB
mutation is attempted.

## Verification

Review the manifest and confirm that each `migrated` entry has the expected old
and new path. Read-only database checks can be run manually in the Supabase SQL
editor:

```sql
select id, before_image_path, after_image_path, image_path, poster_image_path
from public.site_media_items
where coalesce(before_image_path, '') like '%-legacy-gallery.webp'
   or coalesce(after_image_path, '') like '%-legacy-gallery.webp'
   or coalesce(image_path, '') like '%-legacy-gallery.webp'
   or coalesce(poster_image_path, '') like '%-legacy-gallery.webp';

select id, before_image_path, after_image_path
from public.portfolio_items
where before_image_path like '%-legacy-gallery.webp'
   or after_image_path like '%-legacy-gallery.webp';
```

For each migrated entry, also verify the new public image renders correctly and
that the original object still exists.

## Later cleanup candidate report

This mode is read-only. It considers only successful `migrated` manifest
entries, then checks the old path across every relevant column. For
`site-media`, that safety check also includes `panorama_image_path`, even though
panoramas are never backfilled. It also validates and parses every
`property_showcases.content` document and retains an object referenced there.
Invalid or uncertain Property Showcase content fails closed by retaining the
object; Property Showcase rows are never changed.

```powershell
npm.cmd run media:backfill:cleanup-report -- C:\path\outside-repo\public-media-backfill.json
```

An old object is listed as a future cleanup candidate only when it still exists
and no relevant DB row references it. Referenced or missing objects are listed
as retained. This command does not delete anything. Cleanup execution is
explicitly deferred to a separate reviewed task and PR.
