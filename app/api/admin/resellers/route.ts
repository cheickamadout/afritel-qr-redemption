import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, contactPerson, address, city, country, notes } = body;

    if (!name) {
      return NextResponse.json({ error: 'Reseller name is required' }, { status: 400 });
    }

    const resellerId = await db.createReseller({
      name,
      email,
      phone,
      contactPerson,
      address,
      city,
      country,
      notes,
    });

    await db.logActivity('reseller_created', {
      details: { resellerId, name, email },
    });

    return NextResponse.json({
      success: true,
      resellerId,
      message: `Reseller "${name}" created successfully`,
    });
  } catch (error: any) {
    console.error('Error creating reseller:', error);
    if (error.message?.includes('duplicate')) {
      return NextResponse.json({ error: 'Reseller name already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create reseller' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const resellers = await db.getResellers();
    return NextResponse.json(resellers);
  } catch (error) {
    console.error('Error fetching resellers:', error);
    return NextResponse.json({ error: 'Failed to fetch resellers' }, { status: 500 });
  }
}
