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

    // Only allow redemption if status is 'non-utilisé'
    if (redemptionCode.status !== 'non-utilisé') {
      return NextResponse.json(
        { error: 'This redemption code has already been used or is no longer valid' },
        { status: 410 }
      );
    }

    // Fetch batch to get product details
    const batch = await db.getBatch(redemptionCode.batch_id);

    if (!batch) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({
      code: redemptionCode.code,
      status: redemptionCode.status,
      product_name: batch.product_name,
      product_details: {
        name: batch.product_name,
        destination: batch.notes || 'Unknown',
        // In Phase 3, we'd fetch additional details from Mobimatter API
      },
    });
  } catch (error) {
    console.error('Error fetching redemption data:', error);
    return NextResponse.json({ error: 'Failed to load redemption data' }, { status: 500 });
  }
}
