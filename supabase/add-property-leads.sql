-- Property showcase viewing requests.
--
-- This migration is intentionally not applied automatically. Public visitors
-- submit through POST /api/property-leads; browser Supabase roles receive no
-- direct table privileges or RLS policies.

create table if not exists public.property_leads (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.property_showcases(id) on delete set null,
  property_slug text not null,
  name text not null,
  email text not null,
  phone text,
  preferred_date date,
  preferred_time time without time zone,
  message text,
  locale text not null,
  source text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  notification_email_status text,
  notification_email_error text,
  constraint property_leads_slug_format_check
    check (property_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint property_leads_name_length_check
    check (char_length(name) between 2 and 100),
  constraint property_leads_email_length_check
    check (char_length(email) between 3 and 320),
  constraint property_leads_phone_length_check
    check (phone is null or char_length(phone) <= 40),
  constraint property_leads_message_length_check
    check (message is null or char_length(message) <= 2000),
  constraint property_leads_locale_check
    check (locale in ('en', 'es', 'de', 'fr', 'nl', 'pl', 'uk', 'ru')),
  constraint property_leads_source_check
    check (source = 'property-showcase'),
  constraint property_leads_status_check
    check (status in ('new', 'contacted', 'qualified', 'closed', 'spam')),
  constraint property_leads_notification_status_check
    check (
      notification_email_status is null
      or notification_email_status in ('pending', 'sent', 'failed', 'skipped')
    )
);

comment on table public.property_leads is
  'Server-managed viewing requests from published property showcase pages. Contains private contact data and is never browser-readable.';

create index if not exists property_leads_property_created_idx
  on public.property_leads (property_id, created_at desc);

create index if not exists property_leads_status_created_idx
  on public.property_leads (status, created_at desc);

alter table public.property_leads enable row level security;

revoke all on table public.property_leads from anon;
revoke all on table public.property_leads from authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.property_leads to service_role;

-- Deliberately no anon/authenticated policies. The service-role server endpoint
-- validates, rate-limits and inserts leads while RLS blocks browser clients.
