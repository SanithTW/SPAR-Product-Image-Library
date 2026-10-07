# SPAR Product Image Library

A fast, searchable product image repository built for SPAR staff to find, preview, and download official product imagery by **DC code** or **product name** in one click.

---

## 🌟 Key Features

- **Instant Search:** Search in real-time by DC code (e.g. `1002`) or product name (e.g. `rice`, `oil`). Supports partial matches and instant debounce.
- **1-Click Image Downloads:** Saves authentic, high-resolution product imagery directly to the user's device with structured filenames (`SPAR_<DC>_<ProductName>.<ext>`).
- **Interactive Image Preview:** Modal viewer for full-screen inspection, 1-click DC code copying to clipboard, and metadata display.
- **Light & Dark Theme:** Responsive theme toggle (Sun/Moon) that respects the system preferences and remembers user preference across visits in `localStorage`.
- **Admin Portal & Security:**
  - Secure JWT authentication with bcrypt password hashing.
  - Upload interface supporting JPG, PNG, WEBP (up to 5 MB per asset).
  - Drag-and-drop file upload with live client-side preview.
  - Complete catalog management table with Edit and Delete capabilities.
- **Hybrid Storage & Database Architecture:**
  - **Database:** Works with local SQLite (`spar_images.db`) out-of-the-box, or connects seamlessly to [Turso](https://turso.tech) cloud via `@libsql/client`.
  - **Image Storage:** Stores images in local `server/uploads/` out-of-the-box, or connects directly to [Cloudinary](https://cloudinary.com) once keys are set in `.env`.

---

## 🚀 Quick Start Guide

### 1. Start Both Backend & Frontend Together
From the root directory:
```bash
npm run dev
```
- **Frontend URL:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:5005](http://localhost:5005)

### 2. Default Administrator Credentials
- **Username:** `admin`
- **Password:** `admin123`
- **Login URL:** [http://localhost:5173/admin/login](http://localhost:5173/admin/login)

---

## 📡 API Endpoints Reference

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Database connection and server health check |
| `GET` | `/api/products?q=` | Public | Search products by DC code or product name |
| `GET` | `/api/products/:id` | Public | Fetch single product record |
| `GET` | `/api/products/:id/download`| Public | Stream & force download image file |
| `POST` | `/api/auth/login` | Public | Authenticate admin, returns 24h JWT token |
| `GET` | `/api/auth/me` | Admin Token | Verify current admin session token |
| `POST` | `/api/products` | Admin Token | Upload product image with DC code & name |
| `PUT` | `/api/products/:id` | Admin Token | Edit DC code, name, or replace image |
| `DELETE`| `/api/products/:id` | Admin Token | Remove product and associated image asset |

---

## ⚙️ Environment Configuration (`server/.env`)

```env
# Database (Turso or local file)
TURSO_DATABASE_URL=file:spar_images.db
TURSO_AUTH_TOKEN=

# Cloudinary (Leave blank for local disk storage in server/uploads/)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Server Port & JWT Secret
PORT=5005
JWT_SECRET=spar_product_library_secure_jwt_secret_key_2026_xyz

# Default Admin Account
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

---

## 📦 Project Structure

```text
SPAR Product Image Library/
├── package.json               # Root scripts (npm run dev)
├── README.md                  # Comprehensive setup & project documentation
├── client/                    # Vite + React + Tailwind CSS frontend
│   ├── index.html             # HTML entry point with SPAR branding & fonts
│   ├── vite.config.js         # Vite config with API proxy
│   ├── src/
│   │   ├── components/        # Header, ProductCard, ImagePreviewModal, ProtectedRoute
│   │   ├── context/           # ThemeContext, AuthContext
│   │   ├── pages/             # SearchHome, AdminLogin, AdminDashboard
│   │   ├── services/          # api.js (Axios API client)
│   │   └── utils/             # downloadHelper.js
├── server/                    # Express + LibSQL backend
│   ├── index.js               # Server bootstrap & static file server
│   ├── db.js                  # LibSQL connection (Turso & SQLite)
│   ├── createAdmin.js         # Admin user generator & password updater
│   ├── seedProducts.js        # Catalog seeder with sample SPAR products
│   ├── middleware/            # JWT auth middleware
│   ├── routes/                # auth.js, products.js
│   └── services/              # storage.js (Cloudinary + local disk fallback)
```
