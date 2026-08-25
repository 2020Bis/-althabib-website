# Al-Thabib Medical Supplies — Website + Admin Panel (MySQL edition)

A full-stack version of the site: the public catalogue and the admin panel now share
one **Node.js + Express** server backed by a **MySQL** database, so products, stock,
photos and quotations are stored centrally instead of only in the browser.

## What's new in this version

- **MySQL database** for products, quotations and admin settings (see `db/schema.sql`)
- **Admin can upload a real product photo** (JPG/PNG/WEBP/GIF, up to 5MB) when adding
  or editing a product — stored on the server and shown on both the catalogue and the
  admin table
- **Starter product photography included** — all 20 seed products ship with a clean,
  brand-styled photo out of the box (`uploads/products/*.jpg`), so the catalogue looks
  complete on day one. Admins can replace any of these with a real photo at any time
  from the product edit form.
- **Dashboard charts** on the admin Overview page (via a locally bundled Chart.js —
  no external CDN required): a 14-day requests trend, paid-vs-pending revenue, stock
  health, and catalogue mix by category — all styled to match the site's navy/green/
  amber palette.
- Real login: the admin password is hashed with bcrypt and checked server-side; a
  session token is issued and required for every admin action (add/edit/delete
  products, view/update quotations, change password)
- Every quotation or consultation a client submits is saved straight to MySQL **and**
  still opens WhatsApp/email with the same message, so nothing is missed

## Project structure

```
al-thabib-website/
  server.js            Express app entry point
  package.json
  .env.example          Copy to .env and fill in your DB credentials
  db/
    schema.sql           Run this once to create the tables
    seed.js               Run this once to add starter products + admin password
    pool.js                MySQL connection pool
  routes/
    products.js            Product endpoints (image upload lives here)
    quotes.js               Quotation endpoints
    admin.js                Login / logout / change password
  middleware/
    auth.js                 Simple bearer-token admin auth
  uploads/products/     Uploaded product photos are saved here (20 starter photos
                          are included; admin uploads land here too)
  public/                The website itself
    index.html
    admin.html
    css/
    js/
      vendor/chart.umd.min.js   Bundled locally so charts work with no external CDN
```

## 1. Install prerequisites

- **Node.js** 18 or newer
- **MySQL** 8.0 or newer (also works with MariaDB 10.6+)

## 2. Create the database

```bash
mysql -u root -p
```
```sql
CREATE DATABASE althabib_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'althabib_user'@'localhost' IDENTIFIED BY 'choose_a_strong_password';
GRANT ALL PRIVILEGES ON althabib_db.* TO 'althabib_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Then load the schema:
```bash
mysql -u root -p althabib_db < db/schema.sql
```

## 3. Configure environment variables

```bash
cp .env.example .env
```
Edit `.env` with the database credentials you just created:
```
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=althabib_user
DB_PASSWORD=choose_a_strong_password
DB_NAME=althabib_db
```

## 4. Install dependencies and seed starter data

```bash
npm install
npm run seed
```
This adds the 20 starter products (each with a starter product photo already wired
up) and sets the default admin password to **`althabib2026`**. The seed script only
inserts data if the tables are empty, so it's safe to re-run.

## 5. Start the server

```bash
npm start
```
Visit:
- **Website:** http://localhost:4000/
- **Admin panel:** http://localhost:4000/admin.html (password: `althabib2026` — change
  it under Settings once you're logged in)

For local development with auto-restart on file changes:
```bash
npm run dev
```

## Adding a product photo

In the admin panel, go to **Products → Add Product** (or **Edit** an existing one),
choose a **Product Photo**, and save. The photo is uploaded to
`uploads/products/` on the server and appears immediately on the live catalogue and in
the admin table. Leaving the photo field empty keeps the neutral category icon;
editing a product without choosing a new photo keeps the existing one.

## Deploying to a live server

1. Point a MySQL database (many hosts offer one, e.g. cPanel/MySQL, PlanetScale,
   RDS, DigitalOcean Managed MySQL) and repeat steps 2–4 against it.
2. Deploy this folder to any Node-capable host (a VPS, Render, Railway, an
   `pm2`-managed server, etc.) and run `npm install && npm start`, or use a process
   manager so it restarts automatically.
3. Put the site behind HTTPS (e.g. via a reverse proxy like Nginx + Let's Encrypt, or
   your host's built-in TLS) — this matters especially for the admin login.
4. Make sure the `uploads/` folder is on persistent storage (not wiped on redeploy) so
   product photos aren't lost. If your host uses ephemeral storage, point `uploads/`
   at a mounted volume or swap in an object storage service (e.g. S3) later.
5. Update `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` in `.env` to match your
   production database, and change the default admin password immediately after your
   first login.

## Dashboard charts

The admin Overview page includes four charts, all rendered with Chart.js (bundled
locally in `public/js/vendor/`, no internet connection required at runtime):

- **Requests Received** — product quotes vs. consultations submitted per day, last 14 days
- **Revenue Status** — paid vs. pending value across all quotations
- **Stock Health** — how many products are in stock, low, or out of stock
- **Catalogue Mix** — how many products fall into each category

They recalculate automatically every time you open or refresh the Overview tab, so
they always reflect what's currently in the database.

## Notes on the admin login

Authentication here is intentionally simple (bcrypt-hashed password, random bearer
token issued in memory) — good for a small internal tool. If several staff need
individual logins, audit trails, or password-reset emails, that's a natural next
upgrade to the `settings`/`admin` layer.
