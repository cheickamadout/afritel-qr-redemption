'use client';

import { useState, useEffect } from 'react';

interface OrderDetails {
  qrCode: string;
  lpa: string;
  oneClickAndroid?: string;
  iccid: string;
}

type Platform = 'iOS' | 'Android' | 'Desktop';
type Status = 'loading' | 'processing' | 'ready' | 'error';

export default function SuccessPage({ params }: { params: { code: string } }) {
  const [status, setStatus] = useState<Status>('loading');
  const [platform, setPlatform] = useState<Platform>('Desktop');
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [pollingCount, setPollingCount] = useState(0);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  useEffect(() => {
    detectPlatform();
    checkRedemptionStatus();

    const interval = setInterval(() => {
      setPollingCount((prev) => prev + 1);
      checkRedemptionStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  function detectPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('iOS');
    } else if (/android/.test(ua)) {
      setPlatform('Android');
    } else {
      setPlatform('Desktop');
    }
  }

  async function checkRedemptionStatus() {
    try {
      const response = await fetch(`/api/public/redemption/${params.code}/status`);
      if (response.ok) {
        const data = await response.json();

        if (data.status === 'processing') {
          setStatus('processing');
        } else if (data.status === 'utilisé') {
          // Order is complete
          setOrderDetails({
            qrCode: data.qrCode,
            lpa: data.lpa,
            oneClickAndroid: data.oneClickAndroid,
            iccid: data.iccid,
          });
          setStatus('ready');
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedToClipboard(true);
    setTimeout(() => setCopiedToClipboard(false), 2000);
  }

  // Construct iOS Universal Link for eSIM installation
  function getIOSInstallLink() {
    if (!orderDetails?.lpa) return '#';
    // Format: esim://install?lpa=...
    // In production, use proper Universal Link: https://.../.well-known/apple-app-site-association
    return `esim://install?lpa=${encodeURIComponent(orderDetails.lpa)}`;
  }

  return (
    <div className="container" style={{ maxWidth: '600px', paddingTop: '60px', paddingBottom: '40px' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '8px' }}>
        {/* Loading State */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center' }}>
            <span className="loading" style={{ fontSize: '40px' }}></span>
            <h1 style={{ marginTop: '20px', fontSize: '24px' }}>Processing Your Redemption</h1>
            <p style={{ color: '#666', marginTop: '10px' }}>Please wait while we set up your eSIM...</p>
          </div>
        )}

        {/* Processing State */}
        {status === 'processing' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <h1 style={{ fontSize: '24px' }}>Creating Your eSIM</h1>
            <p style={{ color: '#666', marginTop: '10px' }}>This usually takes a few seconds...</p>
            <span className="loading" style={{ marginTop: '20px', display: 'inline-block' }}></span>
          </div>
        )}

        {/* Ready State */}
        {status === 'ready' && orderDetails && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
              <h1 style={{ fontSize: '28px', color: '#388e3c' }}>Your eSIM is Ready!</h1>
              <p style={{ color: '#666', marginTop: '10px', fontSize: '16px' }}>
                Tap below to install on this device or scan the QR code on another device.
              </p>
            </div>

            {/* Platform-Specific Installation UI */}
            <div style={{ marginBottom: '24px' }}>
              {platform === 'iOS' && (
                <a
                  href={getIOSInstallLink()}
                  className="button button-primary"
                  style={{
                    width: '100%',
                    display: 'block',
                    padding: '16px',
                    textAlign: 'center',
                    textDecoration: 'none',
                    fontSize: '16px',
                    marginBottom: '16px',
                  }}
                >
                  📱 Installer maintenant (iOS)
                </a>
              )}

              {platform === 'Android' && orderDetails.oneClickAndroid && (
                <a
                  href={orderDetails.oneClickAndroid}
                  className="button button-primary"
                  style={{
                    width: '100%',
                    display: 'block',
                    padding: '16px',
                    textAlign: 'center',
                    textDecoration: 'none',
                    fontSize: '16px',
                    marginBottom: '16px',
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📱 Installer maintenant (Android)
                </a>
              )}

              {platform === 'Desktop' && (
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                    Scan this QR code with your phone to install the eSIM:
                  </p>
                  <img
                    src={orderDetails.qrCode}
                    alt="eSIM QR Code"
                    style={{
                      width: '250px',
                      height: '250px',
                      borderRadius: '8px',
                      border: '2px solid #e0e0e0',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Manual Entry Fallback */}
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={() => setShowManualEntry(!showManualEntry)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#333',
                  textAlign: 'left',
                }}
              >
                {showManualEntry ? '▼' : '▶'} Manual Entry (Advanced)
              </button>

              {showManualEntry && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '16px',
                    background: '#f9f9f9',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0',
                  }}
                >
                  <p style={{ fontSize: '12px', color: '#666', marginBottom: '12px', fontWeight: '600' }}>
                    Use these details to manually add the eSIM profile:
                  </p>

                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                      SM-DP+ Server Address & Confirmation Code:
                    </p>
                    <code
                      style={{
                        display: 'block',
                        padding: '10px',
                        background: 'white',
                        borderRadius: '4px',
                        fontSize: '12px',
                        wordBreak: 'break-all',
                        border: '1px solid #e0e0e0',
                        marginBottom: '8px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {orderDetails.lpa}
                    </code>
                    <button
                      onClick={() => copyToClipboard(orderDetails.lpa)}
                      className="button button-secondary"
                      style={{
                        width: '100%',
                        padding: '8px',
                        fontSize: '12px',
                      }}
                    >
                      {copiedToClipboard ? '✓ Copied!' : 'Copy Activation Code'}
                    </button>
                  </div>

                  <div>
                    <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                      eSIM Identifier (for support):
                    </p>
                    <code
                      style={{
                        display: 'block',
                        padding: '8px',
                        background: 'white',
                        borderRadius: '4px',
                        fontSize: '11px',
                        wordBreak: 'break-all',
                        border: '1px solid #e0e0e0',
                        fontFamily: 'monospace',
                      }}
                    >
                      ICCID: {orderDetails.iccid}
                    </code>
                  </div>
                </div>
              )}
            </div>

            {/* Redemption Code Reference */}
            <div
              style={{
                padding: '12px',
                background: '#f5f5f5',
                borderRadius: '6px',
                textAlign: 'center',
                fontSize: '12px',
                color: '#888',
              }}
            >
              Reference: <code style={{ fontWeight: '600' }}>{params.code}</code>
            </div>

            {/* Support Message */}
            <p style={{ fontSize: '12px', color: '#999', marginTop: '20px', textAlign: 'center' }}>
              Need help?{' '}
              <a href="mailto:support@afritel.app" style={{ color: '#0070f3', textDecoration: 'none' }}>
                Contact support
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
