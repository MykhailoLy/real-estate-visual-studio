-- PicchuSpot property showcase foundation
--
-- REVIEW FIRST. Execute this file manually in the Supabase SQL Editor.
-- It is intentionally not applied by the application or CI.
--
-- Creates one validated JSON document per property presentation. Browser roles
-- may read published rows only; every write remains server-side through the
-- existing authenticated admin API and service-role client.

create extension if not exists pgcrypto;

create table if not exists public.property_showcases (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  content jsonb not null,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_showcases_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint property_showcases_content_object_check
    check (jsonb_typeof(content) = 'object'),
  constraint property_showcases_content_slug_check
    check (content ? 'slug' and content ->> 'slug' = slug),
  constraint property_showcases_publish_timestamp_check
    check (not published or published_at is not null)
);

comment on table public.property_showcases is
  'Validated property presentation documents used by PicchuSpot showcase pages.';
comment on column public.property_showcases.content is
  'Complete PropertyShowcase JSON document validated by the server before write.';

create or replace function public.set_property_showcase_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_property_showcase_updated_at() from public;
revoke all on function public.set_property_showcase_updated_at() from anon;
revoke all on function public.set_property_showcase_updated_at() from authenticated;
grant execute on function public.set_property_showcase_updated_at() to service_role;

drop trigger if exists property_showcases_set_updated_at
  on public.property_showcases;
create trigger property_showcases_set_updated_at
before update on public.property_showcases
for each row
execute function public.set_property_showcase_updated_at();

alter table public.property_showcases enable row level security;

revoke all on table public.property_showcases from anon;
revoke all on table public.property_showcases from authenticated;
grant select on table public.property_showcases to anon;
grant select on table public.property_showcases to authenticated;
grant all on table public.property_showcases to service_role;

drop policy if exists property_showcases_public_read
  on public.property_showcases;
create policy property_showcases_public_read
on public.property_showcases
for select
to anon, authenticated
using (published = true);

create index if not exists property_showcases_public_updated_idx
  on public.property_showcases (published, updated_at desc);
