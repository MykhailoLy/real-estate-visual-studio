-- ============================================================
-- SUPABASE SCHEMA — Real Estate Visual Marketing Studio
-- ============================================================
-- Run this in the Supabase SQL Editor to create all tables.
-- This is a NON-DESTRUCTIVE script (uses IF NOT EXISTS).
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------
-- ORDERS TABLE
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('virtual-staging', 'virtual-renovation', 'floor-plans', 'photo-editing')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in-progress', 'delivered', 'cancelled')),

  -- Client information
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_company TEXT,

  -- Order summary
  item_count INTEGER NOT NULL CHECK (item_count > 0),
  estimated_total DECIMAL(10, 2) NOT NULL DEFAULT 0,

  -- Additional
  notes TEXT,

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

  -- File references (Supabase Storage paths)
  original_photo_path TEXT,
  reference_image_path TEXT,

  -- Service-specific details stored as JSON
  -- Virtual Staging: { "room_type": "...", "interior_style": "...", "notes": "...", "reference_link": "..." }
  -- Virtual Renovation: { "instructions": "...", "elements_to_keep": "...", "elements_to_remove": "...", "elements_to_replace": "...", "preferred_materials": "...", "reference_link": "...", "notes": "..." }
  -- Floor Plans: { "property_type": "...", "number_of_floors": N, "output_type": "2D|3D|Both", "notes": "..." }
  -- Photo Editing: { "editing_types": [...], "notes": "..." }
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

-- Initialize sequences
INSERT INTO order_sequences (service_type, last_number) VALUES
  ('virtual-staging', 0),
  ('virtual-renovation', 0),
  ('floor-plans', 0),
  ('photo-editing', 0)
ON CONFLICT (service_type) DO NOTHING;

-- -----------------------------------------------------------
-- FUNCTION: Generate next order number
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
    WHEN 'floor-plans' THEN 'FP'
    WHEN 'photo-editing' THEN 'PE'
    ELSE 'ORD'
  END;

  -- Increment and get next number (atomic)
  UPDATE order_sequences
  SET last_number = last_number + 1
  WHERE service_type = p_service_type
  RETURNING last_number INTO v_next_number;

  -- Return formatted order number
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
CREATE INDEX IF NOT EXISTS idx_orders_client_email ON orders(client_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- -----------------------------------------------------------
-- STORAGE BUCKET (run via Supabase dashboard or API)
-- -----------------------------------------------------------
-- Create a private bucket called "order-files"
-- Policy: Only authenticated service role can upload
-- Files organized as: order-files/{order_number}/{item_index}-original.jpg
-- ============================================================
