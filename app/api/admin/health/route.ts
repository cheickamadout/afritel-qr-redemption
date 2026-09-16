import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as db from '@/lib/db';

interface HealthData {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  alerts: Array<{
    severity: 'info' | 'warning' | 'critical';
    message: string;
    details?: any;
  }>;
  stats: {
    totalBatches: number;
    totalCodes: number;
    totalRedeemed: number;
    totalFailed: number;
    redemptionRate: number;
    recentFailures: number; // Last 1 hour
  };
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const alerts: HealthData['alerts'] = [];
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Get batch statistics
    const batches = await db.getBatches(userId);
    const totalBatches = batches.length;
    const totalCodes = batches.reduce((sum, b) => sum + b.quantity_generated, 0);
    const totalRedeemed = batches.reduce((sum, b) => sum + b.quantity_redeemed, 0);
    const redemptionRate = totalCodes > 0 ? (totalRedeemed / totalCodes) * 100 : 0;

    // Count recent failures (last 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const result = await db.query(
      `SELECT COUNT(*) as count FROM activity_log
       WHERE event_type = 'order_failed' AND created_at > $1`,
      [oneHourAgo]
    );
    const recentFailures = result.rows[0]?.count || 0;

    // Check for wallet/stock issues (402, 429)
    const errorResult = await db.query(
      `SELECT COUNT(*) as count, details->>'error' as error_type
       FROM activity_log
       WHERE event_type = 'order_failed' AND created_at > $1
       GROUP BY details->>'error'
       LIMIT 10`,
      [oneHourAgo]
    );

    const recentErrors = errorResult.rows || [];

    // Alert on wallet issues (402)
    const walletErrors = recentErrors.filter(
      (e: any) => e.error_type?.includes('402') || e.error_type?.includes('wallet')
    );
    if (walletErrors.length > 0) {
      alerts.push({
        severity: 'critical',
        message: `⚠️ AFRITEL Action Required: Wallet balance low. ${walletErrors[0].count} failed orders in last hour.`,
        details: { type: '402 - Insufficient Balance', count: walletErrors[0].count },
      });
      overallStatus = 'critical';
    }

    // Alert on stock issues (429)
    const stockErrors = recentErrors.filter(
      (e: any) => e.error_type?.includes('429') || e.error_type?.includes('stock')
    );
    if (stockErrors.length > 0) {
      alerts.push({
        severity: 'warning',
        message: `📦 Stock Alert: ${stockErrors.length > 1 ? 'Multiple products' : 'Product'} out of stock. ${stockErrors[0].count} failed orders in last hour.`,
        details: { type: '429 - Out of Stock', count: stockErrors[0].count },
      });
      if (overallStatus !== 'critical') {
        overallStatus = 'warning';
      }
    }

    // Alert on provider issues (455)
    const providerErrors = recentErrors.filter(
      (e: any) => e.error_type?.includes('455') || e.error_type?.includes('provider')
    );
    if (providerErrors.length > 0) {
      alerts.push({
        severity: 'warning',
        message: `🔴 Provider Issue: Telecom provider temporarily unavailable. ${providerErrors[0].count} failed orders in last hour.`,
        details: { type: '455 - Provider Down', count: providerErrors[0].count },
      });
      if (overallStatus !== 'critical') {
        overallStatus = 'warning';
      }
    }

    // Alert on high failure rate
    const failureCount = recentErrors.reduce((sum: number, e: any) => sum + parseInt(e.count || 0), 0);
    if (recentFailures > 5) {
      alerts.push({
        severity: 'warning',
        message: `📈 High Failure Rate: ${recentFailures} orders failed in the last hour.`,
        details: { failureCount: recentFailures },
      });
      if (overallStatus !== 'critical') {
        overallStatus = 'warning';
      }
    }

    // No issues
    if (alerts.length === 0) {
      alerts.push({
        severity: 'info',
        message: '✅ All systems operational',
      });
    }

    const health: HealthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      alerts,
      stats: {
        totalBatches,
        totalCodes,
        totalRedeemed,
        totalFailed: failureCount,
        redemptionRate: Math.round(redemptionRate * 100) / 100,
        recentFailures,
      },
    };

    return NextResponse.json(health);
  } catch (error) {
    console.error('Error calculating health:', error);
    return NextResponse.json(
      { error: 'Failed to calculate system health' },
      { status: 500 }
    );
  }
}
