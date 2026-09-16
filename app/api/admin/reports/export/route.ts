import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as db from '@/lib/db';
import { stringify } from 'csv-stringify/sync';

// @ts-ignore
export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'csv'; // csv or json
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const productId = searchParams.get('productId');

    // Get user's batches
    const batches = await db.getBatches(userId);
    const batchIds = batches.map((b) => b.id);

    if (batchIds.length === 0) {
      return NextResponse.json({ error: 'No batches found' }, { status: 404 });
    }

    // Build WHERE clause
    let whereClause = `rc.batch_id IN (${batchIds.join(',')})`;
    const params: any[] = [];

    if (startDateStr) {
      whereClause += ` AND rc.created_at >= $${params.length + 1}`;
      params.push(new Date(startDateStr));
    }

    if (endDateStr) {
      const endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
      whereClause += ` AND rc.created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    if (productId) {
      whereClause += ` AND b.mobimatter_product_id = $${params.length + 1}`;
      params.push(productId);
    }

    // Get all codes with details
    const result = await db.query(
      `SELECT
         rc.code,
         rc.status,
         b.product_name,
         rc.created_at,
         rc.redeemed_at,
         ky.full_name,
         ky.phone_number,
         ky.email,
         o.iccid,
         o.mobimatter_order_id
       FROM redemption_codes rc
       JOIN batches b ON rc.batch_id = b.id
       LEFT JOIN kyc_submissions ky ON rc.id = ky.redemption_code_id
       LEFT JOIN orders o ON rc.id = o.redemption_code_id
       WHERE ${whereClause}
       ORDER BY rc.created_at DESC`,
      params
    );

    const codes = result.rows || [];

    if (format === 'csv') {
      // CSV export
      const csvData = [
        [
          'Redemption Code',
          'Status',
          'Product',
          'Created Date',
          'Redeemed Date',
          'Customer Name',
          'Phone Number',
          'Email',
          'ICCID',
          'Mobimatter Order ID',
        ],
        ...codes.map((c: any) => [
          c.code,
          c.status,
          c.product_name,
          c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
          c.redeemed_at ? new Date(c.redeemed_at).toLocaleDateString() : '',
          c.full_name || '',
          c.phone_number || '',
          c.email || '',
          c.iccid || '',
          c.mobimatter_order_id || '',
        ]),
      ];

      const csv = stringify(csvData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="redemption-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else {
      // JSON export
      const json = JSON.stringify(
        {
          exportDate: new Date().toISOString(),
          dateRange: {
            start: startDateStr || null,
            end: endDateStr || null,
          },
          filter: { productId: productId || null },
          summary: {
            totalCodes: codes.length,
            redeemed: codes.filter((c: any) => c.status === 'utilisé').length,
            failed: codes.filter((c: any) => c.status === 'en_cours_traitement').length,
          },
          codes: codes.map((c: any) => ({
            code: c.code,
            status: c.status,
            product: c.product_name,
            createdDate: c.created_at,
            redeemedDate: c.redeemed_at,
            customer: {
              name: c.full_name,
              phone: c.phone_number,
              email: c.email,
            },
            order: {
              iccid: c.iccid,
              mobimatterId: c.mobimatter_order_id,
            },
          })),
        },
        null,
        2
      );

      return new NextResponse(json, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="redemption-report-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    }
  } catch (error) {
    console.error('Error exporting report:', error);
    return NextResponse.json({ error: 'Failed to export report' }, { status: 500 });
  }
}
