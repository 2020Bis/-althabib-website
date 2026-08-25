-- ==========================================================================
-- AL-THABIB MEDICAL SUPPLIES — Database Schema (MySQL 8+)
-- Run this once against your database, e.g.:
--   mysql -u root -p althabib_db < db/schema.sql
-- ==========================================================================

CREATE TABLE IF NOT EXISTS products (
  id            VARCHAR(40) PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  category      ENUM('equipment','drugs','consumables') NOT NULL,
  sku           VARCHAR(60),
  description   TEXT,
  price         DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit          VARCHAR(60) NOT NULL DEFAULT 'unit',
  stock         INT NOT NULL DEFAULT 0,
  image_url     VARCHAR(500) DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quotes (
  id              VARCHAR(40) PRIMARY KEY,
  type            ENUM('quote','consultation') NOT NULL,
  customer_name   VARCHAR(255) NOT NULL,
  customer_org    VARCHAR(255),
  customer_phone  VARCHAR(60),
  customer_email  VARCHAR(255),
  customer_notes  TEXT,
  total           DECIMAL(12,2) DEFAULT 0,
  status          ENUM('paid','unpaid') DEFAULT 'unpaid',
  channel         VARCHAR(30),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quote_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  quote_id    VARCHAR(40) NOT NULL,
  product_id  VARCHAR(40),
  name        VARCHAR(255),
  price       DECIMAL(12,2),
  qty         INT,
  unit        VARCHAR(60),
  category    VARCHAR(30),
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  id                   INT PRIMARY KEY DEFAULT 1,
  admin_password_hash  VARCHAR(255) NOT NULL,
  CONSTRAINT single_row CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
