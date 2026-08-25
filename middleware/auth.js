/* ==========================================================================
   AL-THABIB — Lightweight admin auth
   Issues a random bearer token on successful login and keeps it in memory
   for a limited time. Good enough for a small internal admin panel; swap
   for a proper session/JWT + HTTPS-only cookie setup if you need stronger
   guarantees.
   ========================================================================== */

const crypto = require('crypto');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const tokens = new Map(); // token -> expiry timestamp

function issueToken(){
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

function revokeToken(token){
  tokens.delete(token);
}

function isValid(token){
  if(!token) return false;
  const expiry = tokens.get(token);
  if(!expiry) return false;
  if(Date.now() > expiry){
    tokens.delete(token);
    return false;
  }
  return true;
}

function requireAdmin(req, res, next){
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if(!isValid(token)){
    return res.status(401).json({ error: 'Unauthorized. Please log in again.' });
  }
  next();
}

module.exports = { issueToken, revokeToken, isValid, requireAdmin };
