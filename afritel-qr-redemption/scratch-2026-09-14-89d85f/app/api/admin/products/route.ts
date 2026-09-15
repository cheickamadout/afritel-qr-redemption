import { NextRequest, NextResponse } from 'next/server';
import { MobimatterAPI } from '@/lib/mobimatter';

export async function GET(request: NextRequest) {
  try {
    const products = await MobimatterAPI.getProducts();
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products from Mobimatter' },
      { status: 500 }
    );
  }
}
