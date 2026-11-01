-- Run manually each week. Repeat full batches the same day until fewer than
-- 5000 IDs are returned. Rows being saved/claimed are left for a later batch.
DELETE FROM public.guest_order_drafts AS guest
WHERE guest.expires_at <= now() AND guest.id IN (
  SELECT id FROM public.guest_order_drafts
  WHERE expires_at <= now() ORDER BY expires_at, id LIMIT 5000 FOR UPDATE SKIP LOCKED
)
RETURNING guest.id;
