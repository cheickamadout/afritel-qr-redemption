'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

interface AnalyticsData {
  dateRange: { startDate: string; endDate: string };
  summary: {
    totalCodes: number;
    totalRedeemed: number;
    totalFailed: number;
    redemptionRate: number;
    averageTimeToRedeem: number;
  };
  trends: Array<{ date: string; redeemed: number; failed: number; rate: number }>;
  byProduct: Array<{
    productId: string;
    productName: string;
    total: number;
    redeemed: number;
    failed: number;
    rate: number;
  }>;
  errors: Array<{ type: string; count: number; percentage: number }>;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(
    searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    searchParams.get('endDate') || new Date().toISOString().split('T')[0]
  );
  const [productId, setProductId] = useState(searchParams.get('productId') || '');

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate, productId]);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      if (productId) params.append('productId', productId);

      const response = await fetch(`/api/admin/analytics?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function exportReport(format: 'csv' | 'json') {
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      if (productId) params.append('productId', productId);

      const response = await fetch(`/api/admin/reports/export?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <Link href="/admin/dashboard" style={{ color: '#0070f3', textDecoration: 'none' }}>
            ← Dashboard
          </Link>
          <h1 style={{ marginTop: '10px' }}>Analytics & Reports</h1>
        </div>
        <UserButton afterSignOutUrl="/admin/signin" />
      </div>

      {/* Filters */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div className="form-group">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Product (Optional)</label>
            <input
              type="text"
              placeholder="Filter by product ID"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <button className="button button-secondary" onClick={fetchAnalytics}>
              Apply Filters
            </button>
            <button
              className="button button-secondary"
              onClick={() => {
                setStartDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                setEndDate(new Date().toISOString().split('T')[0]);
                setProductId('');
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Export */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button className="button button-secondary" onClick={() => exportReport('csv')}>
          📥 Export as CSV
        </button>
        <button className="button button-secondary" onClick={() => exportReport('json')}>
          📥 Export as JSON
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <span className="loading"></span>
          <p style={{ marginTop: '10px' }}>Loading analytics...</p>
        </div>
      ) : analytics ? (
        <>
          {/* Summary Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>TOTAL CODES</div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>{analytics.summary.totalCodes}</div>
            </div>
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>REDEEMED</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#388e3c' }}>
                {analytics.summary.totalRedeemed}
              </div>
            </div>
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>REDEMPTION RATE</div>
              <div style={{ fontSize: '28px', fontWeight: '700' }}>{analytics.summary.redemptionRate}%</div>
            </div>
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>AVG TIME TO REDEEM</div>
              <div style={{ fontSize: '20px', fontWeight: '700' }}>
                {Math.round(analytics.summary.averageTimeToRedeem / 60)}m
              </div>
            </div>
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>FAILED ORDERS</div>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#d32f2f' }}>
                {analytics.summary.totalFailed}
              </div>
            </div>
          </div>

          {/* By Product */}
          {analytics.byProduct.length > 0 && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '16px' }}>By Product</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Product</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Total</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Redeemed</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.byProduct.map((p) => (
                      <tr key={p.productId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '600' }}>{p.productName}</div>
                          <div style={{ fontSize: '12px', color: '#888' }}>{p.productId}</div>
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px' }}>{p.total}</td>
                        <td style={{ textAlign: 'right', padding: '12px', color: '#388e3c' }}>
                          {p.redeemed}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>
                          {p.rate}%
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px', color: '#d32f2f' }}>
                          {p.failed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error Breakdown */}
          {analytics.errors.length > 0 && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '16px' }}>Error Breakdown</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                {analytics.errors.map((e) => (
                  <div
                    key={e.type}
                    style={{
                      padding: '16px',
                      background: '#f5f5f5',
                      borderRadius: '6px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>{e.type}</div>
                    <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>{e.count}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{e.percentage}% of failures</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trends (Simple List) */}
          {analytics.trends.length > 0 && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px' }}>
              <h3 style={{ marginBottom: '16px' }}>Daily Trends</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Date</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Redeemed</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Failed</th>
                      <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.trends.map((t) => (
                      <tr key={t.date} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px' }}>
                          {new Date(t.date).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px', color: '#388e3c' }}>
                          {t.redeemed}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px', color: '#d32f2f' }}>
                          {t.failed}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>
                          {t.rate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '8px' }}>
          <p>No data available for this period.</p>
        </div>
      )}
    </div>
  );
}
