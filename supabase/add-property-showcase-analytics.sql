-- Per-property Property Showcase analytics.
--
-- REVIEW FIRST. Execute this file manually in the Supabase SQL Editor.
-- It is intentionally not applied by the application or CI.
--
-- Public Property Showcase visitors submit a minimal allowlisted event through
-- POST /api/property-analytics. Browser Supabase roles receive no direct
-- privileges or RLS policies for this table.

create extension if not exists pgcrypto;

create table if not exists public.property_analytics_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.property_showcases(id) on delete cascade,
  property_slug text not null,
  event_type text not null,
  created_at timestamptz not null default now(),
  constraint property_analytics_events_slug_format_check
    check (property_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint property_analytics_events_type_check
    check (
      event_type in (
        'property_page_viewed',
        'request_viewing_opened',
        'agent_whatsapp_clicked',
        'agent_phone_clicked',
        'agent_email_clicked',
        'gallery_opened',
        'property_shared',
        'floor_plan_downloaded',
        'brochure_downloaded',
        'video_started',
        'virtual_tour_opened',
        'interactive_floor_plan_opened'
      )
    )
);

comment on table public.property_analytics_events is
  'Anonymous, server-validated property showcase interaction totals. It stores no visitor identifiers or personal data.';

create index if not exists property_analytics_events_property_created_idx
  on public.property_analytics_events (property_id, created_at desc);

create index if not exists property_analytics_events_property_event_created_idx
  on public.property_analytics_events (property_id, event_type, created_at desc);

alter table public.property_analytics_events enable row level security;

revoke all on table public.property_analytics_events from anon;
revoke all on table public.property_analytics_events from authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.property_analytics_events to service_role;

-- Deliberately no anon/authenticated policies. The server endpoint validates
-- the slug and event, resolves the published property ID, then inserts only
-- approved columns with the service-role client.
