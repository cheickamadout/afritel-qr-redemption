import Link from 'next/link';

export default function Home() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f5f5f5',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '400px', width: '90%' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>AFRITEL QR Redemption</h1>
        <p style={{ fontSize: '16px', color: '#666', marginBottom: '30px' }}>
          Manage QR code batches and customer redemptions
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Link href="/admin/dashboard">
            <button className="button button-primary" style={{ width: '100%', padding: '14px' }}>
              Admin Dashboard
            </button>
          </Link>
          <Link href="/r/test">
            <button className="button button-secondary" style={{ width: '100%', padding: '14px' }}>
              Redemption Page (Demo)
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
