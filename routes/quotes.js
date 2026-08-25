const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function genId(prefix){
  return prefix + '-' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

async function rowToQuote(row){
  const [items] = await pool.query('SELECT * FROM quote_items WHERE quote_id = ?', [row.id]);
  return {
    id: row.id,
    type: row.type,
    createdAt: row.created_at,
    customer: {
      name: row.customer_name,
      org: row.customer_org,
      phone: row.customer_phone,
      email: row.customer_email,
      notes: row.customer_notes
    },
    items: items.map(i => ({
      id: i.product_id, name: i.name, price: Number(i.price), qty: i.qty, unit: i.unit, category: i.category
    })),
    total: Number(row.total),
    status: row.status,
    channel: row.channel
  };
}

// GET /api/quotes — admin only
router.get('/', requireAdmin, async (req, res) => {
  try{
    const [rows] = await pool.query('SELECT * FROM quotes ORDER BY created_at DESC');
    const quotes = await Promise.all(rows.map(rowToQuote));
    res.json(quotes);
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Could not load quotations.' });
  }
});

// POST /api/quotes — public (submitted from the client-facing site)
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try{
    const { type, customer, items, total, channel } = req.body;
    if(!type || !customer || !customer.name || !customer.phone){
      return res.status(400).json({ error: 'Missing required quote fields.' });
    }
    const id = genId(type === 'consultation' ? 'CN' : 'QT');

    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO quotes (id, type, customer_name, customer_org, customer_phone, customer_email, customer_notes, total, status, channel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?)`,
      [id, type, customer.name, customer.org || null, customer.phone, customer.email || null, customer.notes || null, total || 0, channel || 'whatsapp']
    );
    if(Array.isArray(items)){
      for(const it of items){
        await conn.query(
          `INSERT INTO quote_items (quote_id, product_id, name, price, qty, unit, category) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, it.id || null, it.name, it.price, it.qty, it.unit, it.category]
        );
      }
    }
    await conn.commit();
    res.status(201).json({ id });
  } catch(err){
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Could not save quotation.' });
  } finally{
    conn.release();
  }
});

// PATCH /api/quotes/:id — admin only (mark paid/unpaid)
router.patch('/:id', requireAdmin, async (req, res) => {
  try{
    const { status } = req.body;
    if(!['paid', 'unpaid'].includes(status)){
      return res.status(400).json({ error: 'Status must be "paid" or "unpaid".' });
    }
    await pool.query('UPDATE quotes SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Could not update quotation.' });
  }
});

// DELETE /api/quotes/:id — admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try{
    await pool.query('DELETE FROM quotes WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Could not delete quotation.' });
  }
});

module.exports = router;
