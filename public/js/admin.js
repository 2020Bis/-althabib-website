/* ==========================================================================
   AL-THABIB — Admin panel logic (backed by the MySQL API)
   ========================================================================== */

let allProducts = [];
let allQuotes = [];
let prodCatFilter = 'all';
let prodSearch = '';
let quoteStatusFilter = 'all';
let quoteTypeFilter = 'all';
let activeQuoteId = null;
let charts = { trend: null, revenue: null, stock: null, category: null };

const BRAND = {
  navy: '#0b3d62',
  navySoft: 'rgba(11,61,98,0.14)',
  green: '#1e8a5f',
  greenSoft: 'rgba(30,138,95,0.14)',
  amber: '#e2a93b',
  amberSoft: 'rgba(226,169,59,0.16)',
  red: '#9c2b21',
  redSoft: 'rgba(156,43,33,0.14)',
  ink: '#4a5a68',
  line: '#e6e9eb'
};

if(window.Chart){
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.color = BRAND.ink;
  Chart.defaults.font.size = 12;
}

/* ---------------- Auth ---------------- */
async function checkAuth(){
  if(Store.isAdmin()){
    document.getElementById('loginShell').style.display = 'none';
    document.getElementById('adminShell').style.display = 'flex';
    try{
      await renderAll();
    } catch(err){
      if(String(err.message).includes('Unauthorized')){
        Store.logout();
        checkAuth();
      }
    }
  } else {
    document.getElementById('loginShell').style.display = 'flex';
    document.getElementById('adminShell').style.display = 'none';
  }
}

document.getElementById('loginForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const pass = document.getElementById('loginPass').value;
  const submitBtn = e.target.querySelector('button[type=submit]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in…';
  try{
    await Store.login(pass);
    document.getElementById('loginError').classList.remove('show');
    document.getElementById('loginPass').value = '';
    await checkAuth();
  } catch(err){
    document.getElementById('loginError').textContent = err.message || 'Incorrect password. Please try again.';
    document.getElementById('loginError').classList.add('show');
  } finally{
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await Store.logout();
  checkAuth();
});

/* ---------------- Nav switching ---------------- */
const viewTitles = {
  dashboard: ['Overview', "Welcome back — here's what's happening today."],
  products: ['Products', 'Manage your catalogue, pricing, photos and stock levels.'],
  quotes: ['Quotations', 'Track requests from clients and mark payment status.'],
  settings: ['Settings', 'Manage your admin account and data preferences.']
};

function switchView(view){
  document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('#adminNav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.getElementById('topbarTitle').textContent = viewTitles[view][0];
  document.getElementById('topbarSub').textContent = viewTitles[view][1];
  renderAll();
}
document.getElementById('adminNav').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if(btn) switchView(btn.dataset.view);
});
document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', () => switchView(el.dataset.nav));
});

/* ---------------- Data loading ---------------- */
async function loadData(){
  allProducts = await Store.getProducts();
  allQuotes = await Store.getQuotes();
}

/* ---------------- Dashboard ---------------- */
function renderDashboard(){
  const products = allProducts;
  const quotes = allQuotes;

  document.getElementById('statTotalProducts').textContent = products.length;
  const byCat = {equipment:0, drugs:0, consumables:0};
  products.forEach(p => byCat[p.category] = (byCat[p.category]||0) + 1);
  document.getElementById('statCatBreakdown').textContent =
    `${byCat.equipment} Equipment · ${byCat.drugs} Drugs · ${byCat.consumables} Consumables`;

  const lowOrOut = products.filter(p => p.stock <= 10);
  document.getElementById('statLowStock').textContent = lowOrOut.length;

  const quoteOnly = quotes.filter(q => q.type === 'quote');
  const consultOnly = quotes.filter(q => q.type === 'consultation');
  document.getElementById('statQuotes').textContent = quotes.length;
  document.getElementById('statQuoteSub').textContent = `${quoteOnly.length} quotes · ${consultOnly.length} consultations`;

  const paid = quotes.filter(q => q.status === 'paid');
  const unpaid = quotes.filter(q => q.status === 'unpaid' && q.type === 'quote');
  const revenue = paid.reduce((s,q) => s + (q.total||0), 0);
  const unpaidValue = unpaid.reduce((s,q) => s + (q.total||0), 0);
  document.getElementById('statRevenue').textContent = money(revenue);
  document.getElementById('statUnpaidValue').textContent = `${money(unpaidValue)} pending unpaid`;

  const recent = quotes.slice(0, 6);
  document.getElementById('recentQuotesBody').innerHTML = recent.length ? recent.map(q => quoteRow(q, true)).join('') :
    `<tr><td colspan="6" class="empty-state">No quotations received yet.</td></tr>`;
  attachQuoteRowEvents('recentQuotesBody');

  const lowRows = lowOrOut.slice(0, 8);
  document.getElementById('lowStockBody').innerHTML = lowRows.length ? lowRows.map(p => `
    <tr>
      <td>${productCell(p)}</td>
      <td><span class="badge cat-${p.category}">${catLabel(p.category)}</span></td>
      <td><span class="badge ${stockStatus(p.stock)}">${stockLabel(p.stock)}</span></td>
      <td class="num">${money(p.price)}</td>
    </tr>`).join('') : `<tr><td colspan="4" class="empty-state">All products are well stocked. 🎉</td></tr>`;

  renderCharts(products, quotes);
}

/* ---------------- Charts ---------------- */
function destroyChart(key){
  if(charts[key]){ charts[key].destroy(); charts[key] = null; }
}

function renderCharts(products, quotes){
  if(!window.Chart) return;
  renderTrendChart(quotes);
  renderRevenueChart(quotes);
  renderStockChart(products);
  renderCategoryChart(products);
}

function renderTrendChart(quotes){
  const days = [];
  const quoteCounts = [];
  const consultCounts = [];
  const today = new Date();
  today.setHours(0,0,0,0);
  for(let i = 13; i >= 0; i--){
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  days.forEach(d => {
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const dayQuotes = quotes.filter(q => {
      const created = new Date(q.createdAt);
      return created >= d && created < next;
    });
    quoteCounts.push(dayQuotes.filter(q => q.type === 'quote').length);
    consultCounts.push(dayQuotes.filter(q => q.type === 'consultation').length);
  });
  const labels = days.map(d => d.toLocaleDateString('en-KE', {day:'2-digit', month:'short'}));

  const total = quoteCounts.reduce((a,b)=>a+b,0) + consultCounts.reduce((a,b)=>a+b,0);
  document.getElementById('trendLegend').innerHTML = total === 0
    ? `<span style="color:var(--ink-soft); font-weight:500;">No activity in the last 14 days yet</span>`
    : `<span class="dot-quotes">Product Quotes</span><span class="dot-consult">Consultations</span>`;

  destroyChart('trend');
  const ctx = document.getElementById('trendChart').getContext('2d');
  charts.trend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Product Quotes', data: quoteCounts, backgroundColor: BRAND.navy, borderRadius: 4, maxBarThickness: 18, stack: 'r' },
        { label: 'Consultations', data: consultCounts, backgroundColor: BRAND.amber, borderRadius: 4, maxBarThickness: 18, stack: 'r' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: BRAND.line } }
      }
    }
  });
}

function renderRevenueChart(quotes){
  const paid = quotes.filter(q => q.status === 'paid').reduce((s,q)=>s+(q.total||0),0);
  const pending = quotes.filter(q => q.status === 'unpaid' && q.type === 'quote').reduce((s,q)=>s+(q.total||0),0);
  const total = paid + pending;

  document.getElementById('revenueCenterLabel').innerHTML = total > 0
    ? `<strong>${money(total)}</strong>total quoted value`
    : `<strong>KSh 0</strong>no quotations yet`;

  destroyChart('revenue');
  const ctx = document.getElementById('revenueChart').getContext('2d');
  charts.revenue = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Paid', 'Pending'],
      datasets: [{
        data: total > 0 ? [paid, pending] : [1, 0],
        backgroundColor: total > 0 ? [BRAND.green, BRAND.amber] : [BRAND.line, BRAND.line],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '72%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 9, boxHeight: 9, padding: 12, usePointStyle: true, pointStyle: 'rectRounded' } },
        tooltip: { callbacks: { label: (c) => `${c.label}: ${money(c.raw)}` }, enabled: total > 0 }
      }
    }
  });
}

function renderStockChart(products){
  const inStock = products.filter(p => stockStatus(p.stock) === 'in').length;
  const low = products.filter(p => stockStatus(p.stock) === 'low').length;
  const out = products.filter(p => stockStatus(p.stock) === 'out').length;

  document.getElementById('stockCenterLabel').innerHTML = `<strong>${products.length}</strong>products tracked`;

  destroyChart('stock');
  const ctx = document.getElementById('stockChart').getContext('2d');
  charts.stock = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['In Stock', 'Low Stock', 'Out of Stock'],
      datasets: [{
        data: [inStock, low, out],
        backgroundColor: [BRAND.green, BRAND.amber, BRAND.red],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '72%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 9, boxHeight: 9, padding: 12, usePointStyle: true, pointStyle: 'rectRounded' } }
      }
    }
  });
}

function renderCategoryChart(products){
  const byCat = {equipment:0, drugs:0, consumables:0};
  products.forEach(p => byCat[p.category] = (byCat[p.category]||0) + 1);

  destroyChart('category');
  const ctx = document.getElementById('categoryChart').getContext('2d');
  charts.category = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Equipment', 'Drugs', 'Consumables'],
      datasets: [{
        data: [byCat.equipment, byCat.drugs, byCat.consumables],
        backgroundColor: [BRAND.navy, BRAND.green, BRAND.amber],
        borderRadius: 6, maxBarThickness: 34
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.raw} products` } } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: BRAND.line } },
        y: { grid: { display: false } }
      }
    }
  });
}

function productCell(p){
  const thumb = p.imageUrl
    ? `<img src="${p.imageUrl}" alt="" style="width:38px; height:38px; border-radius:6px; object-fit:cover; margin-right:10px; flex-shrink:0;">`
    : `<div style="width:38px; height:38px; border-radius:6px; background:var(--paper); margin-right:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:15px;">📦</div>`;
  return `<div style="display:flex; align-items:center;">${thumb}<div><div class="row-product-name">${escapeHtml(p.name)}</div><div class="row-product-sku">${escapeHtml(p.sku||'')}</div></div></div>`;
}

/* ---------------- Products ---------------- */
function renderProductsTable(){
  const filtered = allProducts.filter(p => {
    const matchCat = prodCatFilter === 'all' || p.category === prodCatFilter;
    const matchSearch = !prodSearch || p.name.toLowerCase().includes(prodSearch);
    return matchCat && matchSearch;
  });
  const body = document.getElementById('productsBody');
  if(filtered.length === 0){
    body.innerHTML = `<tr><td colspan="6" class="empty-state">No products found.</td></tr>`;
    return;
  }
  body.innerHTML = filtered.map(p => `
    <tr>
      <td>${productCell(p)}</td>
      <td><span class="badge cat-${p.category}">${catLabel(p.category)}</span></td>
      <td class="num">${money(p.price)} <span style="color:var(--ink-soft); font-weight:400;">/ ${escapeHtml(p.unit)}</span></td>
      <td class="num">${p.stock}</td>
      <td><span class="badge ${stockStatus(p.stock)}">${stockLabel(p.stock)}</span></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-edit="${p.id}">Edit</button>
          <button class="icon-btn danger" data-delete="${p.id}">Delete</button>
        </div>
      </td>
    </tr>`).join('');

  body.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openProductModal(btn.dataset.edit)));
  body.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
    if(confirm('Delete this product? This cannot be undone.')){
      try{
        await Store.deleteProduct(btn.dataset.delete);
        showToast('Product deleted.');
        await renderAll();
      } catch(err){ showToast(err.message || 'Could not delete product.'); }
    }
  }));
}

document.getElementById('prodCatFilter').addEventListener('change', (e) => { prodCatFilter = e.target.value; renderProductsTable(); });
document.getElementById('prodSearch').addEventListener('input', (e) => { prodSearch = e.target.value.trim().toLowerCase(); renderProductsTable(); });

/* ---- Product modal ---- */
const productModalOverlay = document.getElementById('productModalOverlay');
function openProductModal(id){
  const form = document.getElementById('productForm');
  form.reset();
  document.getElementById('pRemoveImage').value = 'false';
  document.getElementById('pImagePreviewWrap').style.display = 'none';

  if(id){
    const p = allProducts.find(p => p.id === id);
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('pId').value = p.id;
    document.getElementById('pName').value = p.name;
    document.getElementById('pCategory').value = p.category;
    document.getElementById('pSku').value = p.sku || '';
    document.getElementById('pDesc').value = p.desc;
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pUnit').value = p.unit;
    document.getElementById('pStock').value = p.stock;
    if(p.imageUrl){
      document.getElementById('pImagePreview').src = p.imageUrl;
      document.getElementById('pImagePreviewWrap').style.display = 'block';
    }
  } else {
    document.getElementById('productModalTitle').textContent = 'Add Product';
    document.getElementById('pId').value = '';
  }
  productModalOverlay.classList.add('open');
}
document.getElementById('addProductBtn').addEventListener('click', () => openProductModal(null));
document.getElementById('productModalCancel').addEventListener('click', () => productModalOverlay.classList.remove('open'));
productModalOverlay.addEventListener('click', (e) => { if(e.target === productModalOverlay) productModalOverlay.classList.remove('open'); });

document.getElementById('pImageRemoveBtn').addEventListener('click', () => {
  document.getElementById('pImagePreviewWrap').style.display = 'none';
  document.getElementById('pRemoveImage').value = 'true';
  document.getElementById('pImage').value = '';
});
document.getElementById('pImage').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(!file) return;
  document.getElementById('pRemoveImage').value = 'false';
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('pImagePreview').src = reader.result;
    document.getElementById('pImagePreviewWrap').style.display = 'block';
  };
  reader.readAsDataURL(file);
});

document.getElementById('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('pId').value;
  const saveBtn = e.target.querySelector('button[type=submit]');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const formData = new FormData();
  formData.append('name', document.getElementById('pName').value.trim());
  formData.append('category', document.getElementById('pCategory').value);
  formData.append('sku', document.getElementById('pSku').value.trim());
  formData.append('desc', document.getElementById('pDesc').value.trim());
  formData.append('price', document.getElementById('pPrice').value);
  formData.append('unit', document.getElementById('pUnit').value.trim());
  formData.append('stock', document.getElementById('pStock').value);
  const imageFile = document.getElementById('pImage').files[0];
  if(imageFile) formData.append('image', imageFile);
  if(document.getElementById('pRemoveImage').value === 'true') formData.append('removeImage', 'true');

  try{
    if(id){
      await Store.updateProduct(id, formData);
      showToast('Product updated.');
    } else {
      await Store.addProduct(formData);
      showToast('Product added.');
    }
    productModalOverlay.classList.remove('open');
    await renderAll();
  } catch(err){
    showToast(err.message || 'Could not save product.');
  } finally{
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Product';
  }
});

/* ---------------- Quotes ---------------- */
function quoteRow(q, compact){
  const label = q.type === 'quote' ? 'Product Quote' : 'Consultation';
  return `
    <tr>
      <td style="font-family:var(--font-mono); font-size:12.5px;">${q.id}</td>
      <td><div class="row-product-name">${escapeHtml(q.customer.name)}</div><div class="row-product-sku">${escapeHtml(q.customer.phone||'')}</div></td>
      <td>${label}</td>
      ${compact ? '' : `<td>${q.items.length} item${q.items.length===1?'':'s'}</td>`}
      <td class="num">${q.type === 'quote' ? money(q.total) : '—'}</td>
      <td><span class="badge ${q.status}">${q.status === 'paid' ? 'Paid' : 'Unpaid'}</span></td>
      <td style="font-size:12.5px; color:var(--ink-soft);">${formatDate(q.createdAt)}</td>
      ${compact ? '' : `<td><button class="icon-btn" data-view-quote="${q.id}">View</button></td>`}
    </tr>`;
}

function attachQuoteRowEvents(bodyId){
  const body = document.getElementById(bodyId);
  body.querySelectorAll('tr').forEach(tr => { tr.style.cursor = 'pointer'; });
  body.onclick = function(e){
    const tr = e.target.closest('tr');
    if(!tr) return;
    const idCell = tr.querySelector('td');
    if(idCell && idCell.textContent.trim()) openQuoteModal(idCell.textContent.trim());
  };
}

function renderQuotesTable(){
  const filtered = allQuotes.filter(q => {
    const matchStatus = quoteStatusFilter === 'all' || q.status === quoteStatusFilter;
    const matchType = quoteTypeFilter === 'all' || q.type === quoteTypeFilter;
    return matchStatus && matchType;
  });
  const body = document.getElementById('quotesBody');
  if(filtered.length === 0){
    body.innerHTML = `<tr><td colspan="8" class="empty-state">No quotations match this filter.</td></tr>`;
    return;
  }
  body.innerHTML = filtered.map(q => quoteRow(q, false)).join('');
  body.querySelectorAll('[data-view-quote]').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); openQuoteModal(btn.dataset.viewQuote); }));
}

document.getElementById('quoteStatusFilter').addEventListener('change', (e) => { quoteStatusFilter = e.target.value; renderQuotesTable(); });
document.getElementById('quoteTypeFilter').addEventListener('change', (e) => { quoteTypeFilter = e.target.value; renderQuotesTable(); });

/* ---- Quote detail modal ---- */
const quoteModalOverlay = document.getElementById('quoteModalOverlay');
function openQuoteModal(id){
  const q = allQuotes.find(q => q.id === id);
  if(!q) return;
  activeQuoteId = id;
  document.getElementById('quoteModalRef').textContent = q.id;
  document.getElementById('quoteDetailGrid').innerHTML = `
    <div class="kv"><label>Customer</label><div>${escapeHtml(q.customer.name)}</div></div>
    <div class="kv"><label>Organisation</label><div>${escapeHtml(q.customer.org || '—')}</div></div>
    <div class="kv"><label>Phone</label><div>${escapeHtml(q.customer.phone || '—')}</div></div>
    <div class="kv"><label>Email</label><div>${escapeHtml(q.customer.email || '—')}</div></div>
    <div class="kv"><label>Type</label><div>${q.type === 'quote' ? 'Product Quote' : 'Consultation'}</div></div>
    <div class="kv"><label>Submitted</label><div>${formatDate(q.createdAt)}</div></div>
  `;
  let itemsHtml = '';
  if(q.items && q.items.length){
    itemsHtml = `<table class="quote-items-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>` +
      q.items.map(i => `<tr><td>${escapeHtml(i.name)}</td><td>${i.qty} ${escapeHtml(i.unit)}</td><td>${money(i.price)}</td><td>${money(i.price*i.qty)}</td></tr>`).join('') +
      `</tbody></table><div class="quote-total-row"><span>Total</span><span>${money(q.total)}</span></div>`;
  } else {
    itemsHtml = `<div style="background:var(--paper); border-radius:8px; padding:14px; font-size:13.5px; color:var(--ink);"><strong>Message:</strong><br>${escapeHtml(q.customer.notes || '')}</div>`;
  }
  document.getElementById('quoteItemsWrap').innerHTML = itemsHtml;
  quoteModalOverlay.classList.add('open');
}
document.getElementById('quoteModalClose').addEventListener('click', () => quoteModalOverlay.classList.remove('open'));
quoteModalOverlay.addEventListener('click', (e) => { if(e.target === quoteModalOverlay) quoteModalOverlay.classList.remove('open'); });
document.getElementById('quoteMarkPaid').addEventListener('click', async () => {
  if(!activeQuoteId) return;
  try{
    await Store.updateQuoteStatus(activeQuoteId, 'paid');
    showToast('Marked as paid.');
    quoteModalOverlay.classList.remove('open');
    await renderAll();
  } catch(err){ showToast(err.message || 'Could not update quote.'); }
});
document.getElementById('quoteMarkUnpaid').addEventListener('click', async () => {
  if(!activeQuoteId) return;
  try{
    await Store.updateQuoteStatus(activeQuoteId, 'unpaid');
    showToast('Marked as unpaid.');
    quoteModalOverlay.classList.remove('open');
    await renderAll();
  } catch(err){ showToast(err.message || 'Could not update quote.'); }
});

/* ---------------- Settings ---------------- */
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const p1 = document.getElementById('newPass').value;
  const p2 = document.getElementById('confirmPass').value;
  if(p1 !== p2){ showToast('Passwords do not match.'); return; }
  try{
    await Store.changePassword(p1);
    document.getElementById('passwordForm').reset();
    showToast('Password updated.');
  } catch(err){
    showToast(err.message || 'Could not update password.');
  }
});

/* ---------------- Helpers ---------------- */
function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}
function formatDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('en-KE', {day:'2-digit', month:'short', year:'numeric'}) + ' · ' +
    d.toLocaleTimeString('en-KE', {hour:'2-digit', minute:'2-digit'});
}
let toastTimer;
function showToast(msg){
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

async function renderAll(){
  await loadData();
  renderDashboard();
  renderProductsTable();
  renderQuotesTable();
}

checkAuth();
