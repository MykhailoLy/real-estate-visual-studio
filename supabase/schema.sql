-- ============================================================
-- SUPABASE SCHEMA — PicchuSpot (Real Estate Visuals)
-- ============================================================
-- Version: 2.0 (Updated for separated order flows + USD cents)
-- Run this in the Supabase SQL Editor to create all tables.
-- This is a NON-DESTRUCTIVE script (uses IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------
-- ORDERS TABLE
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  service_type TEXT NOT NULL CHECK (
    service_type IN ('virtual-staging', 'virtual-renovation', '3d-floor-plans', 'photo-editing')
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'confirmed', 'in-progress', 'delivered', 'cancelled')
  ),

  -- Client information
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_company TEXT,

  -- Order summary (prices in USD cents for precision)
  item_count INTEGER NOT NULL CHECK (item_count > 0),
  estimated_total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- ORDER ITEMS TABLE
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL,

  -- File references (Supabase Storage paths within the "order-files" bucket)
  original_photo_path TEXT,
  reference_image_path TEXT,

  -- Price for this item in USD cents
  subtotal_cents INTEGER NOT NULL DEFAULT 0,

  -- Service-specific details stored as JSONB
  --
  -- Virtual Staging example:
  -- {
  --   "room_name": "Living Room - With TV",
  --   "furniture_style": "Scandinavian",
  --   "reference_link": "https://...",
  --   "additional_info": "...",
  --   "selected_addons": ["image-enhancement", "day-to-dusk"],
  --   "addon_labels": ["Image Enhancement", "Day to Dusk"]
  -- }
  --
  -- Virtual Renovation example:
  -- {
  --   "room": "Kitchen",
  --   "presentation_style": "Modern",
  --   "reference_link": "https://...",
  --   "additional_info": "...",
  --   "selected_internal": ["replace-flooring", "kitchen-fit-out"],
  --   "selected_external": [],
  --   "internal_labels": ["Replace Flooring", "Add or Complete Kitchen Fit Out"],
  --   "external_labels": []
  -- }
  --
  -- 3D Floor Plans example:
  -- {
  --   "plan_type": "2d-3d-bundle",
  --   "plan_type_label": "2D + 3D Bundle",
  --   "number_of_floors": 2,
  --   "style_3d": "Modern",
  --   "plan_view_3d": "Angle View",
  --   "page_orientation": "Landscape",
  --   "plan_orientation": "Landscape",
  --   "flooring_by_room": { "Living Room": "Light Wood", "Kitchen": "Grey Tiles" },
  --   "show_address": true,
  --   "street_address": "123 Main St",
  --   "show_title": true,
  --   "project_title": "Ocean View Apartments",
  --   "disclaimer_option": "Show standard disclaimer",
  --   "custom_disclaimer": "",
  --   "reference_link": "",
  --   "additional_info": ""
  -- }
  --
  -- Photo Editing example:
  -- {
  --   "selected_options": ["image-enhancement-re", "day-to-dusk-pe"],
  --   "option_labels": ["Image Enhancement - Real Estate", "Day to Dusk"],
  --   "additional_info": "Make sky dramatic sunset"
  -- }
  details JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- ORDER SEQUENCES TABLE (for generating order numbers)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_sequences (
  service_type TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- Initialize sequences (will not overwrite existing values)
INSERT INTO order_sequences (service_type, last_number) VALUES
  ('virtual-staging', 0),
  ('virtual-renovation', 0),
  ('3d-floor-plans', 0),
  ('photo-editing', 0)
ON CONFLICT (service_type) DO NOTHING;

-- -----------------------------------------------------------
-- FUNCTION: Generate next order number (atomic)
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_order_number(p_service_type TEXT)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_next_number INTEGER;
BEGIN
  -- Determine prefix
  v_prefix := CASE p_service_type
    WHEN 'virtual-staging' THEN 'VS'
    WHEN 'virtual-renovation' THEN 'VR'
    WHEN '3d-floor-plans' THEN 'FP'
    WHEN 'photo-editing' THEN 'PE'
    ELSE 'ORD'
  END;

  -- Increment and get next number (atomic via row lock)
  UPDATE order_sequences
  SET last_number = last_number + 1
  WHERE service_type = p_service_type
  RETURNING last_number INTO v_next_number;

  IF v_next_number IS NULL THEN
    RAISE EXCEPTION 'Unknown service_type: %', p_service_type;
  END IF;

  -- Return formatted order number (zero-padded to 4 digits)
  RETURN v_prefix || '-' || LPAD(v_next_number::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------
-- TRIGGER: Auto-update updated_at on orders
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- -----------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_service_type ON orders(service_type);
CREATE INDEX IF NOT EXISTS idx_orders_client_email ON orders(client_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- -----------------------------------------------------------
-- GRANTS FOR SERVICE_ROLE
-- -----------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO service_role;
GRANT SELECT, UPDATE ON public.order_sequences TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_order_number(TEXT) TO service_role;

-- -----------------------------------------------------------
-- STORAGE BUCKET SETUP (manual via Supabase Dashboard)
-- -----------------------------------------------------------
-- 1. Go to Storage in your Supabase Dashboard
-- 2. Create a new bucket: "order-files"
-- 3. Set it to PRIVATE (not public)
-- 4. No additional policies needed — we use the service role key
--    from the API route which bypasses RLS.
-- ============================================================
