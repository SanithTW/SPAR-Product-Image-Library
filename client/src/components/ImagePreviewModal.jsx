import React, { useState, useEffect } from 'react';
import { getImageUrl } from '../services/api';

export default function ImagePreviewModal({ product, onClose, onDownload, isDownloading }) {
  // 'cover' (1080x1080 Square Crop) | 'contain' (1080x1080 Fit Full) | 'original' (Source ratio)
  const [previewMode, setPreviewMode] = useState('cover');

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
        style={{ width: 'min(680px, 95%)', maxHeight: '92vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" onClick={onClose} title="Close preview">×</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span className="dc" style={{ fontSize: '15px' }}>DC {product.dc_code}</span>
          <span className="verified">✓ Verified SPAR Asset</span>
          <span className="resolution-badge" style={{ position: 'static' }}>
            1080 × 1080 Standard
          </span>
        </div>

        <h2 style={{ margin: '0 0 4px', fontSize: '22px' }}>{product.product_name}</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: '13px' }}>
          {product.file_name ? `File: ${product.file_name}` : 'Master product catalog image'}
        </p>

        {/* Preview Mode Selector Tabs */}
        <div className="preview-mode-tabs">
          <button
            type="button"
            className={`preview-tab-btn ${previewMode === 'cover' ? 'active' : ''}`}
            onClick={() => setPreviewMode('cover')}
          >
            1080 × 1080 Square Crop
          </button>
          <button
            type="button"
            className={`preview-tab-btn ${previewMode === 'contain' ? 'active' : ''}`}
            onClick={() => setPreviewMode('contain')}
          >
            1080 × 1080 Fit Full
          </button>
          <button
            type="button"
            className={`preview-tab-btn ${previewMode === 'original' ? 'active' : ''}`}
            onClick={() => setPreviewMode('original')}
          >
            Original Aspect
          </button>
        </div>

        {/* Preview Frame */}
        <div className={`preview-box ${previewMode !== 'original' ? 'square-1080' : ''}`}>
          <img
            src={fullImageUrl}
            alt={product.product_name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: previewMode === 'cover' ? 'cover' : 'contain',
              borderRadius: '12px',
              transition: 'object-fit .2s ease',
            }}
          />
          {previewMode === 'cover' && (
            <div className="preview-crop-guides" title="1080x1080 Center-Crop Framing" />
          )}
        </div>

        {/* Spec Information Strip */}
        <div className="preview-spec-tag">
          {previewMode === 'cover' && (
            <span>📐 <strong>1080 × 1080 px</strong> • Center Square Crop • Auto-cropped nicely for social & catalog</span>
          )}
          {previewMode === 'contain' && (
            <span>📐 <strong>1080 × 1080 px</strong> • Fit Full Product • Clean white background margins</span>
          )}
          {previewMode === 'original' && (
            <span>📁 <strong>Original Resolution</strong> • Unaltered master file as uploaded by admin</span>
          )}
        </div>

        {/* Download Action Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="login-submit"
              style={{
                flex: '2 1 240px',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 800,
              }}
              onClick={() => onDownload(product, { size: 1080, fit: 'cover' })}
              disabled={isDownloading}
            >
              <span>↓</span>
              <span>{isDownloading ? 'Processing…' : 'Download 1080 × 1080 (Square Crop)'}</span>
            </button>

            <button
              className="icon-btn"
              style={{
                flex: '1 1 180px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '13px',
              }}
              onClick={() => onDownload(product, { size: 1080, fit: 'contain' })}
              disabled={isDownloading}
              title="Download 1080x1080 fitting whole product with white margins"
            >
              <span>↓</span>
              <span>1080 × 1080 (Fit Full)</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
            <button
              type="button"
              onClick={() => onDownload(product, { size: 'original' })}
              disabled={isDownloading}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '4px 0',
              }}
            >
              Download original uncropped file
            </button>

            <a
              href={fullImageUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                color: 'var(--muted)',
                fontSize: '13px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Open raw image ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
