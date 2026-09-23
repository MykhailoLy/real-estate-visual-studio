-- Synthetic prerequisites for the isolated F3 PostgreSQL harness only.
-- The harness creates its own empty cluster and never accepts a database URL.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULL::UUID;
$$;
