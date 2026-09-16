import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as db from '@/lib/db';

interface AnalyticsData {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalCodes: number;
    totalRedeemed: number;
    totalFailed: number;
    redemptionRate: number;
    averageTimeToRedeem: number; // in seconds
  };
  trends: Array<{
    date: string;
    redeemed: number;
    failed: number;
    rate: number;
  }>;
  byProduct: Array<{
    productId: string;
    productName: string;
    total: number;
    redeemed: number;
    failed: number;
    rate: number;
  }>;
  errors: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const startDateStr = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDateStr = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const productId = searchParams.get('productId');

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999); // Include entire end day

    // Get user's batches
    const batches = await db.getBatches(userId);
    const batchIds = batches.map((b) => b.id);

    if (batchIds.length === 0) {
      return NextResponse.json({
        dateRange: { startDate: startDateStr, endDate: endDateStr },
        summary: {
          totalCodes: 0,
          totalRedeemed: 0,
          totalFailed: 0,
          redemptionRate: 0,
          averageTimeToRedeem: 0,
        },
        trends: [],
        byProduct: [],
        errors: [],
      });
    }

    // Build WHERE clause
    let whereClause = `batch_id IN (${batchIds.join(',')}) AND created_at >= $1 AND created_at <= $2`;
    const params: any[] = [startDate, endDate];

    if (productId) {
      whereClause += ` AND mobimatter_product_id = $${params.length + 1}`;
      params.push(productId);
    }

    // Get total codes in period
    const codesResult = await db.query(
      `SELECT COUNT(*) as count FROM redemption_codes WHERE ${whereClause}`,
      params
    );
    const totalCodes = codesResult.rows[0]?.count || 0;

    // Get redeemed codes
    const redeemedResult = await db.query(
      `SELECT COUNT(*) as count FROM redemption_codes WHERE ${whereClause} AND status = 'utilisé'`,
      params
    );
    const totalRedeemed = redeemedResult.rows[0]?.count || 0;

    // Get failed orders (from activity log)
    const failedResult = await db.query(
      `SELECT COUNT(*) as count FROM activity_log
       WHERE event_type = 'order_failed' AND created_at >= $1 AND created_at <= $2`,
      [startDate, endDate]
    );
    const totalFailed = failedResult.rows[0]?.count || 0;

    const redemptionRate = totalCodes > 0 ? (totalRedeemed / totalCodes) * 100 : 0;

    // Get average time to redeem (KYC submission to order completion)
    const timeResult = await db.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (al.created_at - al2.created_at))) as avg_seconds
       FROM activity_log al
       JOIN activity_log al2 ON al.redemption_code_id = al2.redemption_code_id
       WHERE al.event_type = 'order_completed'
       AND al2.event_type = 'kyc_submitted'
       AND al.created_at >= $1 AND al.created_at <= $2`,
      [startDate, endDate]
    );
    const averageTimeToRedeem = timeResult.rows[0]?.avg_seconds || 0;

    // Get daily trends
    const trendsResult = await db.query(
      `SELECT
         DATE(rc.created_at) as date,
         COUNT(CASE WHEN rc.status = 'utilisé' THEN 1 END) as redeemed,
         COUNT(CASE WHEN al.event_type = 'order_failed' THEN 1 END) as failed,
         COUNT(rc.id) as total
       FROM redemption_codes rc
       LEFT JOIN activity_log al ON rc.id = al.redemption_code_id AND al.event_type = 'order_failed'
       WHERE ${whereClause}
       GROUP BY DATE(rc.created_at)
       ORDER BY date ASC`,
      params
    );

    const trends = trendsResult.rows.map((row: any) => ({
      date: row.date,
      redeemed: parseInt(row.redeemed || 0),
      failed: parseInt(row.failed || 0),
      rate: row.total > 0 ? Math.round((parseInt(row.redeemed || 0) / row.total) * 100 * 100) / 100 : 0,
    }));

    // Get by product stats
    const productResult = await db.query(
      `SELECT
         b.mobimatter_product_id,
         b.product_name,
         COUNT(rc.id) as total,
         COUNT(CASE WHEN rc.status = 'utilisé' THEN 1 END) as redeemed,
         COUNT(CASE WHEN al.event_type = 'order_failed' THEN 1 END) as failed
       FROM batches b
       JOIN redemption_codes rc ON b.id = rc.batch_id
       LEFT JOIN activity_log al ON rc.id = al.redemption_code_id AND al.event_type = 'order_failed'
       WHERE b.id IN (${batchIds.join(',')}) AND rc.created_at >= $1 AND rc.created_at <= $2
       GROUP BY b.mobimatter_product_id, b.product_name
       ORDER BY total DESC`,
      [startDate, endDate]
    );

    const byProduct = productResult.rows.map((row: any) => ({
      productId: row.mobimatter_product_id,
      productName: row.product_name,
      total: parseInt(row.total || 0),
      redeemed: parseInt(row.redeemed || 0),
      failed: parseInt(row.failed || 0),
      rate: row.total > 0 ? Math.round((parseInt(row.redeemed || 0) / row.total) * 100 * 100) / 100 : 0,
    }));

    // Get error breakdown
    const errorsResult = await db.query(
      `SELECT
         CASE
           WHEN details->>'error' LIKE '%402%' THEN 'Wallet Low'
           WHEN details->>'error' LIKE '%429%' THEN 'Out of Stock'
           WHEN details->>'error' LIKE '%455%' THEN 'Provider Down'
           WHEN details->>'error' LIKE '%400%' THEN 'Invalid Request'
           ELSE 'Other Error'
         END as error_type,
         COUNT(*) as count
       FROM activity_log
       WHERE event_type = 'order_failed' AND created_at >= $1 AND created_at <= $2
       GROUP BY error_type
       ORDER BY count DESC`,
      [startDate, endDate]
    );

    const errors = errorsResult.rows.map((row: any) => ({
      type: row.error_type,
      count: parseInt(row.count || 0),
      percentage: totalFailed > 0 ? Math.round((parseInt(row.count || 0) / totalFailed) * 100 * 100) / 100 : 0,
    }));

    const analytics: AnalyticsData = {
      dateRange: { startDate: startDateStr, endDate: endDateStr },
      summary: {
        totalCodes,
        totalRedeemed,
        totalFailed,
        redemptionRate: Math.round(redemptionRate * 100) / 100,
        averageTimeToRedeem: Math.round(averageTimeToRedeem),
      },
      trends,
      byProduct,
      errors,
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error calculating analytics:', error);
    return NextResponse.json({ error: 'Failed to calculate analytics' }, { status: 500 });
  }
}
