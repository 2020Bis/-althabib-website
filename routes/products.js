const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'products');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(12).toString('hex') + ext;
    cb(null, name);
  }
});
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if(ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed.'));
  }
});

function genId(){
  return 'P-' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

function rowToProduct(row){
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    sku: row.sku,
    desc: row.description,
    price: Number(row.price),
    unit: row.unit,
    stock: row.stock,
    imageUrl: row.image_url ? `/uploads/products/${row.image_url}` : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// GET /api/products — public
router.get('/', async (req, res) => {
  try{
    const [rows] = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(rows.map(rowToProduct));
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Could not load products.' });
  }
});

// POST /api/products — admin only, multipart/form-data with optional "image" file
router.post('/', requireAdmin, upload.single('image'), async (req, res) => {
  try{
    const { name, category, sku, desc, price, unit, stock } = req.body;
    if(!name || !category || !desc || price === undefined || !unit || stock === undefined){
      return res.status(400).json({ error: 'Missing required product fields.' });
    }
    const id = genId();
    const imageFilename = req.file ? req.file.filename : null;
    await pool.query(
      `INSERT INTO products (id, name, category, sku, description, price, unit, stock, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, category, sku || null, desc, Number(price), unit, Number(stock), imageFilename]
    );
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    res.status(201).json(rowToProduct(rows[0]));
  } catch(err){
    console.error(err);
    res.status(500).json({ error: err.message || 'Could not create product.' });
  }
});

// PUT /api/products/:id — admin only, multipart/form-data, image optional (keeps old image if omitted)
router.put('/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try{
    const { id } = req.params;
    const [existingRows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    if(existingRows.length === 0) return res.status(404).json({ error: 'Product not found.' });
    const existing = existingRows[0];

    const { name, category, sku, desc, price, unit, stock, removeImage } = req.body;
    let imageFilename = existing.image_url;

    if(req.file){
      // replace: delete old file if present
      if(existing.image_url){
        const oldPath = path.join(UPLOAD_DIR, existing.image_url);
        fs.unlink(oldPath, () => {});
      }
      imageFilename = req.file.filename;
    } else if(removeImage === 'true'){
      if(existing.image_url){
        const oldPath = path.join(UPLOAD_DIR, existing.image_url);
        fs.unlink(oldPath, () => {});
      }
      imageFilename = null;
    }

    await pool.query(
      `UPDATE products SET name=?, category=?, sku=?, description=?, price=?, unit=?, stock=?, image_url=?
       WHERE id=?`,
      [
        name ?? existing.name,
        category ?? existing.category,
        sku ?? existing.sku,
        desc ?? existing.description,
        price !== undefined ? Number(price) : existing.price,
        unit ?? existing.unit,
        stock !== undefined ? Number(stock) : existing.stock,
        imageFilename,
        id
      ]
    );
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    res.json(rowToProduct(rows[0]));
  } catch(err){
    console.error(err);
    res.status(500).json({ error: err.message || 'Could not update product.' });
  }
});

// DELETE /api/products/:id — admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try{
    const { id } = req.params;
    const [rows] = await pool.query('SELECT image_url FROM products WHERE id = ?', [id]);
    if(rows.length && rows[0].image_url){
      fs.unlink(path.join(UPLOAD_DIR, rows[0].image_url), () => {});
    }
    await pool.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Could not delete product.' });
  }
});

module.exports = router;
