import React, { useEffect } from 'react';
import { getImageUrl } from '../services/api';

export default function ImagePreviewModal({ product, onClose, onDownload, isDownloading }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!product) return null;

  const fullImageUrl = getImageUrl(product.image_url);

  return (
    <div className="modal" onClick={onClose} style={{ display: 'flex' }}>
      <div
        className="modal-card"
        style={{ width: 'min(640px, 94%)', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" onClick={onClose} title="Close preview">×</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span className="dc" style={{ fontSize: '15px' }}>DC {product.dc_code}</span>
          <span className="verified">✓ Verified</span>
        </div>
        <h2>{product.product_name}</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: '13px' }}>
          {product.file_name ? `File: ${product.file_name}` : 'Original catalog photography'}
        </p>

        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '260px',
            maxHeight: '440px',
            marginBottom: '20px',
            overflow: 'hidden',
          }}
        >
          <img
            src={fullImageUrl}
            alt={product.product_name}
            style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href={fullImageUrl}
            target="_blank"
            rel="noreferrer"
            className="icon-btn"
            style={{ flex: 1, textAlign: 'center', textDecoration: 'none', display: 'grid', placeItems: 'center' }}
          >
            Open in new tab
          </a>
          <button
            className="login-submit"
            style={{ flex: 2, margin: 0 }}
            onClick={() => onDownload(product)}
            disabled={isDownloading}
          >
            <span>↓</span> {isDownloading ? 'Downloading…' : 'Download original image'}
          </button>
        </div>
      </div>
    </div>
  );
}
