'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface RedemptionData {
  code: string;
  status: string;
  product_name: string;
  product_details?: {
    name: string;
    destination?: string;
    dataAmount?: string;
    validity?: string;
    description?: string;
  };
}

export default function RedemptionPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const [redemption, setRedemption] = useState<RedemptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchRedemptionData();
  }, []);

  async function fetchRedemptionData() {
    try {
      const response = await fetch(`/api/public/redemption/${params.code}`);
      if (response.ok) {
        const data = await response.json();
        setRedemption(data);
      } else if (response.status === 404) {
        setError('Redemption code not found or already used.');
      } else {
        setError('Failed to load redemption details.');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '80px', textAlign: 'center' }}>
        <span className="loading"></span>
        <p style={{ marginTop: '10px' }}>Loading redemption details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div
          style={{
            background: '#ffebee',
            color: '#c62828',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <h2>Oops!</h2>
          <p>{error}</p>
          <p style={{ fontSize: '12px', marginTop: '10px', color: '#999' }}>
            If you believe this is a mistake, please contact support.
          </p>
        </div>
      </div>
    );
  }

  if (!redemption) {
    return null;
  }

  const details = redemption.product_details || {
    name: redemption.product_name,
  };

  return (
    <div className="container" style={{ maxWidth: '600px', paddingTop: '40px', paddingBottom: '40px' }}>
      <div style={{ background: 'white', padding: '30px', borderRadius: '8px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '30px' }}>Claim Your eSIM</h1>

        {/* Plan Details */}
        <div
          style={{
            background: '#f9f9f9',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '30px',
            borderLeft: '4px solid #0070f3',
          }}
        >
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>{details.name}</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {details.destination && (
              <div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                  DESTINATION
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{details.destination}</div>
              </div>
            )}

            {details.dataAmount && (
              <div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                  DATA AMOUNT
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{details.dataAmount}</div>
              </div>
            )}

            {details.validity && (
              <div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                  VALIDITY
                </div>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{details.validity}</div>
              </div>
            )}
          </div>

          {details.description && (
            <p style={{ fontSize: '14px', color: '#666', marginTop: '16px' }}>
              {details.description}
            </p>
          )}
        </div>

        {/* Call to Action or Form */}
        {!showForm ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '16px', marginBottom: '20px', color: '#666' }}>
              To activate your eSIM, we need some basic information.
            </p>
            <button
              className="button button-primary"
              onClick={() => setShowForm(true)}
              style={{ padding: '12px 30px', fontSize: '16px' }}
            >
              Continue →
            </button>
          </div>
        ) : (
          <KYCForm
            code={params.code}
            onSuccess={() => router.push(`/r/${params.code}/success`)}
            onBack={() => setShowForm(false)}
          />
        )}
      </div>
    </div>
  );
}

interface KYCFormProps {
  code: string;
  onSuccess: () => void;
  onBack: () => void;
}

function KYCForm({ code, onSuccess, onBack }: KYCFormProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    countryCode: 'FR',
    consentGiven: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!/^\+?[0-9\s-()]{7,}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.consentGiven) {
      newErrors.consentGiven = 'You must agree to the terms to continue';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch('/api/public/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          ...formData,
          userAgent: navigator.userAgent,
          ipAddress: '', // Will be captured server-side
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setSubmitError(data.error || 'Failed to submit. Please try again.');
      }
    } catch (error) {
      setSubmitError('An error occurred. Please try again.');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="fullName">Full Name *</label>
        <input
          id="fullName"
          type="text"
          placeholder="John Doe"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
        />
        {errors.fullName && <div className="error">{errors.fullName}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="phoneNumber">Phone Number *</label>
        <input
          id="phoneNumber"
          type="tel"
          placeholder="+33612345678 or 06 12 34 56 78"
          value={formData.phoneNumber}
          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
        />
        {errors.phoneNumber && <div className="error">{errors.phoneNumber}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="email">Email (Optional)</label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        {errors.email && <div className="error">{errors.email}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="countryCode">Country/Region</label>
        <select
          id="countryCode"
          value={formData.countryCode}
          onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
        >
          <option value="FR">France</option>
          <option value="DE">Germany</option>
          <option value="IT">Italy</option>
          <option value="ES">Spain</option>
          <option value="GB">United Kingdom</option>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
          <option value="AU">Australia</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          id="consent"
          type="checkbox"
          checked={formData.consentGiven}
          onChange={(e) => setFormData({ ...formData, consentGiven: e.target.checked })}
          style={{ width: 'auto', margin: 0 }}
        />
        <label htmlFor="consent" style={{ margin: 0, fontWeight: '400' }}>
          I agree to the terms of service and data usage policy *
        </label>
      </div>
      {errors.consentGiven && <div className="error">{errors.consentGiven}</div>}

      {/* ID Field Placeholder (for future Phase 2.5) */}
      <div style={{ fontSize: '12px', color: '#999', marginTop: '16px', padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
        💡 ID verification may be required in a future update. Check back soon.
      </div>

      {submitError && (
        <div className="error" style={{ marginTop: '16px', padding: '12px', background: '#ffebee', borderRadius: '4px' }}>
          {submitError}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
        <button
          type="button"
          className="button button-secondary"
          onClick={onBack}
          disabled={submitting}
          style={{ flex: 1 }}
        >
          ← Back
        </button>
        <button
          type="submit"
          className="button button-primary"
          disabled={submitting}
          style={{ flex: 1 }}
        >
          {submitting ? '⏳ Processing...' : 'Claim eSIM →'}
        </button>
      </div>
    </form>
  );
}
