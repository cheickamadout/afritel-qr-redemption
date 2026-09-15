import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as db from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const batchId = parseInt(params.id);
    const batch = await db.getBatch(batchId);

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Verify ownership
    if (batch.created_by_user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const codes = await db.getRedemptionCodesBatch(batchId);

    return NextResponse.json({
      batch,
      codes,
      stats: {
        total: codes.length,
        unused: codes.filter((c) => c.status === 'non-utilisé').length,
        processing: codes.filter((c) => c.status === 'en_cours_traitement').length,
        redeemed: codes.filter((c) => c.status === 'utilisé').length,
      },
    });
  } catch (error) {
    console.error('Error fetching batch:', error);
    return NextResponse.json({ error: 'Failed to fetch batch' }, { status: 500 });
  }
}
