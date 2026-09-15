import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const redemptionCode = await db.getRedemptionCodeByCode(params.code);

    if (!redemptionCode) {
      return NextResponse.json({ error: 'Redemption code not found' }, { status: 404 });
    }

    // If code is still being processed, return processing status
    if (redemptionCode.status === 'en_cours_traitement') {
      return NextResponse.json({
        code: redemptionCode.code,
        status: 'processing',
      });
    }

    // If code is redeemed, fetch the order details
    if (redemptionCode.status === 'utilisé') {
      const order = await db.getOrderByRedemptionCodeId(redemptionCode.id);

      if (order) {
        return NextResponse.json({
          code: redemptionCode.code,
          status: 'utilisé',
          qrCode: order.qr_code_data_uri,
          lpa: order.lpa_string,
          oneClickAndroid: order.one_click_install_android,
          iccid: order.iccid,
        });
      }
    }

    // Otherwise, code is unused or in an unknown state
    return NextResponse.json({
      code: redemptionCode.code,
      status: redemptionCode.status,
    });
  } catch (error) {
    console.error('Error checking redemption status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
