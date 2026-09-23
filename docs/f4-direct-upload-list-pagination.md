# F4: direct upload Storage list pagination

## Review scope

Branch: `codex/fix-direct-upload-list-pagination`.
Baseline and unchanged HEAD: `863202ac577fc786349e682b78af9899079e436c`.
Local, uncommitted patch; no push, PR, merge, deployment or production operations.
The preflight fetch matched the requested baseline. The only open PR was #337
(blog content); no F4 branch or PR existed.

Changed files:

- `src/lib/orders/direct-upload-verification.ts`
- `src/lib/orders/direct-order-file-integrity.test.ts`
- This evidence file (the only added file).

The original checkout's `.gitignore` changes and untracked `debug.log` were left
untouched. Work runs in a separate worktree. Existing `.codex` is unchanged.

## Root cause and fix

The verifier made one `.list(directory, { limit: 100 })` call. A required object
after the first 100 Storage objects incorrectly became `invalid_upload` / 409.
Object count includes originals and references, independently of item count.

The existing list helper now takes the directory's required basenames, starts
at offset 0, requests pages of 100 with `sortBy: { column: "name", order: "asc" }`,
and advances by the actual returned length. It stops once all required names
have been seen, or on a short/empty page. Existing metadata verification then
runs unchanged. An error or throw on any necessary page preserves `storage_error`
/ 500 and safe error-label logging. Exhaustion with a missing file preserves the
existing missing-upload message and 409 status.

Installed `@supabase/supabase-js` is 2.106.1. Its installed Storage `SearchOptions`
and the [official list documentation](https://supabase.com/docs/reference/javascript/file-buckets-list)
support offset/sortBy; no listV2, new abstraction or per-file info request was added.
No limits, paths, bucket, upload URLs, ownership checks, pricing, payments, email,
auth/RLS, schema or F3 recovery semantics changed. No migration or dependency
change is needed; package.json and lockfile are unchanged.

## Red to green

Before the production edit, the real `verifyDirectOrderUploads` rejected a
schema-valid fixture of 10 items with one original and 10 references per item
(110 objects in one directory):

`{"ok":false,"code":"invalid_upload","message":"Uploaded file was not found. Please refresh and upload again.","status":409}`

The test expected success and failed (1 test, 0 passed, 1 failed). After pagination,
the same fixture passed. The existing mock already honored limit; it now also
honors offset and explicit name sorting and supports page-specific error/throw
injection. Tests invoke production code, not a duplicate verification algorithm.

| Scenario | Verified offsets | Result |
| --- | --- | --- |
| 99 relevant objects (9 items, 10 references each) | 0 | Success; one call |
| 100 relevant objects (10 items, 9 references each) | 0 | Success; no extra empty-page request |
| Required object at sorted position 101 | 0, 100 | Success |
| 110 relevant objects (10 items, 10 references each) | 0, 100 | Success |
| 220 relevant objects (20 items, 10 references each) | 0, 100, 200 | Success |
| More objects exist, all required names found on a full page | 0 or 0, 100 | Stops before injected error on unnecessary next page |
| Required object absent, 101 unrelated objects | 0, 100 | Missing / 409 after short page |
| Required object absent, 200 unrelated objects | 0, 100, 200 | Missing / 409 after empty page |
| Error or throw at offset 100 or 200 | Through failing page | Storage error / 500; no move, copy, insert, commit RPC or email |
| Second-page metadata mismatch | 0, 100 | Invalid upload / 400 |

Each list expectation checks page size, bucket, directory and ascending name sort.
The position-101 test inserts the required file first, so insertion-order listing
cannot accidentally satisfy the test. Multi-reference fixtures pass the current
`OrderMetadataSchema`, including the unchanged 50-item / 10-reference limits.
Reference identity/position mismatch, existing owner/path/kind/duplicate/size/MIME
checks, and F3 retry/takeover tests pass.

## Validation

Runtime: Node 24.18.0, npm 11.16.0, Next.js 16.3.4.

- Focused direct-order-file-integrity: 134 passed.
- `npm.cmd run test:order-integrity`: 251 passed, including F3 service/recovery regressions.
- `npm.cmd run test:stripe-checkout`: 36 passed (F1).
- `npm.cmd run test:stripe-webhook`: 89 passed (F2).
- `npm.cmd run test:ci`: 2193 passed, 0 failed, 0 skipped.
- `npm.cmd run typecheck:test`: passed.
- `node_modules/.bin/tsc.cmd --noEmit`: passed (production typecheck).
- `npm.cmd run lint`: passed, 0 errors, 9 pre-existing navigation warnings.
- `npm.cmd run build`: passed (121 static pages generated); existing
  `preferredRegion` route-segment deprecation warning.
- `git diff --check`: passed; Git reports only local LF-to-CRLF conversion notices.
- Final `git fetch origin` / `git rev-list --left-right --count HEAD...origin/main`:
  `0 0`; the branch is neither ahead nor behind remote main (patch is uncommitted).

Warnings: Node tests report existing `MODULE_TYPELESS_PACKAGE_JSON`. Lint warnings
are `@next/next/no-location-assign-relative-destination` in SignOutButton (1),
FloorPlansOrderForm (2), order-redirect (2), PhotoEditingOrderForm (2), and
VirtualRenovationOrderForm (2); all these files are unchanged. `npm ci` reported
the existing node-domexception deprecation and pending install-script notices
for @google/genai, protobufjs and unrs-resolver; no approval/config changes made.

## Limits of evidence

All Storage and order operations in these tests use the existing synthetic mock.
No live Storage operations or real orders were created. No new browser E2E or
PostgreSQL harness was added or run. Offset pagination is not a snapshot: concurrent
directory insertions/deletions between requests can still shift positions.
Very large directories with genuinely missing candidates require enumeration to
exhaustion. These limitations are outside the focused F4 fix; F5/F6/F9 are deferred.
