import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { generateRedemptionCodeBatch, generateQRCodesForBatch } from '@/lib/codeGeneration';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resellerId, productId, productName, quantity } = body;

    if (!resellerId || !productId || !productName || !quantity) {
      return NextResponse.json(
        { error: 'Missing required fields: resellerId, productId, productName, quantity' },
        { status: 400 }
      );
    }

    if (quantity > 5000) {
      return NextResponse.json(
        { error: 'Batch size cannot exceed 5000 codes' },
        { status: 400 }
      );
    }

    // Verify reseller exists
    const reseller = await db.getReseller(resellerId);
    if (!reseller) {
      return NextResponse.json({ error: 'Reseller not found' }, { status: 404 });
    }

    // Create batch record
    const batchId = await db.createBatch(resellerId, productId, productName, quantity);

    // Generate redemption codes
    const codes = generateRedemptionCodeBatch(quantity);

    // Generate QR codes
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const codesWithQR = await generateQRCodesForBatch(codes, appUrl);

    // Insert into database
    const result = await db.addRedemptionCodes(batchId, codesWithQR);

    // Update batch status
    await db.updateBatchStatus(batchId, 'prêt', quantity);

    // Log activity
    await db.logActivity('batch_created', {
      batchId,
      details: { resellerId, quantity, productId, productName },
    });

    return NextResponse.json({
      success: true,
      batchId,
      quantity: result.length,
      message: `Batch created successfully with ${result.length} redemption codes`,
    });
  } catch (error) {
    console.error('Error creating batch:', error);
    return NextResponse.json(
      { error: 'Failed to create batch' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const resellerId = request.nextUrl.searchParams.get('resellerId');

    if (resellerId) {
      const batches = await db.getBatches(parseInt(resellerId));
      return NextResponse.json(batches);
    }

    const batches = await db.getBatches();
    return NextResponse.json(batches);
  } catch (error) {
    console.error('Error fetching batches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batches' },
      { status: 500 }
    );
  }
}
