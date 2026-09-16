import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { MobimatterAPI } from '@/lib/mobimatter';

function getUserFacingErrorMessage(status: number, message?: string): string {
  switch (status) {
    case 402:
      return 'Service temporarily unavailable. Please try again in a few minutes.';
    case 429:
      return 'This plan is temporarily out of stock. Please try another plan.';
    case 455:
      return 'Telecom provider temporarily unavailable. Please try again shortly.';
    case 400:
      return 'Something went wrong. Please contact support.';
    default:
      return 'Failed to process your order. Please try again.';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, fullName, phoneNumber, email, countryCode, consentGiven, userAgent } = body;

    if (!code || !fullName || !phoneNumber || !consentGiven) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch the redemption code
    const redemptionCode = await db.getRedemptionCodeByCode(code);

    if (!redemptionCode) {
      return NextResponse.json(
        { error: 'Redemption code not found' },
        { status: 404 }
      );
    }

    // Prevent double-use: check if already redeemed
    if (redemptionCode.status !== 'non-utilisé') {
      return NextResponse.json(
        { error: 'This code has already been redeemed or is no longer valid' },
        { status: 410 }
      );
    }

    // Mark code as processing to prevent concurrent redemptions
    await db.updateRedemptionCodeStatus(redemptionCode.id, 'en_cours_traitement');

    // Save KYC submission
    const kycSubmissionId = await db.createKYCSubmission(redemptionCode.id, {
      fullName,
      phoneNumber,
      email: email || null,
      countryCode: countryCode || null,
      consentGiven: true,
      userAgent,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    // Log KYC submission
    await db.logActivity('kyc_submitted', {
      redemptionCodeId: redemptionCode.id,
      batchId: redemptionCode.batch_id,
      details: { fullName, phoneNumber, email, countryCode },
    });

    // ========== PHASE 3: Mobimatter Order Creation ==========

    let orderId: string | null = null;

    try {
      // Step 1: Create order (reserves inventory, expires in ~20 min if not completed)
      orderId = await MobimatterAPI.createOrder(redemptionCode.mobimatter_product_id);

      // Step 2: Complete order (gets real QR code, LPA, ICCID, Android link)
      const orderResponse = await MobimatterAPI.completeOrder(orderId);

      // Step 3: Extract key fields from Mobimatter response
      const qrCode = MobimatterAPI.extractLineItemDetail(orderResponse, 'QR_CODE');
      const lpa = MobimatterAPI.extractLineItemDetail(orderResponse, 'LOCAL_PROFILE_ASSISTANT');
      const iccid = MobimatterAPI.extractLineItemDetail(orderResponse, 'ICCID');
      const oneClickAndroid = MobimatterAPI.extractLineItemDetail(orderResponse, 'oneClickInstall.android');

      if (!qrCode || !lpa || !iccid) {
        throw new Error('Incomplete response from Mobimatter: missing QR code or LPA');
      }

      // Step 4: Save order to database
      await db.createOrder(
        redemptionCode.id,
        orderId,
        qrCode,
        lpa,
        oneClickAndroid,
        iccid,
        orderResponse
      );

      // Step 5: Mark redemption code as used
      await db.markRedemptionCodeRedeemed(redemptionCode.id);

      // Step 6: Update batch redeemed count
      await db.updateBatchRedeemedCount(redemptionCode.batch_id, 1);

      // Log success
      await db.logActivity('order_completed', {
        redemptionCodeId: redemptionCode.id,
        batchId: redemptionCode.batch_id,
        details: { orderId, iccid, productId: redemptionCode.mobimatter_product_id },
      });

      return NextResponse.json({
        success: true,
        message: 'eSIM created successfully!',
        code,
        orderId,
      });
    } catch (mobimatterError: any) {
      console.error('Mobimatter API error:', mobimatterError);

      const status = mobimatterError.response?.status || 500;
      const errorMessage = mobimatterError.message || 'Unknown error';

      // Log the failure
      await db.logActivity('order_failed', {
        redemptionCodeId: redemptionCode.id,
        batchId: redemptionCode.batch_id,
        details: {
          orderId,
          error: errorMessage,
          status,
          mobimatterResponse: mobimatterError.response?.data,
        },
      });

      // Revert code status to allow retry
      await db.updateRedemptionCodeStatus(redemptionCode.id, 'non-utilisé');

      // Alert on critical errors (wallet, stock)
      if (status === 402 || status === 429) {
        console.warn(`⚠️  AFRITEL ACTION REQUIRED: ${status === 402 ? 'Wallet balance low' : 'Product out of stock'}`);
      }

      return NextResponse.json(
        { error: getUserFacingErrorMessage(status, errorMessage) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing redemption:', error);
    return NextResponse.json(
      { error: 'Failed to process redemption. Please try again.' },
      { status: 500 }
    );
  }
}
