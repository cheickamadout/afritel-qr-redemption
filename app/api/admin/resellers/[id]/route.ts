import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const reseller = await db.getReseller(parseInt(params.id));
    if (!reseller) {
      return NextResponse.json({ error: 'Reseller not found' }, { status: 404 });
    }
    return NextResponse.json(reseller);
  } catch (error) {
    console.error('Error fetching reseller:', error);
    return NextResponse.json({ error: 'Failed to fetch reseller' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const resellerId = parseInt(params.id);

    // Verify reseller exists
    const existing = await db.getReseller(resellerId);
    if (!existing) {
      return NextResponse.json({ error: 'Reseller not found' }, { status: 404 });
    }

    await db.updateReseller(resellerId, body);

    await db.logActivity('reseller_updated', {
      details: { resellerId, updates: body },
    });

    return NextResponse.json({ success: true, message: 'Reseller updated' });
  } catch (error) {
    console.error('Error updating reseller:', error);
    return NextResponse.json({ error: 'Failed to update reseller' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const resellerId = parseInt(params.id);

    // Verify reseller exists
    const existing = await db.getReseller(resellerId);
    if (!existing) {
      return NextResponse.json({ error: 'Reseller not found' }, { status: 404 });
    }

    await db.deleteReseller(resellerId);

    await db.logActivity('reseller_deleted', {
      details: { resellerId, name: existing.name },
    });

    return NextResponse.json({ success: true, message: 'Reseller deleted' });
  } catch (error) {
    console.error('Error deleting reseller:', error);
    return NextResponse.json({ error: 'Failed to delete reseller' }, { status: 500 });
  }
}
