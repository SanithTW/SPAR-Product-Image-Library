const fs = require('fs');
const path = require('path');
const { db, initDatabase } = require('./db');

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Generate realistic SPAR Product Card SVGs
function createProductSvg(title, category, weight, color1, color2, iconType) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F8FAFC" />
      <stop offset="100%" stop-color="#E2E8F0" />
    </linearGradient>
    <linearGradient id="packGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color1}" />
      <stop offset="100%" stop-color="${color2}" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#0f172a" flood-opacity="0.18" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="600" height="600" fill="url(#bgGrad)" />

  <!-- Backdrop subtle circle -->
  <circle cx="300" cy="300" r="230" fill="#FFFFFF" opacity="0.8" />

  <!-- Product Packaging Box / Container -->
  <g filter="url(#shadow)">
    <rect x="150" y="90" width="300" height="420" rx="24" fill="url(#packGrad)" />
    <!-- Pack Header Banner -->
    <rect x="150" y="90" width="300" height="90" rx="24" fill="#007A3D" />
    <rect x="150" y="150" width="300" height="30" fill="#007A3D" />

    <!-- SPAR Logo on Pack -->
    <circle cx="210" cy="135" r="24" fill="#FFFFFF" />
    <polygon points="210,117 198,136 205,136 195,150 225,150 215,136 222,136" fill="#007A3D" />
    <rect x="207" y="150" width="6" height="7" fill="#E31B23" />
    <text x="245" y="142" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="900" font-size="24" fill="#FFFFFF" letter-spacing="2">SPAR</text>

    <!-- Pack Label Content -->
    <rect x="175" y="200" width="250" height="230" rx="16" fill="#FFFFFF" opacity="0.95" />
    
    <!-- Category Badge -->
    <rect x="200" y="220" width="200" height="26" rx="13" fill="#E8F5E9" />
    <text x="300" y="238" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="700" font-size="11" fill="#007A3D" text-anchor="middle" letter-spacing="1">${category.toUpperCase()}</text>

    <!-- Product Title -->
    <text x="300" y="290" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="800" font-size="20" fill="#0F172A" text-anchor="middle">${title.split(' ')[0]} ${title.split(' ')[1] || ''}</text>
    <text x="300" y="320" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="600" font-size="16" fill="#475569" text-anchor="middle">${title.split(' ').slice(2).join(' ')}</text>

    <!-- Quality Guarantee Badge -->
    <circle cx="300" cy="375" r="25" fill="#FEF3C7" stroke="#F59E0B" stroke-width="2" />
    <text x="300" y="379" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="800" font-size="9" fill="#B45309" text-anchor="middle">100% PURE</text>

    <!-- Net Weight Banner -->
    <rect x="190" y="450" width="220" height="40" rx="10" fill="#0F172A" />
    <text x="300" y="475" font-family="'JetBrains Mono', monospace" font-weight="700" font-size="15" fill="#F8FAFC" text-anchor="middle">NET WT: ${weight}</text>
  </g>

  <!-- Verified Product Seal -->
  <g transform="translate(420, 80)">
    <circle cx="30" cy="30" r="28" fill="#E31B23" />
    <text x="30" y="34" font-family="'Plus Jakarta Sans', Arial, sans-serif" font-weight="800" font-size="9" fill="#FFFFFF" text-anchor="middle">OFFICIAL</text>
  </g>
</svg>`;
}

const sampleProducts = [
  {
    dc_code: '1001',
    product_name: 'SPAR Select Royal Basmati Rice',
    category: 'Staples & Grains',
    weight: '5 kg',
    color1: '#0284c7',
    color2: '#0369a1',
  },
  {
    dc_code: '1002',
    product_name: 'SPAR Classic Refined Sunflower Oil',
    category: 'Edible Oils',
    weight: '1 Litre',
    color1: '#f59e0b',
    color2: '#d97706',
  },
  {
    dc_code: '1003',
    product_name: 'SPAR Farm Fresh Pasteurized Milk',
    category: 'Dairy & Eggs',
    weight: '1 Litre',
    color1: '#3b82f6',
    color2: '#1d4ed8',
  },
  {
    dc_code: '1004',
    product_name: 'SPAR Gold Premium Assam CTC Tea',
    category: 'Beverages',
    weight: '500 g',
    color1: '#b45309',
    color2: '#78350f',
  },
  {
    dc_code: '1005',
    product_name: 'SPAR 100% Whole Wheat Chakki Atta',
    category: 'Flours & Atta',
    weight: '10 kg',
    color1: '#eab308',
    color2: '#ca8a04',
  },
  {
    dc_code: '1006',
    product_name: 'SPAR California Roasted Salted Almonds',
    category: 'Dry Fruits & Nuts',
    weight: '250 g',
    color1: '#854d0e',
    color2: '#713f12',
  },
  {
    dc_code: '1007',
    product_name: 'SPAR Danish Style Butter Cookies',
    category: 'Bakery & Biscuits',
    weight: '400 g',
    color1: '#059669',
    color2: '#047857',
  },
  {
    dc_code: '1008',
    product_name: 'SPAR Wild Mountain Organic Honey',
    category: 'Breakfast Spreads',
    weight: '500 g',
    color1: '#d97706',
    color2: '#92400e',
  },
];

async function seed() {
  await initDatabase();

  for (const item of sampleProducts) {
    const filename = `spar_${item.dc_code}_${Date.now()}.svg`;
    const filePath = path.join(uploadDir, filename);

    const svgContent = createProductSvg(
      item.product_name,
      item.category,
      item.weight,
      item.color1,
      item.color2
    );

    fs.writeFileSync(filePath, svgContent, 'utf-8');

    // Check if DC code already in DB
    const existing = await db.execute({
      sql: 'SELECT id FROM products WHERE dc_code = ? LIMIT 1',
      args: [item.dc_code],
    });

    if (existing.rows.length === 0) {
      await db.execute({
        sql: `
          INSERT INTO products (dc_code, product_name, image_url, public_id, file_name)
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [
          item.dc_code,
          item.product_name,
          `/uploads/${filename}`,
          `local:${filename}`,
          `${item.product_name.replace(/\s+/g, '_')}.svg`,
        ],
      });
      console.log(`[Seed] Added product: DC ${item.dc_code} - ${item.product_name}`);
    } else {
      console.log(`[Seed] Product with DC ${item.dc_code} already exists.`);
    }
  }

  console.log('[Seed] Seeding completed successfully.');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[Seed] Error seeding products:', err);
    process.exit(1);
  });
