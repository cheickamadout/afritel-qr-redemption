'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

interface BatchDetail {
  batch: {
    id: number;
    product_name: string;
    mobimatter_product_id: string;
    quantity_requested: number;
    quantity_generated: number;
    quantity_redeemed: number;
    status: string;
    created_at: string;
  };
  codes: Array<{
    id: number;
    code: string;
    status: string;
    created_at: string;
  }>;
  stats: {
    total: number;
    unused: number;
    processing: number;
    redeemed: number;
  };
}

export default function BatchDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [data, setData] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchBatch();
  }, []);

  async function fetchBatch() {
    try {
      const response = await fetch(`/api/admin/batches/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setData(data);
      } else if (response.status === 404) {
        setError('Batch not found');
      } else {
        setError('Failed to load batch');
      }
    } catch (error) {
      setError('Error loading batch');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(format: 'csv' | 'pdf') {
    setExporting(true);
    try {
      const response = await fetch(`/api/admin/batches/${params.id}/export?format=${format}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.headers
          .get('content-disposition')
          ?.split('filename="')[1]
          ?.split('"')[0] || `batch-${params.id}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('Failed to export batch');
      }
    } catch (error) {
      setError('Error exporting batch');
      console.error(error);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <span className="loading"></span>
          <p style={{ marginTop: '10px' }}>Loading batch...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <Link href="/admin/dashboard" style={{ marginBottom: '20px', display: 'inline-block' }}>
          ← Back to Dashboard
        </Link>
        <div
          style={{
            background: '#ffebee',
            color: '#c62828',
            padding: '20px',
            borderRadius: '8px',
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { batch, stats } = data;

  return (
    <div className="container">
      <div className="header">
        <div>
          <Link href="/admin/dashboard" style={{ color: '#0070f3', textDecoration: 'none' }}>
            ← Dashboard
          </Link>
          <h1 style={{ marginTop: '10px' }}>{batch.product_name}</h1>
        </div>
        <UserButton afterSignOutUrl="/admin/signin" />
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>PRODUCT ID</div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>{batch.mobimatter_product_id}</div>
          </div>
          <div>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>TOTAL CODES</div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>{stats.total}</div>
          </div>
          <div>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>UNUSED</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#0070f3' }}>{stats.unused}</div>
          </div>
          <div>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>REDEEMED</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#388e3c' }}>{stats.redeemed}</div>
          </div>
          <div>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>STATUS</div>
            <div className={`status-badge status-${batch.status.replace(/_/g, '-')}`}>
              {batch.status}
            </div>
          </div>
          <div>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>CREATED</div>
            <div style={{ fontSize: '14px' }}>{new Date(batch.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button className="button button-primary" onClick={() => handleExport('pdf')} disabled={exporting}>
          {exporting ? '⏳ Exporting...' : '📄 Export as PDF'}
        </button>
        <button className="button button-secondary" onClick={() => handleExport('csv')} disabled={exporting}>
          {exporting ? '⏳ Exporting...' : '📋 Export as CSV'}
        </button>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px' }}>
        <h3 style={{ marginBottom: '16px' }}>Redemption Codes ({data.codes.length})</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Code</th>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.codes.slice(0, 100).map((code) => (
                <tr key={code.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px' }}>
                    <code style={{ fontSize: '12px', background: '#f5f5f5', padding: '4px 8px', borderRadius: '4px' }}>
                      {code.code}
                    </code>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span className={`status-badge status-${code.status.replace(/_/g, '-')}`}>
                      {code.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px', color: '#888' }}>
                    {new Date(code.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.codes.length > 100 && (
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#888' }}>
              Showing first 100 of {data.codes.length} codes
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
