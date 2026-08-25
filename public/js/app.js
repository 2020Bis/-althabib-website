/* ==========================================================================
   AL-THABIB — Landing page interactivity (backed by the MySQL API)
   ========================================================================== */

let allProducts = [];
let cart = []; // {id, name, price, qty, category, unit}
let activeCat = 'all';
let searchTerm = '';

document.getElementById('year').textContent = new Date().getFullYear();

/* ---------------- Product icons per category (inline SVG fallback) ---------------- */
function productIcon(cat){
  const icons = {
    equipment: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2v6M9 5h6M4 21h16M6 21V11a2 2 0 012-2h8a2 2 0 012 2v10" stroke="#0b3d62" stroke-width="1.6" stroke-linecap="round"/></svg>',
    drugs: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 3h8M9 3v5.5L4.5 15a3 3 0 002.5 4.6h10a3 3 0 002.5-4.6L15 8.5V3" stroke="#146b48" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    consumables: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="7" width="16" height="12" rx="2" stroke="#c9862f" stroke-width="1.6"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="#c9862f" stroke-width="1.6"/></svg>'
  };
  return icons[cat] || icons.equipment;
}
function productMedia(p){
  if(p.imageUrl){
    return `<img src="${p.imageUrl}" alt="${escapeHtml(p.name)}" style="width:100%; height:100%; object-fit:cover;">`;
  }
  return productIcon(p.category);
}

/* ---------------- Load products from API ---------------- */
async function loadProducts(){
  const grid = document.getElementById('productGrid');
  grid.innerHTML = `<div class="no-results">Loading products…</div>`;
  try{
    allProducts = await Store.getProducts();
  } catch(err){
    grid.innerHTML = `<div class="no-results">Couldn't load products right now. Please refresh, or check that the server is running.</div>`;
    console.error(err);
    return;
  }
  renderProducts();
  renderManifest();
}

/* ---------------- Render products ---------------- */
function renderProducts(){
  const grid = document.getElementById('productGrid');
  const filtered = allProducts.filter(p => {
    const matchCat = activeCat === 'all' || p.category === activeCat;
    const matchSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm) || p.desc.toLowerCase().includes(searchTerm);
    return matchCat && matchSearch;
  });

  document.getElementById('statProducts').textContent = allProducts.length;
  document.getElementById('statAbout1').textContent = allProducts.length;
  document.getElementById('countEquipment').textContent = allProducts.filter(p=>p.category==='equipment').length + ' items';
  document.getElementById('countDrugs').textContent = allProducts.filter(p=>p.category==='drugs').length + ' items';
  document.getElementById('countConsumables').textContent = allProducts.filter(p=>p.category==='consumables').length + ' items';

  if(filtered.length === 0){
    grid.innerHTML = `<div class="no-results">No products match your search. Try a different term or category.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const status = stockStatus(p.stock);
    const statusText = status === 'in' ? 'In Stock' : status === 'low' ? `Low · ${p.stock} left` : 'Out of Stock';
    return `
    <div class="product-card cat-${p.category}">
      <div class="product-media">
        <span class="stock-tag ${status}">${statusText}</span>
        ${productMedia(p)}
      </div>
      <div class="product-body">
        <span class="product-cat-label">${catLabel(p.category)}</span>
        <h4>${escapeHtml(p.name)}</h4>
        <p class="desc">${escapeHtml(p.desc)}</p>
        <div class="product-foot">
          <div class="price">${money(p.price)}<span> / ${escapeHtml(p.unit)}</span></div>
          <button class="add-btn" ${p.stock<=0?'disabled':''} data-id="${p.id}">
            ${p.stock<=0 ? 'Unavailable' : '+ Add to Cart'}
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.add-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.id));
  });
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

/* ---------------- Manifest preview in hero ---------------- */
function renderManifest(){
  const items = allProducts.filter(p => p.stock > 0).slice(0, 4);
  document.getElementById('manifestList').innerHTML = items.map(p => `
    <li>
      <span><span class="name">${escapeHtml(p.name)}</span><span class="cat">${catLabel(p.category)}</span></span>
      <span>${money(p.price)}</span>
    </li>`).join('');
}

/* ---------------- Cart logic ---------------- */
function addToCart(id){
  const product = allProducts.find(p => p.id === id);
  if(!product || product.stock <= 0) return;
  const line = cart.find(c => c.id === id);
  if(line){
    if(line.qty < product.stock) line.qty += 1;
    else showToast('No more stock available for this item.');
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, qty: 1, category: product.category, unit: product.unit });
  }
  renderCart();
  showToast(`${product.name} added to cart`);
}

function changeQty(id, delta){
  const line = cart.find(c => c.id === id);
  if(!line) return;
  const product = allProducts.find(p => p.id === id);
  line.qty += delta;
  if(line.qty <= 0){
    cart = cart.filter(c => c.id !== id);
  } else if(product && line.qty > product.stock){
    line.qty = product.stock;
  }
  renderCart();
}

function removeFromCart(id){
  cart = cart.filter(c => c.id !== id);
  renderCart();
}

function cartTotal(){
  return cart.reduce((sum, c) => sum + c.price * c.qty, 0);
}

function renderCart(){
  const count = cart.reduce((s,c)=>s+c.qty,0);
  document.getElementById('cartCount').textContent = count;
  const body = document.getElementById('cartBody');
  const foot = document.getElementById('cartFoot');

  if(cart.length === 0){
    body.innerHTML = `<div class="cart-empty">Your cart is empty.<br>Browse the catalogue and add products to build a requisition.</div>`;
    foot.style.display = 'none';
    return;
  }
  foot.style.display = 'block';
  body.innerHTML = cart.map(c => `
    <div class="cart-line">
      <div class="cart-line-icon">${productIcon(c.category)}</div>
      <div class="cart-line-info">
        <h5>${escapeHtml(c.name)}</h5>
        <div class="unit">${money(c.price)} / ${escapeHtml(c.unit)}</div>
        <div class="qty-control">
          <button data-act="minus" data-id="${c.id}">−</button>
          <span>${c.qty}</span>
          <button data-act="plus" data-id="${c.id}">+</button>
        </div>
        <button class="cart-line-remove" data-remove="${c.id}">Remove</button>
      </div>
      <div class="cart-line-total">${money(c.price * c.qty)}</div>
    </div>`).join('');

  document.getElementById('cartTotal').textContent = money(cartTotal());

  body.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => changeQty(btn.dataset.id, btn.dataset.act === 'plus' ? 1 : -1));
  });
  body.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.remove));
  });
}

/* ---------------- Drawer open/close ---------------- */
const overlay = document.getElementById('overlay');
const drawer = document.getElementById('cartDrawer');
function openDrawer(){ overlay.classList.add('open'); drawer.classList.add('open'); }
function closeDrawer(){ overlay.classList.remove('open'); drawer.classList.remove('open'); }
document.getElementById('cartBtn').addEventListener('click', openDrawer);
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
overlay.addEventListener('click', () => { closeDrawer(); closeCheckout(); });

/* ---------------- Checkout modal ---------------- */
const checkoutOverlay = document.getElementById('checkoutOverlay');
function openCheckout(){
  if(cart.length === 0) return;
  checkoutOverlay.classList.add('open');
}
function closeCheckout(){ checkoutOverlay.classList.remove('open'); }
document.getElementById('openCheckout').addEventListener('click', openCheckout);
document.getElementById('checkoutClose').addEventListener('click', closeCheckout);

document.getElementById('checkoutForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const channel = e.submitter ? e.submitter.dataset.channel : 'whatsapp';
  const name = document.getElementById('ckName').value.trim();
  const org = document.getElementById('ckOrg').value.trim();
  const phone = document.getElementById('ckPhone').value.trim();
  const email = document.getElementById('ckEmail').value.trim();
  const notes = document.getElementById('ckNotes').value.trim();

  if(!name || !phone){ showToast('Please fill in your name and phone.'); return; }

  const quote = {
    type: 'quote',
    customer: { name, org, phone, email, notes },
    items: cart.map(c => ({ id:c.id, name:c.name, price:c.price, qty:c.qty, unit:c.unit, category:c.category })),
    total: cartTotal(),
    channel
  };

  try{
    const saved = await Store.addQuote(quote);
    sendMessage(channel, buildQuoteMessage({ ...quote, id: saved.id }));
    cart = [];
    renderCart();
    closeCheckout();
    closeDrawer();
    document.getElementById('checkoutForm').reset();
    showToast('Quotation request sent. Our team will follow up shortly.');
  } catch(err){
    console.error(err);
    showToast('Could not send your request. Please try again.');
  }
});

/* ---------------- Consult form ---------------- */
document.getElementById('consultForm').addEventListener('submit', async function(e){
  e.preventDefault();
  const channel = e.submitter ? e.submitter.dataset.channel : 'whatsapp';
  const name = document.getElementById('cName').value.trim();
  const org = document.getElementById('cOrg').value.trim();
  const phone = document.getElementById('cPhone').value.trim();
  const email = document.getElementById('cEmail').value.trim();
  const message = document.getElementById('cMessage').value.trim();

  if(!name || !phone || !message){ showToast('Please fill in the required fields.'); return; }

  const consult = {
    type: 'consultation',
    customer: { name, org, phone, email, notes: message },
    items: [],
    total: 0,
    channel
  };

  try{
    const saved = await Store.addQuote(consult);
    sendMessage(channel, buildConsultMessage({ ...consult, id: saved.id }));
    document.getElementById('consultForm').reset();
    showToast('Your consultation request has been sent.');
  } catch(err){
    console.error(err);
    showToast('Could not send your request. Please try again.');
  }
});

/* ---------------- Message builders & senders ---------------- */
function buildQuoteMessage(q){
  const lines = q.items.map(i => `• ${i.name} × ${i.qty} (${i.unit}) — ${money(i.price * i.qty)}`).join('\n');
  return `New Quotation Request — ${q.id}\n\n` +
    `Customer: ${q.customer.name}\n` +
    (q.customer.org ? `Organisation: ${q.customer.org}\n` : '') +
    `Phone: ${q.customer.phone}\n` +
    (q.customer.email ? `Email: ${q.customer.email}\n` : '') +
    `\nItems:\n${lines}\n\n` +
    `Estimated Total: ${money(q.total)}\n` +
    (q.customer.notes ? `\nNotes: ${q.customer.notes}\n` : '') +
    `\nSent from al-thabib.com product catalogue.`;
}

function buildConsultMessage(q){
  return `New Consultation Request — ${q.id}\n\n` +
    `Customer: ${q.customer.name}\n` +
    (q.customer.org ? `Organisation: ${q.customer.org}\n` : '') +
    `Phone: ${q.customer.phone}\n` +
    (q.customer.email ? `Email: ${q.customer.email}\n` : '') +
    `\nMessage:\n${q.customer.notes}\n\n` +
    `Sent from al-thabib.com consultation form.`;
}

function sendMessage(channel, text){
  if(channel === 'whatsapp'){
    const url = `https://wa.me/${COMPANY.phoneDial}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  } else {
    const subject = encodeURIComponent('New Request from al-thabib.com');
    const body = encodeURIComponent(text);
    window.location.href = `mailto:${COMPANY.email}?subject=${subject}&body=${body}`;
  }
}

/* ---------------- Toast ---------------- */
let toastTimer;
function showToast(msg){
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

/* ---------------- Filters ---------------- */
document.getElementById('filterPills').addEventListener('click', (e) => {
  const btn = e.target.closest('.pill');
  if(!btn) return;
  activeCat = btn.dataset.cat;
  document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p === btn));
  renderProducts();
});
document.querySelectorAll('.cat-tile[data-cat]').forEach(tile => {
  tile.addEventListener('click', () => {
    activeCat = tile.dataset.cat;
    document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.cat === activeCat));
    document.getElementById('products').scrollIntoView({behavior:'smooth'});
    renderProducts();
  });
});
document.querySelectorAll('[data-cat-link]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    activeCat = link.dataset.catLink;
    document.querySelectorAll('.pill').forEach(p => p.classList.toggle('active', p.dataset.cat === activeCat));
    document.getElementById('products').scrollIntoView({behavior:'smooth'});
    renderProducts();
  });
});
document.getElementById('searchInput').addEventListener('input', (e) => {
  searchTerm = e.target.value.trim().toLowerCase();
  renderProducts();
});

/* ---------------- Mobile nav ---------------- */
document.getElementById('hamburgerBtn').addEventListener('click', () => {
  document.getElementById('mainNav').classList.toggle('open');
});
document.querySelectorAll('.main-nav a').forEach(a => {
  a.addEventListener('click', () => document.getElementById('mainNav').classList.remove('open'));
});

/* ---------------- Init ---------------- */
renderCart();
loadProducts();
