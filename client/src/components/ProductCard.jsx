import React, { useState, useRef, useEffect } from 'react';
import { getImageUrl } from '../services/api';

// Helper to determine a display category tag based on title
function getCategory(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('rice') || n.includes('atta') || n.includes('flour') || n.includes('grain')) return 'STAPLES';
  if (n.includes('oil') || n.includes('ghee')) return 'GROCERY';
  if (n.includes('milk') || n.includes('butter') || n.includes('cheese') || n.includes('dairy')) return 'DAIRY';
  if (n.includes('tea') || n.includes('coffee') || n.includes('water') || n.includes('juice')) return 'BEVERAGES';
  if (n.includes('biscuit') || n.includes('cookie') || n.includes('almond') || n.includes('snack')) return 'SNACKS';
  if (n.includes('flake') || n.includes('cereal') || n.includes('honey')) return 'BREAKFAST';
  return 'PRODUCT ASSET';
}

export default function ProductCard({ product, onPreview, onDownload, isDownloading }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const category = getCategory(product.product_name);

  // Close dropdown menu if user clicks outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Default: download 1080x1080 center crop
  const handlePrimaryDownload = (e) => {
    e.stopPropagation();
    onDownload(product, { size: 1080, fit: 'cover' });
  };

  const handleSelectOption = (e, options) => {
    e.stopPropagation();
    setMenuOpen(false);
    onDownload(product, options);
  };

  return (
    <article
      className="product-card"
      onClick={() => onPreview && onPreview(product)}
      title="Click to view full preview"
    >
      <div className="product-image-wrap">
        <img
          src={getImageUrl(product.image_url)}
          alt={product.product_name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2300a651" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
          }}
        />
        <span className="category">{category}</span>
        <span className="resolution-badge" title="Auto-processed to 1080x1080 standard">
          1080 × 1080
        </span>
      </div>

      <div className="card-body">
        <div className="dc-row">
          <span className="dc">DC {product.dc_code}</span>
          <span className="verified">✓ Verified</span>
        </div>
        <h3>{product.product_name}</h3>

        <div className="download-group" ref={menuRef}>
          <button
            className="download-btn-main"
            onClick={handlePrimaryDownload}
            disabled={isDownloading}
            title="Download in 1080 × 1080 pixels (Smart Crop)"
          >
            <span>↓</span>
            <span>{isDownloading ? 'Downloading…' : 'Download 1080 × 1080'}</span>
          </button>

          <button
            type="button"
            className="download-btn-caret"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            disabled={isDownloading}
            title="Choose download format"
            aria-label="Download options"
          >
            <span style={{ fontSize: '11px', transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
              ▼
            </span>
          </button>

          {menuOpen && (
            <div className="download-menu" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="download-menu-item"
                onClick={(e) => handleSelectOption(e, { size: 1080, fit: 'cover' })}
              >
                <div className="item-title">
                  <span>1080 × 1080 (Square Crop)</span>
                  <span style={{ fontSize: '10px', background: 'var(--green)', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>
                    HQ
                  </span>
                </div>
                <span className="item-sub">Cropped nicely to square (Default)</span>
              </button>

              <button
                type="button"
                className="download-menu-item"
                onClick={(e) => handleSelectOption(e, { size: 1080, fit: 'contain' })}
              >
                <div className="item-title">
                  <span>1080 × 1080 (Fit Full)</span>
                </div>
                <span className="item-sub">Full image on clean white margin</span>
              </button>

              <button
                type="button"
                className="download-menu-item"
                onClick={(e) => handleSelectOption(e, { size: 'original' })}
              >
                <div className="item-title">
                  <span>Original Image</span>
                </div>
                <span className="item-sub">Uncropped original source asset</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
