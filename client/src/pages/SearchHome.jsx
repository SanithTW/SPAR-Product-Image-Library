import React, { useState, useEffect, useCallback } from 'react';
import { getProducts } from '../services/api';
import ProductCard from '../components/ProductCard';
import ImagePreviewModal from '../components/ImagePreviewModal';
import BulkDownloadModal from '../components/BulkDownloadModal';
import { downloadProductImage } from '../utils/downloadHelper';
import { useAuth } from '../context/AuthContext';

export default function SearchHome({ refreshTrigger }) {
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewProduct, setPreviewProduct] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { isAuthenticated, guestAccess, endGuestAccess, ensureDownloadAccess } = useAuth();

  const fetchProductsList = useCallback(async (q = '') => {
    try {
      setLoading(true);
      const data = await getProducts(q);
      setProducts(data.products || []);
    } catch (err) {
      console.error('[SearchHome] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProductsList(searchQuery);
  }, [searchQuery, refreshTrigger, fetchProductsList]);

  // Trigger search on button click or enter
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const handleDownload = async (product, options = { size: 1080, fit: 'contain' }) => {
    if (!(await ensureDownloadAccess())) return;
    try {
      setDownloadingId(product.id);
      await downloadProductImage(product, options);
    } catch (err) {
      if (err.accessRequired) {
        // The code expired or was removed since it was entered: ask again, then retry once.
        setDownloadingId(null);
        if (await ensureDownloadAccess('Your access code has expired or was removed. Enter a new code to continue.')) {
          setDownloadingId(product.id);
          await downloadProductImage(product, options).catch((e) => console.error('Download error:', e));
        }
      } else {
        console.error('Download error:', err);
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const accessUntil = guestAccess
    ? new Date(guestAccess.expiresAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-inner">
          <span className="eyebrow">
            <i></i> SPAR Product Image Library
          </span>
          <h1>Find the right product image. Fast.</h1>
          <p>Search by DC code or product name, preview, and download auto-formatted in 1080 × 1080 px.</p>
          
          <form onSubmit={handleSearchSubmit} className="search-shell">
            <input
              id="searchInput"
              type="search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                // Also live search as user types
                setSearchQuery(e.target.value.trim());
              }}
              placeholder="Search DC code or product name…  e.g. 1002 or rice"
            />
            <button id="searchBtn" type="submit">
              Search products
            </button>
          </form>

          <div className="hero-meta">
            <span><strong>{products.length}</strong> product assets</span>
            <span>•</span>
            <span>DC code + product name search</span>
            <span>•</span>
            <span>⚡ Standard 1080 × 1080 HQ Crop</span>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main>
        <div className="toolbar">
          <div>
            <h2 className="section-title">Product library</h2>
            <p className="section-sub" id="resultText">
              {searchQuery
                ? `Found ${products.length} matching product${products.length === 1 ? '' : 's'} for “${searchQuery}”`
                : 'Showing all sample products'}
            </p>
          </div>
          <div className="toolbar-actions">
            {!isAuthenticated && guestAccess && (
              <span className="access-status" title={`Access code for ${guestAccess.label}`}>
                🔓 Downloads unlocked until {accessUntil}
                <button type="button" onClick={endGuestAccess}>End</button>
              </span>
            )}
            <button type="button" className="bulk-download-btn" onClick={() => setBulkOpen(true)}>
              ⬇ Bulk download
            </button>
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid" id="grid">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onPreview={(p) => setPreviewProduct(p)}
              onDownload={handleDownload}
              isDownloading={downloadingId === product.id}
            />
          ))}
        </div>

        {/* Empty State */}
        {!loading && products.length === 0 && (
          <div className="empty" id="empty" style={{ display: 'block' }}>
            No products matched your search.
            <br />
            Try another DC code or product name.
          </div>
        )}
      </main>

      {/* Footer */}
      <footer>
        <span>SPAR Product Image Library · Official portal</span>
        <span>Light / Dark mode · Responsive desktop + mobile</span>
      </footer>

      {bulkOpen && <BulkDownloadModal onClose={() => setBulkOpen(false)} />}

      {/* Full Preview Modal */}
      {previewProduct && (
        <ImagePreviewModal
          product={previewProduct}
          onClose={() => setPreviewProduct(null)}
          onDownload={handleDownload}
          isDownloading={downloadingId === previewProduct.id}
        />
      )}
    </>
  );
}
