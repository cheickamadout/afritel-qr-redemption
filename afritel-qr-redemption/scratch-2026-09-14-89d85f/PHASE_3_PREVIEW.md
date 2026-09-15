# Phase 3: Mobimatter Integration & eSIM Delivery — PREVIEW

## Overview

Phase 3 is where the "real" flow happens: after KYC submission, the backend calls Mobimatter to create an actual eSIM order, retrieves the QR code and activation link, and delivers it to the customer on the success page.

**Scope:** ~500 lines of code  
**Complexity:** Medium (API integration, error handling, platform detection)  
**Duration:** 2–3 hours end-to-end

---

## What Phase 3 Builds

### Core: Mobimatter Order Creation & Completion

**File to modify:** `/app/api/public/redeem/route.ts`

Current flow (Phase 2):
```
POST /api/public/redeem
  ↓
1. Validate KYC
2. Mark code en_cours_traitement
3. Save KYC submission
4. Return success
```

Phase 3 flow:
```
POST /api/public/redeem
  ↓
1. Validate KYC
2. Mark code en_cours_traitement
3. Save KYC submission
4. *** NEW: Call Mobimatter API ***
   - POST /order (get orderId)
   - PUT /order/complete (get QR + LPA + ICCID + Android link)
5. *** NEW: Save order to database ***
6. *** NEW: Mark code utilisé + set redeemed_at ***
7. *** NEW: Handle errors gracefully ***
8. Return success (with order data ready for client to fetch)
```

### Customer-Facing: Platform Detection & Device-Specific Links

**File to modify:** `/app/r/[code]/success/page.tsx`

Current behavior:
- Shows generic "eSIM ready" message
- Placeholder sections for QR, LPA, Android link

Phase 3 behavior:
- Detects device OS (iOS, Android, Desktop)
- **iOS:** Display "Installer maintenant" tap-to-install button using Apple Universal Link format
- **Android:** Display direct "Installer maintenant" button using Mobimatter's `oneClickInstall.android` link
- **Desktop:** Display real eSIM QR code image for scanning with another device
- **All platforms:** Show collapsible "manual entry" fallback with SM-DP+ address + confirmation code

### Error Handling

When Mobimatter API returns errors, handle gracefully:

- **402 (Insufficient wallet balance)** → Show generic "temporarily unavailable" message to customer, alert staff that wallet needs funding
- **429 (Out of stock)** → Show "this plan is temporarily unavailable"
- **455 (Provider unavailable)** → Show "telecom provider temporarily unavailable"
- **400 (Generic rejection)** → Show generic error, log full response for staff debugging
- **Timeout (20+ minutes)** → Handle gracefully if order expires before completion

---

## Implementation Details

### 1. Mobimatter Order Creation Flow

Update `/app/api/public/redeem/route.ts`:

```typescript
// Pseudo-code (Phase 3)
const redemptionCode = await db.getRedemptionCodeByCode(code);
await db.updateRedemptionCodeStatus(redemptionCode.id, 'en_cours_traitement');

// Save KYC
const kycId = await db.createKYCSubmission(redemptionCode.id, {...});

// *** NEW: Create Mobimatter order ***
try {
  const orderId = await MobimatterAPI.createOrder(redemptionCode.mobimatter_product_id);
  
  // Complete order (must happen within ~20 minutes of create)
  const orderResponse = await MobimatterAPI.completeOrder(orderId);
  
  // Extract key fields
  const qrCode = MobimatterAPI.extractLineItemDetail(orderResponse, 'QR_CODE');
  const lpa = MobimatterAPI.extractLineItemDetail(orderResponse, 'LOCAL_PROFILE_ASSISTANT');
  const iccid = MobimatterAPI.extractLineItemDetail(orderResponse, 'ICCID');
  const oneClickAndroid = MobimatterAPI.extractLineItemDetail(orderResponse, 'oneClickInstall.android');
  
  // Save to database
  await db.createOrder(redemptionCode.id, orderId, qrCode, lpa, oneClickAndroid, iccid, orderResponse);
  
  // Mark code as redeemed
  await db.markRedemptionCodeRedeemed(redemptionCode.id);
  
  // Log success
  await db.logActivity('order_completed', {
    redemptionCodeId: redemptionCode.id,
    batchId: redemptionCode.batch_id,
    details: { orderId, iccid },
  });
  
  return NextResponse.json({ success: true, orderId });
  
} catch (error) {
  // Handle errors (402, 429, 455, 400, timeouts)
  await db.logActivity('order_failed', {
    redemptionCodeId: redemptionCode.id,
    batchId: redemptionCode.batch_id,
    details: { error: error.message, code: error.response?.status },
  });
  
  // Revert code status so customer can retry
  await db.updateRedemptionCodeStatus(redemptionCode.id, 'non-utilisé');
  
  return NextResponse.json({ error: getUserFacingErrorMessage(error) }, { status: 500 });
}
```

### 2. Platform Detection & Installation Links

Update `/app/r/[code]/success/page.tsx`:

```typescript
// Pseudo-code (Phase 3)

function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'iOS';
  if (/android/.test(ua)) return 'Android';
  return 'Desktop';
}

// iOS: Universal Link format
// https://esim.mobimatter.com/i?lpa={LPA_STRING}
// Or: sms:?body=https://...

// Android: Direct link from Mobimatter
// details.oneClickAndroid (e.g., https://download.mobimatter.com/android/install?...)

// Desktop: Show QR code image
// <img src={details.qrCode} alt="eSIM QR" />

// All platforms: Manual entry fallback
// <details>
//   <summary>Manual entry</summary>
//   SM-DP+: ...
//   Confirmation code: {LPA}
// </details>
```

### 3. Success Page Polling Update

Success page currently polls `/api/public/redemption/[code]/status` every 2 seconds.

Phase 3: once `status === 'utilisé'`, response includes:
- `qrCode` — data URI (PNG base64)
- `lpa` — LOCAL_PROFILE_ASSISTANT string
- `oneClickAndroid` — Android tap-to-install link
- `iccid` — for support reference

Render device-specific UI based on platform + data available.

---

## Database Changes (Already in Phase 1)

No new schema changes needed. Phase 1 schema already includes:

- `redemption_codes.status` — will be set to `utilisé`
- `redemption_codes.redeemed_at` — set to now()
- `orders` table — stores QR, LPA, ICCID, Android link, full Mobimatter response
- `activity_log` — tracks order_completed or order_failed events

---

## Error Handling Strategy

### Customer-Facing Messages

| Error | Message | Retry? |
|-------|---------|--------|
| 402 (Wallet) | "Service temporarily unavailable. Please try again in a few minutes." | Yes (auto-retry on new redemption) |
| 429 (Out of stock) | "This plan is temporarily out of stock. Please choose another plan." | No (wait for stock) |
| 455 (Provider down) | "Telecom provider temporarily unavailable. Please try again shortly." | Yes (auto-retry) |
| 400 (Generic) | "Something went wrong. Please contact support." | No (log for investigation) |
| Timeout | "Order processing timed out. Please try again." | Yes (start fresh) |

### Staff-Facing Alerts

- Log all errors to activity_log with full details
- Consider: send admin email/Slack alert on 402 (wallet) and 429 (stock)
- Dashboard can show batch status with error count

---

## Testing Phase 3

### Prerequisites
- Phase 2 working (KYC form saves to DB)
- Mobimatter sandbox API key valid
- Sandbox environment has test products available

### Test Scenarios

1. **Happy path**: KYC → Mobimatter order → real QR + LPA → success page displays device-specific UI
2. **402 error**: Wallet insufficient → customer sees generic error message, can retry
3. **429 error**: Out of stock → customer sees "out of stock" message, no retry
4. **Timeout**: Order > 20 min → handle gracefully, revert code status
5. **Already used**: Code redeemed once → second attempt shows "already used" error
6. **Concurrent redemption**: Simultaneous requests on same code → one succeeds, one fails

### Manual Testing Steps

1. Create batch in admin dashboard (1–5 codes)
2. Copy a redemption code URL
3. Scan QR (or visit URL manually)
4. Fill KYC form
5. Submit
6. Check success page:
   - Should show real QR code (if desktop) or tap-to-install button (iOS/Android)
   - Should show "copy to clipboard" LPA
   - Should show manual entry fallback
7. Check database:
   - `redemption_codes.status` should be `utilisé`
   - `orders` table should have the real QR + LPA + ICCID

---

## Mobimatter API Details (Refresher)

Already implemented in `lib/mobimatter.ts`:
- `createOrder(productId)` → returns `orderId`
- `completeOrder(orderId)` → returns full response with lineItemDetails
- `extractLineItemDetail(response, name)` → parses response

Key fields to extract:
- `QR_CODE` — `data:image/png;base64,...`
- `LOCAL_PROFILE_ASSISTANT` — LPA activation string
- `ICCID` — eSIM identifier
- `oneClickInstall.android` — Android direct link

---

## Success Criteria for Phase 3

✅ KYC submission triggers Mobimatter API call  
✅ QR code, LPA, and ICCID saved to orders table  
✅ Redemption code marked `utilisé` + `redeemed_at` set  
✅ Success page detects platform (iOS/Android/Desktop)  
✅ Shows device-specific installation UI  
✅ All error codes handled gracefully  
✅ Activity log tracks orders and failures  
✅ Batch stats update correctly (redeemed count increases)  

---

## Next Steps After Phase 3

- **Phase 4:** Error handling & robustness (retry logic, timeouts, edge cases)
- **Phase 5:** Analytics & dashboard enhancements (redemption trends, filtering)
- **Phase 2 Payment Gate (v2):** Insert payment flow before order creation

---

Phase 3 is the "money moment" — customer successfully receives a working eSIM! 🎉

Ready to build when you are.
