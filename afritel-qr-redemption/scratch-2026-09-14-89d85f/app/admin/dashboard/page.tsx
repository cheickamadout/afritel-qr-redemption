'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Reseller {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  status: string;
  created_at: string;
}

interface Batch {
  id: number;
  reseller_id: number;
  mobimatter_product_id: string;
  product_name: string;
  quantity_requested: number;
  quantity_generated: number;
  quantity_redeemed: number;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const [view, setView] = useState<'resellers' | 'batches'>('resellers');
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateReseller, setShowCreateReseller] = useState(false);
  const [showCreateBatch, setShowCreateBatch] = useState(false);

  useEffect(() => {
    fetchResellers();
  }, []);

  useEffect(() => {
    if (selectedReseller) {
      fetchBatches(selectedReseller.id);
    }
  }, [selectedReseller]);

  async function fetchResellers() {
    try {
      const response = await fetch('/api/admin/resellers');
      if (response.ok) {
        const data = await response.json();
        setResellers(data);
        if (data.length > 0 && !selectedReseller) {
          setSelectedReseller(data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching resellers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBatches(resellerId: number) {
    try {
      const response = await fetch(`/api/admin/batches?resellerId=${resellerId}`);
      if (response.ok) {
        const data = await response.json();
        setBatches(data);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>AFRITEL QR Redemption Dashboard</h1>
        <div style={{ fontSize: '12px', color: '#666' }}>No authentication required</div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', borderBottom: '2px solid #e0e0e0', paddingBottom: '16px' }}>
        <button
          onClick={() => setView('resellers')}
          style={{
            padding: '10px 16px',
            background: view === 'resellers' ? '#0070f3' : 'transparent',
            color: view === 'resellers' ? 'white' : '#666',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          📦 Resellers
        </button>
        <button
          onClick={() => setView('batches')}
          style={{
            padding: '10px 16px',
            background: view === 'batches' ? '#0070f3' : 'transparent',
            color: view === 'batches' ? 'white' : '#666',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          🎟️ Batches
        </button>
        <Link href="/admin/analytics">
          <button
            style={{
              padding: '10px 16px',
              background: 'transparent',
              color: '#666',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            📊 Analytics
          </button>
        </Link>
      </div>

      {/* Resellers View */}
      {view === 'resellers' && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <button className="button button-primary" onClick={() => setShowCreateReseller(true)}>
              + Create New Reseller
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <span className="loading"></span>
            </div>
          ) : resellers.length === 0 ? (
            <div style={{ background: 'white', padding: '40px', borderRadius: '8px', textAlign: 'center' }}>
              <p>No resellers yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="batch-list">
              {resellers.map((reseller) => (
                <div key={reseller.id} className="batch-card" onClick={() => setSelectedReseller(reseller)}>
                  <h3>{reseller.name}</h3>
                  {reseller.email && (
                    <div className="batch-card-stat">
                      <span>Email:</span>
                      <span>{reseller.email}</span>
                    </div>
                  )}
                  {reseller.phone && (
                    <div className="batch-card-stat">
                      <span>Phone:</span>
                      <span>{reseller.phone}</span>
                    </div>
                  )}
                  {reseller.city && (
                    <div className="batch-card-stat">
                      <span>Location:</span>
                      <span>{reseller.city}, {reseller.country}</span>
                    </div>
                  )}
                  <div className="batch-card-stat">
                    <span>Status:</span>
                    <span className="status-badge status-ready">{reseller.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showCreateReseller && (
            <CreateResellModal
              onClose={() => setShowCreateReseller(false)}
              onSuccess={() => {
                setShowCreateReseller(false);
                fetchResellers();
              }}
            />
          )}
        </>
      )}

      {/* Batches View */}
      {view === 'batches' && (
        <>
          {selectedReseller && (
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#888' }}>SELECTED RESELLER</div>
                <div style={{ fontSize: '18px', fontWeight: '600' }}>{selectedReseller.name}</div>
              </div>
              <button className="button button-primary" onClick={() => setShowCreateBatch(true)}>
                + Create Batch for {selectedReseller.name}
              </button>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <span className="loading"></span>
            </div>
          ) : batches.length === 0 ? (
            <div style={{ background: 'white', padding: '40px', borderRadius: '8px', textAlign: 'center' }}>
              <p>No batches for this reseller yet.</p>
            </div>
          ) : (
            <div className="batch-list">
              {batches.map((batch) => (
                <Link key={batch.id} href={`/admin/batch/${batch.id}`} style={{ textDecoration: 'none' }}>
                  <div className="batch-card">
                    <h3>{batch.product_name}</h3>
                    <div className="batch-card-stat">
                      <span>Product ID:</span>
                      <span>{batch.mobimatter_product_id}</span>
                    </div>
                    <div className="batch-card-stat">
                      <span>Total Codes:</span>
                      <span>{batch.quantity_generated}</span>
                    </div>
                    <div className="batch-card-stat">
                      <span>Redeemed:</span>
                      <span>{batch.quantity_redeemed}</span>
                    </div>
                    <div className="batch-card-stat">
                      <span>Status:</span>
                      <span className={`status-badge status-${batch.status.replace(/_/g, '-')}`}>
                        {batch.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {selectedReseller && showCreateBatch && (
            <CreateBatchModal
              reseller={selectedReseller}
              onClose={() => setShowCreateBatch(false)}
              onSuccess={() => {
                setShowCreateBatch(false);
                fetchBatches(selectedReseller.id);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function CreateResellModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    contactPerson: '',
    city: '',
    country: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/resellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create reseller');
      }
    } catch (error) {
      setError('Error creating reseller');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div className="modal-header">Create New Reseller</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Reseller Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Phone</label>
            <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Contact Person</label>
            <input type="text" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} />
          </div>

          <div className="form-group">
            <label>City</label>
            <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Country</label>
            <input type="text" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              style={{ minHeight: '80px' }}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="button button-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={submitting}>
              {submitting ? '⏳ Creating...' : 'Create Reseller'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateBatchModal({
  reseller,
  onClose,
  onSuccess,
}: {
  reseller: Reseller;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const response = await fetch('/api/admin/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!selectedProduct || !quantity) {
      setError('Please select a product and enter quantity');
      return;
    }

    const product = products.find((p) => p.productId === selectedProduct);
    if (!product) {
      setError('Invalid product selected');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/admin/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resellerId: reseller.id,
          productId: product.productId,
          productName: product.name,
          quantity: parseInt(quantity),
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create batch');
      }
    } catch (error) {
      setError('Error creating batch');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="modal">
      <div className="modal-content">
        <div className="modal-header">Create Batch for {reseller.name}</div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <span className="loading"></span>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>Select Product</label>
              <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
                <option value="">-- Choose a product --</option>
                {products.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.name} ({p.productId})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Number of Codes (max 5000)</label>
              <input type="number" min="1" max="5000" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>

            {error && <div className="error">{error}</div>}

            <div className="modal-footer">
              <button className="button button-secondary" onClick={onClose} disabled={creating}>
                Cancel
              </button>
              <button className="button button-primary" onClick={handleCreate} disabled={creating}>
                {creating ? '⏳ Creating...' : 'Create Batch'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
