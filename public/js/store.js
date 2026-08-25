/* ==========================================================================
   AL-THABIB — API client (talks to the Node/Express + MySQL backend)
   Replaces the old localStorage-only Store. Every page loads this file the
   same way as before; the only difference is these calls now hit the
   server over fetch() and the server persists everything in MySQL.
   ========================================================================== */

// If you deploy the frontend separately from the backend, change this to
// the backend's full URL, e.g. 'https://api.al-thabib.com/api'.
const API_BASE = window.location.origin + '/api';
const AUTH_KEY = 'althabib_admin_token';

const COMPANY = {
  name: 'Al-Thabib Medical Supplies and Equipment Ltd',
  shortName: 'Al-Thabib',
  poBox: 'P.O. Box 22440 – 00505, Nairobi, Kenya',
  address: 'Trinity Gardens G02, Baldwin Lane – Off Kilimani Rd, Nairobi',
  contactName: 'Isabel Muthoni Mwangi',
  contactTitle: 'Sales and Marketing Manager',
  phone: '+254 723 848 857',
  phoneDial: '254723848857',
  email: 'muthoni.mwangi@al-thabib.com',
  website: 'www.al-thabib.com'
};

function authHeaders(){
  const token = sessionStorage.getItem(AUTH_KEY);
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

async function handleResponse(res){
  let body = null;
  try{ body = await res.json(); } catch(e){ /* no body */ }
  if(!res.ok){
    const message = (body && body.error) ? body.error : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

const Store = {
  /* ---------------- Products ---------------- */
  async getProducts(){
    const res = await fetch(`${API_BASE}/products`);
    return handleResponse(res);
  },
  async addProduct(formData){
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { ...authHeaders() },
      body: formData
    });
    return handleResponse(res);
  },
  async updateProduct(id, formData){
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { ...authHeaders() },
      body: formData
    });
    return handleResponse(res);
  },
  async deleteProduct(id){
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE',
      headers: { ...authHeaders() }
    });
    return handleResponse(res);
  },

  /* ---------------- Quotes ---------------- */
  async getQuotes(){
    const res = await fetch(`${API_BASE}/quotes`, { headers: { ...authHeaders() } });
    return handleResponse(res);
  },
  async addQuote(quote){
    const res = await fetch(`${API_BASE}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quote)
    });
    return handleResponse(res);
  },
  async updateQuoteStatus(id, status){
    const res = await fetch(`${API_BASE}/quotes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status })
    });
    return handleResponse(res);
  },
  async deleteQuote(id){
    const res = await fetch(`${API_BASE}/quotes/${id}`, {
      method: 'DELETE',
      headers: { ...authHeaders() }
    });
    return handleResponse(res);
  },

  /* ---------------- Admin auth ---------------- */
  async login(password){
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const body = await handleResponse(res);
    sessionStorage.setItem(AUTH_KEY, body.token);
    return true;
  },
  async logout(){
    try{
      await fetch(`${API_BASE}/admin/logout`, { method: 'POST', headers: { ...authHeaders() } });
    } catch(e){ /* ignore */ }
    sessionStorage.removeItem(AUTH_KEY);
  },
  isAdmin(){
    return !!sessionStorage.getItem(AUTH_KEY);
  },
  async changePassword(newPassword){
    const res = await fetch(`${API_BASE}/admin/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ newPassword })
    });
    return handleResponse(res);
  }
};

function money(n){
  return 'KSh ' + Number(n).toLocaleString('en-KE', {maximumFractionDigits:0});
}
function genId(prefix){
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}
function stockStatus(stock){
  if(stock <= 0) return 'out';
  if(stock <= 10) return 'low';
  return 'in';
}
function stockLabel(stock){
  if(stock <= 0) return 'Out of stock';
  if(stock <= 10) return `Low stock · ${stock} left`;
  return `In stock · ${stock} available`;
}
function catLabel(cat){
  return {equipment:'Equipment', drugs:'Drugs & Pharmaceuticals', consumables:'Consumables'}[cat] || cat;
}
