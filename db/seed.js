/* ==========================================================================
   AL-THABIB — Seed script
   Populates the database with starter products and the default admin
   password (only if those tables are currently empty).
   Run with: node db/seed.js
   ========================================================================== */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

const DEFAULT_PRODUCTS = [
  { id:'eq-001', category:'equipment', name:'Digital Blood Pressure Monitor', desc:'Automatic upper-arm BP monitor with irregular heartbeat detection, clinic and home use.', price:6800, stock:42, unit:'unit', sku:'ATH-EQ-001' },
  { id:'eq-002', category:'equipment', name:'Oxygen Concentrator 5L', desc:'Continuous-flow oxygen concentrator, 5L/min, for wards and home oxygen therapy.', price:78500, stock:9, unit:'unit', sku:'ATH-EQ-002' },
  { id:'eq-003', category:'equipment', name:'Manual Hospital Bed (2-Crank)', desc:'Powder-coated steel frame, adjustable backrest and knee-rest, side rails included.', price:52000, stock:6, unit:'unit', sku:'ATH-EQ-003' },
  { id:'eq-004', category:'equipment', name:'Portable Ultrasound Scanner', desc:'Compact B/W ultrasound system with convex and linear probes, ideal for outreach clinics.', price:410000, stock:2, unit:'unit', sku:'ATH-EQ-004' },
  { id:'eq-005', category:'equipment', name:'Autoclave Sterilizer 18L', desc:'Class B benchtop steam sterilizer for instruments, digital cycle control.', price:96000, stock:5, unit:'unit', sku:'ATH-EQ-005' },
  { id:'eq-006', category:'equipment', name:'Patient Transfer Stretcher', desc:'Foldable emergency stretcher with adjustable height, aluminium frame.', price:34500, stock:0, unit:'unit', sku:'ATH-EQ-006' },
  { id:'eq-007', category:'equipment', name:'Digital Infant Weighing Scale', desc:'High-precision paediatric scale for MCH clinics, tray and readout in kg/lb.', price:12500, stock:18, unit:'unit', sku:'ATH-EQ-007' },
  { id:'eq-008', category:'equipment', name:'Examination LED Light', desc:'Mobile LED examination lamp, adjustable arm and colour temperature.', price:15800, stock:14, unit:'unit', sku:'ATH-EQ-008' },
  { id:'dr-001', category:'drugs', name:'Amoxicillin 500mg Capsules', desc:'Broad-spectrum antibiotic, box of 100 capsules, WHO-prequalified supplier.', price:850, stock:220, unit:'box of 100', sku:'ATH-DR-001' },
  { id:'dr-002', category:'drugs', name:'Paracetamol 500mg Tablets', desc:'Analgesic and antipyretic, box of 1000 tablets.', price:1200, stock:340, unit:'box of 1000', sku:'ATH-DR-002' },
  { id:'dr-003', category:'drugs', name:'Oral Rehydration Salts (ORS)', desc:'WHO-formula ORS sachets for rehydration therapy, carton of 100 sachets.', price:2600, stock:150, unit:'carton of 100', sku:'ATH-DR-003' },
  { id:'dr-004', category:'drugs', name:'Normal Saline IV Fluid 500ml', desc:'Sodium chloride 0.9% intravenous infusion, carton of 20 bottles.', price:3400, stock:95, unit:'carton of 20', sku:'ATH-DR-004' },
  { id:'dr-005', category:'drugs', name:'Artemether/Lumefantrine 20/120mg', desc:'Antimalarial combination therapy, box of 30 tablet packs.', price:4100, stock:60, unit:'box of 30', sku:'ATH-DR-005' },
  { id:'dr-006', category:'drugs', name:'Multivitamin Syrup 200ml', desc:'Paediatric multivitamin supplement syrup, carton of 24 bottles.', price:5200, stock:0, unit:'carton of 24', sku:'ATH-DR-006' },
  { id:'co-001', category:'consumables', name:'Disposable Nitrile Gloves (M)', desc:'Powder-free examination gloves, medium, box of 100.', price:950, stock:500, unit:'box of 100', sku:'ATH-CO-001' },
  { id:'co-002', category:'consumables', name:'Sterile Gauze Swabs 10x10cm', desc:'Absorbent cotton gauze swabs, pack of 100 pieces.', price:680, stock:410, unit:'pack of 100', sku:'ATH-CO-002' },
  { id:'co-003', category:'consumables', name:'Disposable Syringes 5ml', desc:'Single-use luer-slip syringes with needle, box of 100.', price:1450, stock:260, unit:'box of 100', sku:'ATH-CO-003' },
  { id:'co-004', category:'consumables', name:'IV Cannula 18G', desc:'Sterile intravenous catheter with injection port, box of 50.', price:2100, stock:130, unit:'box of 50', sku:'ATH-CO-004' },
  { id:'co-005', category:'consumables', name:'Surgical Face Masks (3-ply)', desc:'Fluid-resistant disposable face masks with ear loops, box of 50.', price:620, stock:8, unit:'box of 50', sku:'ATH-CO-005' },
  { id:'co-006', category:'consumables', name:'Alcohol Swabs 70%', desc:'Individually wrapped isopropyl alcohol prep pads, box of 200.', price:540, stock:300, unit:'box of 200', sku:'ATH-CO-006' }
];

const DEFAULT_ADMIN_PASSWORD = 'althabib2026';

async function seed(){
  const conn = await pool.getConnection();
  try{
    const [prodRows] = await conn.query('SELECT COUNT(*) AS c FROM products');
    if(prodRows[0].c === 0){
      for(const p of DEFAULT_PRODUCTS){
        await conn.query(
          `INSERT INTO products (id, name, category, sku, description, price, unit, stock, image_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.id, p.name, p.category, p.sku, p.desc, p.price, p.unit, p.stock, `${p.id}.jpg`]
        );
      }
      console.log(`Seeded ${DEFAULT_PRODUCTS.length} products with starter photography.`);
    } else {
      console.log('Products table already has data — skipping product seed.');
    }

    const [settingsRows] = await conn.query('SELECT COUNT(*) AS c FROM settings');
    if(settingsRows[0].c === 0){
      const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
      await conn.query('INSERT INTO settings (id, admin_password_hash) VALUES (1, ?)', [hash]);
      console.log(`Seeded default admin password: "${DEFAULT_ADMIN_PASSWORD}" (change this after first login).`);
    } else {
      console.log('Settings already exist — skipping password seed.');
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
