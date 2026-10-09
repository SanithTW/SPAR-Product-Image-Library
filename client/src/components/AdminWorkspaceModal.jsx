import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProducts, uploadProduct, updateProduct, deleteProduct, checkHealth, getImageUrl } from '../services/api';

export default function AdminWorkspaceModal({ isOpen, onClose, onProductChange }) {
  const { isAuthenticated, login, logout } = useAuth();

  // Login form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Dashboard state
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminFilter, setAdminFilter] = useState('');
  const [healthInfo, setHealthInfo] = useState(null);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Upload state
  const [dcCode, setDcCode] = useState('');
  const [productName, setProductName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editDcCode, setEditDcCode] = useState('');
  const [editProductName, setEditProductName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadData();
    }
  }, [isOpen, isAuthenticated]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pRes, hRes] = await Promise.all([
        getProducts(),
        checkHealth().catch(() => null),
      ]);
      setProducts(pRes.products || []);
      if (hRes) setHealthInfo(hRes);
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to load products list.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoginLoading(true);
      setLoginError('');
      await login(username.trim(), password);
      await loadData();
      if (onProductChange) onProductChange();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error
        || (err.response?.status ? `Server error (${err.response.status}). Please check backend status.` : 'Cannot reach backend server. Please verify VITE_API_URL.');
      setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5 MB limit.');
      return;
    }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Only JPG, PNG and WEBP image files are allowed.');
      return;
    }
    setSelectedFile(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!dcCode.trim() || !productName.trim() || !selectedFile) {
      alert('Please provide DC code, product name, and an image file.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('dc_code', dcCode.trim());
      formData.append('product_name', productName.trim());
      formData.append('image', selectedFile);

      await uploadProduct(formData);
      setMessage(`Successfully uploaded ${productName}!`);
      setTimeout(() => setMessage(''), 3000);
      setDcCode('');
      setProductName('');
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadData();
      if (onProductChange) onProductChange();
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await deleteProduct(id);
      await loadData();
      if (onProductChange) onProductChange();
    } catch (err) {
      alert('Delete failed.');
    }
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditDcCode(p.dc_code);
    setEditProductName(p.product_name);
  };

  const saveEdit = async (id) => {
    try {
      setSavingEdit(true);
      const formData = new FormData();
      formData.append('dc_code', editDcCode.trim());
      formData.append('product_name', editProductName.trim());
      await updateProduct(id, formData);
      setEditingId(null);
      await loadData();
      if (onProductChange) onProductChange();
    } catch (err) {
      alert('Update failed.');
    } finally {
      setSavingEdit(false);
    }
  };

  if (!isOpen) return null;

  const filtered = products.filter((p) => {
    const q = adminFilter.toLowerCase();
    return p.dc_code.toLowerCase().includes(q) || p.product_name.toLowerCase().includes(q);
  });

  return (
    <div className="modal" onClick={onClose} style={{ display: 'flex' }}>
      {!isAuthenticated ? (
        /* Admin Login Card */
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <button className="close" onClick={onClose} title="Close">×</button>
          <div className="eyebrow admin-eyebrow" style={{ marginBottom: '14px' }}>
            <i></i> Admin access
          </div>
          <h2>SPAR Admin Portal</h2>
          <p>Please log in to manage, upload, and edit product imagery.</p>

          {loginError && (
            <div style={{ color: '#d32f2f', fontSize: '13px', marginBottom: '14px', fontWeight: 600 }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit}>
            <div className="field">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="admin123"
                required
              />
            </div>
            <button type="submit" className="login-submit" disabled={loginLoading}>
              {loginLoading ? 'Authenticating…' : 'Sign in to workspace →'}
            </button>
          </form>

          <p style={{ marginTop: '16px', marginBottom: 0, fontSize: '12px', color: 'var(--muted)' }}>
            Default credentials: <strong>admin</strong> / <strong>admin123</strong>
          </p>
        </div>
      ) : (
        /* Admin Dashboard Workspace */
        <div className="admin-dashboard" onClick={(e) => e.stopPropagation()}>
          <div className="admin-head">
            <div>
              <div className="eyebrow admin-eyebrow"><i></i> Admin workspace</div>
              <h2>SPAR Product Manager</h2>
              <p>Upload, manage and maintain the product image library.</p>
            </div>
            <button className="close" id="closeBtn" onClick={onClose} title="Close">×</button>
          </div>

          {message && (
            <div style={{ background: '#e9f8ef', color: '#16804b', padding: '12px 16px', borderRadius: '12px', marginTop: '16px', fontWeight: 'bold', fontSize: '13px' }}>
              ✓ {message}
            </div>
          )}

          <div className="admin-stats">
            <div>
              <span>Total images</span>
              <strong>{products.length}</strong>
            </div>
            <div>
              <span>Products indexed</span>
              <strong>{products.length}</strong>
            </div>
            <div>
              <span>Storage status</span>
              <strong className="ok">{healthInfo?.storage || 'Healthy'}</strong>
            </div>
          </div>

          {/* Upload Panel */}
          <div className="upload-panel">
            <div>
              <h3>Upload product image</h3>
              <p>Add an image and tag it with its DC code and product name.</p>
            </div>

            <form onSubmit={handleUploadSubmit} className="upload-grid">
              <div
                className={`dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: 'pointer', position: 'relative' }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                  accept=".jpg,.jpeg,.png,.webp"
                  style={{ display: 'none' }}
                />

                {previewUrl ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
                    <img
                      src={previewUrl}
                      alt="Preview"
                      style={{
                        maxWidth: '130px',
                        maxHeight: '90px',
                        objectFit: 'contain',
                        borderRadius: '10px',
                        border: '2px solid var(--green)',
                        background: '#fff',
                        padding: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                      }}
                    />
                    <strong style={{ fontSize: '13px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedFile?.name}
                    </strong>
                    <small style={{ color: 'var(--green)', fontWeight: 'bold' }}>
                      ✓ {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Click or drag to replace
                    </small>
                  </div>
                ) : (
                  <>
                    <span className="upload-icon">{isDragging ? '📥' : '↑'}</span>
                    <strong>{isDragging ? 'Drop product image here' : 'Choose product image'}</strong>
                    <small>Drag & drop or click to browse · JPG, PNG, WEBP (Max 5 MB)</small>
                  </>
                )}
              </div>

              <div className="admin-fields">
                <div className="field">
                  <label>DC Code</label>
                  <input
                    type="text"
                    value={dcCode}
                    onChange={(e) => setDcCode(e.target.value)}
                    placeholder="e.g. 1007"
                    required
                  />
                </div>
                <div className="field">
                  <label>Product name</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Premium Basmati Rice 5kg"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="login-submit"
                  disabled={uploading || !selectedFile}
                >
                  {uploading ? 'Uploading…' : 'Upload product'}
                </button>
              </div>
            </form>
          </div>

          {/* Manage Products Table */}
          <div className="manage-head">
            <div>
              <h3>Product images</h3>
              <p>Manage existing library entries.</p>
            </div>
            <input
              id="adminFilter"
              className="admin-filter"
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value)}
              placeholder="Filter products…"
            />
          </div>

          <div className="admin-table">
            <div className="table-row table-header">
              <span>Preview</span>
              <span>DC Code</span>
              <span>Product</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                Loading product catalog…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                {adminFilter ? `No products match "${adminFilter}"` : 'No product images uploaded yet.'}
              </div>
            ) : (
              filtered.map((p) => {
                const initial = (p.product_name || 'P').charAt(0).toUpperCase();
                const isEditing = editingId === p.id;

                return (
                  <div key={p.id} className="table-row">
                    <span className="mini-img">
                      {p.image_url ? (
                        <img
                          src={getImageUrl(p.image_url)}
                          alt={p.product_name || ''}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.parentElement) {
                              e.currentTarget.parentElement.textContent = initial;
                            }
                          }}
                        />
                      ) : (
                        initial
                      )}
                    </span>

                    {isEditing ? (
                      <input
                        style={{ padding: '4px 6px', fontSize: '13px', width: '80px', borderRadius: '6px', border: '1px solid var(--line)' }}
                        value={editDcCode}
                        onChange={(e) => setEditDcCode(e.target.value)}
                      />
                    ) : (
                      <strong>{p.dc_code}</strong>
                    )}

                    {isEditing ? (
                      <input
                        style={{ padding: '4px 6px', fontSize: '13px', width: '100%', borderRadius: '6px', border: '1px solid var(--line)' }}
                        value={editProductName}
                        onChange={(e) => setEditProductName(e.target.value)}
                      />
                    ) : (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.product_name}>
                        {p.product_name}
                      </span>
                    )}

                    <span className="status">Active</span>

                    <span>
                      {isEditing ? (
                        <>
                          <button
                            className="table-btn"
                            onClick={() => saveEdit(p.id)}
                            disabled={savingEdit}
                            style={{ color: 'var(--green)' }}
                          >
                            Save
                          </button>
                          <button className="table-btn" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="table-btn" onClick={() => startEdit(p)}>
                            Edit
                          </button>
                          <button
                            className="table-btn danger"
                            onClick={() => handleDelete(p.id, p.product_name)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="admin-footer">
            <span>
              Signed in as <strong>Admin</strong>
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="logout-btn"
                onClick={logout}
                style={{ color: '#d32f2f' }}
              >
                Sign out
              </button>
              <button className="logout-btn" onClick={onClose}>
                Close workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
