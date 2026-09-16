import { sql } from '@vercel/postgres';

export async function query(text: string, params?: any[]) {
  try {
    return await sql.query(text, params);
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// ===== RESELLER OPERATIONS =====

export async function createReseller(data: any) {
  const result = await query(
    `INSERT INTO resellers (name, email, phone, contact_person, address, city, country, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [data.name, data.email, data.phone, data.contactPerson, data.address, data.city, data.country, data.notes]
  );
  return result.rows[0]?.id;
}

export async function getResellers() {
  const result = await query(
    `SELECT * FROM resellers WHERE status = 'active' ORDER BY name`
  );
  return result.rows;
}

export async function getReseller(resellerId: number) {
  const result = await query(
    `SELECT * FROM resellers WHERE id = $1`,
    [resellerId]
  );
  return result.rows[0];
}

export async function updateReseller(resellerId: number, data: any) {
  await query(
    `UPDATE resellers SET name = $1, email = $2, phone = $3, contact_person = $4,
     address = $5, city = $6, country = $7, notes = $8, updated_at = NOW()
     WHERE id = $9`,
    [data.name, data.email, data.phone, data.contactPerson, data.address, data.city, data.country, data.notes, resellerId]
  );
}

export async function deleteReseller(resellerId: number) {
  await query(
    `UPDATE resellers SET status = 'inactive' WHERE id = $1`,
    [resellerId]
  );
}

// ===== BATCH OPERATIONS =====

export async function createBatch(
  resellerId: number,
  productId: string,
  productName: string,
  quantityRequested: number
) {
  const result = await query(
    `INSERT INTO batches (reseller_id, mobimatter_product_id, product_name, quantity_requested)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [resellerId, productId, productName, quantityRequested]
  );
  return result.rows[0]?.id;
}

export async function addRedemptionCodes(
  batchId: number,
  codes: Array<{ code: string; qrCodeDataUri: string }>
) {
  const result = await query(
    `INSERT INTO redemption_codes (batch_id, code, qr_code_data_uri)
     VALUES ${codes.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(',')}
     RETURNING id`,
    [batchId, ...codes.flatMap((c) => [c.code, c.qrCodeDataUri])]
  );
  return result.rows;
}

export async function updateBatchStatus(batchId: number, status: string, generated: number) {
  await query(
    `UPDATE batches SET status = $1, quantity_generated = $2 WHERE id = $3`,
    [status, generated, batchId]
  );
}

export async function getBatch(batchId: number) {
  const result = await query(
    `SELECT * FROM batches WHERE id = $1`,
    [batchId]
  );
  return result.rows[0];
}

export async function getBatches(resellerId?: number) {
  const query_ = resellerId
    ? `SELECT * FROM batches WHERE reseller_id = $1 ORDER BY created_at DESC`
    : `SELECT * FROM batches ORDER BY created_at DESC`;
  const params = resellerId ? [resellerId] : [];
  const result = await query(query_, params);
  return result.rows;
}

export async function getRedemptionCodesBatch(batchId: number) {
  const result = await query(
    `SELECT * FROM redemption_codes WHERE batch_id = $1 ORDER BY created_at`,
    [batchId]
  );
  return result.rows;
}

export async function getRedemptionCodeByCode(code: string) {
  const result = await query(
    `SELECT * FROM redemption_codes WHERE code = $1`,
    [code]
  );
  return result.rows[0];
}

export async function updateRedemptionCodeStatus(codeId: number, status: string) {
  await query(
    `UPDATE redemption_codes SET status = $1 WHERE id = $2`,
    [status, codeId]
  );
}

export async function markRedemptionCodeRedeemed(codeId: number, redeemedAt?: Date) {
  await query(
    `UPDATE redemption_codes SET status = 'utilisé', redeemed_at = $1 WHERE id = $2`,
    [redeemedAt || new Date(), codeId]
  );
}

export async function createKYCSubmission(codeId: number, data: any) {
  const result = await query(
    `INSERT INTO kyc_submissions
     (redemption_code_id, full_name, phone_number, email, country_code, consent_given, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      codeId,
      data.fullName,
      data.phoneNumber,
      data.email || null,
      data.countryCode || null,
      data.consentGiven || false,
      data.ipAddress || null,
      data.userAgent || null,
    ]
  );
  return result.rows[0]?.id;
}

export async function createOrder(
  codeId: number,
  orderId: string,
  qrCode: string,
  lpaString: string,
  oneClickAndroid: string | null,
  iccid: string,
  response: any
) {
  const result = await query(
    `INSERT INTO orders
     (redemption_code_id, mobimatter_order_id, qr_code_data_uri, lpa_string, one_click_install_android, iccid, mobimatter_response)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [codeId, orderId, qrCode, lpaString, oneClickAndroid, iccid, JSON.stringify(response)]
  );
  return result.rows[0]?.id;
}

export async function getOrderByRedemptionCodeId(codeId: number) {
  const result = await query(
    `SELECT * FROM orders WHERE redemption_code_id = $1`,
    [codeId]
  );
  return result.rows[0];
}

export async function updateBatchRedeemedCount(batchId: number, increment: number = 1) {
  await query(
    `UPDATE batches SET quantity_redeemed = quantity_redeemed + $1 WHERE id = $2`,
    [increment, batchId]
  );
}

export async function logActivity(
  eventType: string,
  data: { redemptionCodeId?: number; batchId?: number; userId?: string; details?: any }
) {
  await query(
    `INSERT INTO activity_log (event_type, redemption_code_id, batch_id, user_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [eventType, data.redemptionCodeId, data.batchId, data.userId, JSON.stringify(data.details)]
  );
}
