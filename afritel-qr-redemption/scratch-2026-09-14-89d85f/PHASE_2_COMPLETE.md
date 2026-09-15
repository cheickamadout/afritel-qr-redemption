# Phase 2: Public Redemption Flow — COMPLETE

## What's Been Built

### User Flow (Publicly Accessible)

1. **Customer scans QR** → `https://afritel.app/r/{redemption_code}`
2. **Redemption page loads** (`/r/[code]/page.tsx`)
   - Validates code exists and is `non-utilisé`
   - Displays plan details (name, destination, data, validity)
   - Shows "Continue" button to proceed to KYC
3. **Customer fills KYC form**
   - Full name (required)
   - Phone number (required, validated)
   - Email (optional)
   - Country/region selector (defaults to FR)
   - Consent checkbox (required)
   - ID field placeholder (shows info: "coming in a future update")
4. **Form submits** → `/api/public/redeem` (POST)
   - Validates all required fields
   - Prevents double-use (checks status)
   - Marks code as `en_cours_traitement` (processing)
   - Saves KYC submission to database
   - Logs activity for audit
5. **Redirects to success page** (`/r/[code]/success`)
   - Shows "Creating your eSIM" message
   - Polls `/api/public/redemption/[code]/status` every 2 seconds
   - Displays real eSIM data once available (Phase 3)

---

## Files Created (Phase 2)

### Pages (Public, No Auth Required)
- `app/r/[code]/page.tsx` — Redemption page + KYC form
  - Plan details display
  - KYC form component (inline)
  - Form validation
  - Error handling for code not found / already used
  
- `app/r/[code]/success/page.tsx` — Processing & success page
  - Status polling (every 2 seconds)
  - Real eSIM data display (QR, LPA, Android link)
  - Fallback messages during processing

### API Routes (Public, No Auth Required)
- `app/api/public/redemption/[code]/route.ts` — GET redemption details
  - Fetches code + batch info
  - Validates code is `non-utilisé`
  - Returns plan details
  - Returns 410 if already redeemed

- `app/api/public/redemption/[code]/status/route.ts` — GET redemption status
  - Checks code status (processing vs. utilisé)
  - If redeemed, returns order details (QR, LPA, ICCID, Android link)
  - Used by success page to poll for completion

- `app/api/public/redeem/route.ts` — POST KYC submission
  - Validates all required fields
  - Prevents double-use race condition
  - Marks code `en_cours_traitement`
  - Saves KYC to database
  - Logs activity for audit
  - **TODO Phase 3:** Replace with actual Mobimatter order creation

### Database Updates
- Added `getOrderByRedemptionCodeId()` to `lib/db.ts`
- Existing schema already supports all Phase 2 data:
  - `kyc_submissions` table (full_name, phone_number, email, consent, ip_address, user_agent)
  - `orders` table (qr_code_data_uri, lpa_string, one_click_install_android, iccid)
  - `activity_log` table (kyc_submitted events)

---

## Key Features

### KYC Form Validation
- **Full Name** — required, non-empty string
- **Phone Number** — required, regex validation (`^\+?[0-9\s-()]{7,}$`)
- **Email** — optional, must be valid if provided
- **Country/Region** — selector, defaults to FR
- **Consent** — required checkbox (ToS + data usage)
- **ID Field** — placeholder info (no actual field yet)

### Error Handling
- Invalid redemption code → 404 page
- Already-redeemed code → 410 page ("code no longer valid")
- Form validation errors → displayed inline, form not submitted
- Network errors → generic "try again" message
- Server errors → 500 response with user-friendly error

### Concurrent Redemption Prevention
- Code marked `en_cours_traitement` immediately after KYC submission
- Prevents second simultaneous request on same code
- Status check prevents false "already used" on polling page

### Success Page Behavior
- Starts in "loading" state (pending status check)
- Transitions to "processing" once KYC is confirmed saved
- Polls every 2 seconds for completion
- Once code marked `utilisé` (Phase 3), fetches order details
- Displays real QR code, LPA string, Android one-click link
- Shows copy-to-clipboard for LPA manual entry fallback

---

## API Endpoints (Phase 2)

### Public (No Authentication)

**GET `/api/public/redemption/:code`**
```json
{
  "code": "aB3cD9eF2gH4jK6mN8p",
  "status": "non-utilisé",
  "product_name": "France 5GB",
  "product_details": {
    "name": "France 5GB",
    "destination": "France",
    "dataAmount": "5GB",
    "validity": "30 days"
  }
}
```

**POST `/api/public/redeem`**
Request:
```json
{
  "code": "aB3cD9eF2gH4jK6mN8p",
  "fullName": "John Doe",
  "phoneNumber": "+33612345678",
  "email": "john@example.com",
  "countryCode": "FR",
  "consentGiven": true,
  "userAgent": "Mozilla/5.0...",
  "ipAddress": "192.168.1.1"
}
```

Response:
```json
{
  "success": true,
  "message": "KYC submitted successfully. Processing your eSIM...",
  "code": "aB3cD9eF2gH4jK6mN8p"
}
```

**GET `/api/public/redemption/:code/status`**
While processing:
```json
{
  "code": "aB3cD9eF2gH4jK6mN8p",
  "status": "processing"
}
```

After completion (Phase 3):
```json
{
  "code": "aB3cD9eF2gH4jK6mN8p",
  "status": "utilisé",
  "qrCode": "data:image/png;base64,...",
  "lpa": "1$s0me-l0ng-lpa-string",
  "oneClickAndroid": "https://...",
  "iccid": "8933110..."
}
```

---

## Database State After KYC Submission

**redemption_codes** table:
```
id | batch_id | code                | status                  | created_at | redeemed_at
1  | 5        | aB3cD9eF2gH4jK6mN8p | en_cours_traitement     | 2026-09-14 | NULL
```

**kyc_submissions** table:
```
id | redemption_code_id | full_name  | phone_number    | email           | consent_given | ip_address    | user_agent
1  | 1                  | John Doe   | +33612345678    | john@example.com| true          | 192.168.1.1   | Mozilla/5.0...
```

**activity_log** table:
```
id | event_type    | redemption_code_id | batch_id | details
1  | kyc_submitted | 1                  | 5        | {"fullName":"John Doe","phoneNumber":"+33612345678",...}
```

---

## What's Ready for Phase 3

### Database
- KYC data is persisted and ready for order creation
- Redemption code status is `en_cours_traitement` (ready for Mobimatter API call)
- Activity log tracks the submission

### API
- `/api/public/redeem` has TODO comment for Phase 3 Mobimatter integration
- Success page is ready to display order results
- Status endpoint is ready to fetch order data

### UI
- Success page has placeholders for:
  - Real QR code image display
  - LPA string with copy-to-clipboard button
  - Android one-click install link
  - Manual entry fallback section

---

## Testing Phase 2

### Prerequisites (Same as Phase 1)
- Project running on `http://localhost:3000`
- Database migrated (schema.sql)
- Admin can create batches

### Test Flow

1. **Create a test batch in admin dashboard**
   - 5–10 codes is enough for testing
   - Note one of the generated codes (e.g., `aB3cD9eF2gH4jK6mN8p`)

2. **Visit redemption page**
   - Navigate to `http://localhost:3000/r/aB3cD9eF2gH4jK6mN8p`
   - Should show plan details

3. **Click "Continue"**
   - KYC form appears

4. **Fill out form (all fields required)**
   - Full Name: `John Doe`
   - Phone: `+33612345678`
   - Email: `john@example.com`
   - Country: `FR`
   - Consent: ☑️ checked

5. **Click "Claim eSIM"**
   - Form validates
   - Redirects to success page
   - Should show "Creating your eSIM..."

6. **Check database**
   ```sql
   -- In Neon SQL editor:
   SELECT * FROM redemption_codes WHERE code = 'aB3cD9eF2gH4jK6mN8p';
   -- Should show status: en_cours_traitement

   SELECT * FROM kyc_submissions WHERE redemption_code_id = 1;
   -- Should show the submitted data
   ```

7. **Try invalid code**
   - Visit `http://localhost:3000/r/invalid`
   - Should show "code not found" error

8. **Try already-used code** (after Phase 3, once order completes)
   - Visit same code again
   - Should show "already used" error

---

## Known Limitations (End of Phase 2)

1. **No real Mobimatter order yet** — Phase 3 task
2. **Success page shows "processing" indefinitely** — no real order data to fetch
3. **No platform detection** — Phase 3 will detect iOS/Android/Desktop
4. **No tap-to-install links** — Phase 3 will construct Universal Links (iOS) + Android links
5. **No payment gate** — Designed for Phase 2 payment addition (v2 feature)
6. **No SMS/WhatsApp delivery** — v2 feature
7. **No advanced KYC fields** — ID document support deferred (Phase 2.5 pending business confirmation)

---

## Phase 2 → Phase 3 Transition

Phase 3 replaces the TODO in `/api/public/redeem` with:

1. Call `MobimatterAPI.createOrder(productId)` → get `orderId`
2. Call `MobimatterAPI.completeOrder(orderId)` → get real QR + LPA
3. Extract: QR_CODE, LOCAL_PROFILE_ASSISTANT, oneClickInstall.android, ICCID
4. Save to `orders` table via `db.createOrder()`
5. Mark code as `utilisé` + set `redeemed_at`
6. Success page polls and displays results
7. Handle all Mobimatter error codes (402, 429, 455, 400)

---

## Files Summary

Phase 2 adds **5 new files**:
- 2 page files (redemption + success)
- 2 API route files (redemption details + KYC submission)
- 1 status check route
- 1 database helper function added to existing db.ts

Total Phase 2 code: ~400 lines (forms, validation, polling, error handling)

---

All set for Phase 3! Ready to implement Mobimatter order creation and real eSIM delivery.
