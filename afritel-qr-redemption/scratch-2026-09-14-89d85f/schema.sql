-- AFRITEL QR Redemption Dashboard - PostgreSQL Schema (Neon)

CREATE TABLE resellers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  contact_person TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

CREATE TABLE batches (
  id BIGSERIAL PRIMARY KEY,
  reseller_id BIGINT NOT NULL REFERENCES resellers(id),
  mobimatter_product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity_requested INT NOT NULL,
  quantity_generated INT NOT NULL DEFAULT 0,
  quantity_redeemed INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'génération',
  created_at TIMESTAMP DEFAULT NOW(),
  created_by_user_id TEXT,
  export_format TEXT,
  export_generated_at TIMESTAMP,
  notes TEXT
);

CREATE TABLE redemption_codes (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES batches(id),
  code TEXT NOT NULL UNIQUE,
  qr_code_data_uri TEXT,
  status TEXT NOT NULL DEFAULT 'non-utilisé',
  created_at TIMESTAMP DEFAULT NOW(),
  redeemed_at TIMESTAMP,
  mobimatter_order_id TEXT,
  iccid TEXT
);

CREATE TABLE kyc_submissions (
  id BIGSERIAL PRIMARY KEY,
  redemption_code_id BIGINT NOT NULL UNIQUE REFERENCES redemption_codes(id),
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT,
  country_code TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  id_field_placeholder TEXT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  redemption_code_id BIGINT NOT NULL UNIQUE REFERENCES redemption_codes(id),
  mobimatter_order_id TEXT NOT NULL UNIQUE,
  qr_code_data_uri TEXT,
  lpa_string TEXT NOT NULL,
  one_click_install_android TEXT,
  iccid TEXT NOT NULL,
  order_created_at TIMESTAMP,
  order_completed_at TIMESTAMP,
  mobimatter_response JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE activity_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  redemption_code_id BIGINT REFERENCES redemption_codes(id),
  batch_id BIGINT REFERENCES batches(id),
  user_id TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_resellers_status ON resellers(status);
CREATE INDEX idx_batches_reseller_id ON batches(reseller_id);
CREATE INDEX idx_batches_status ON batches(status);
CREATE INDEX idx_batches_created_at ON batches(created_at);
CREATE INDEX idx_redemption_codes_batch_id ON redemption_codes(batch_id);
CREATE INDEX idx_redemption_codes_status ON redemption_codes(status);
CREATE INDEX idx_redemption_codes_code ON redemption_codes(code);
CREATE INDEX idx_kyc_submissions_redemption_code_id ON kyc_submissions(redemption_code_id);
CREATE INDEX idx_orders_redemption_code_id ON orders(redemption_code_id);
CREATE INDEX idx_orders_mobimatter_order_id ON orders(mobimatter_order_id);
CREATE INDEX idx_activity_log_event_type ON activity_log(event_type);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX idx_activity_log_batch_id ON activity_log(batch_id);
