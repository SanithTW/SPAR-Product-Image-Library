import React from 'react';
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
  const category = getCategory(product.product_name);

  const handleDownload = (e) => {
    e.stopPropagation();
    onDownload(product);
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
      </div>
      <div className="card-body">
        <div className="dc-row">
          <span className="dc">DC {product.dc_code}</span>
          <span className="verified">✓ Verified</span>
        </div>
        <h3>{product.product_name}</h3>
        <button
          className="download-btn"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          <span>↓</span>
          <span>{isDownloading ? 'Downloading…' : 'Download original'}</span>
        </button>
      </div>
    </article>
  );
}
