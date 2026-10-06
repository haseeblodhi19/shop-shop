const express = require('express');
const XLSX = require('xlsx');

function sendExcel(res, filename, sheets) {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, rows] of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  }
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
// Thin shim so the rest of this file (written against node:sqlite's
// DatabaseSync API) keeps working unchanged against better-sqlite3, which is
// a mature, widely-used native module (unlike node:sqlite, which is still
// experimental and has been unreliable inside some packaged Electron apps).
function DatabaseSync(path, opts) {
  return new Database(path, opts && opts.readOnly ? { readonly: true } : undefined);
}
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const rootDir = __dirname;
// Business data lives outside the application folder so updates/reinstalls do not overwrite it.
// On Windows this resolves to C:\ProgramData\SHOP-ERP; on other platforms use the user's local data directory.
const appDataDir = process.platform === 'win32'
  ? path.join(process.env.ProgramData || path.join(process.env.ALLUSERSPROFILE || 'C:\ProgramData'), 'SHOP-ERP')
  : path.join(process.env.XDG_DATA_HOME || path.join(process.env.HOME || rootDir, '.local', 'share'), 'SHOP-ERP');
const dataDir = path.join(appDataDir, 'database');
const backupDir = path.join(appDataDir, 'backups');
const dailyBackupDir = path.join(backupDir, 'daily');
const manualBackupDir = path.join(backupDir, 'manual');
const pendingRestorePath = path.join(dataDir, 'pending_restore.db');
const dbPath = path.join(dataDir, 'shop.db');

for (const dir of [dataDir, backupDir, dailyBackupDir, manualBackupDir]) fs.mkdirSync(dir, { recursive: true });

// One-time migration from the old project-local data folder. Existing client data wins.
const legacyDbPath = path.join(rootDir, 'data', 'shop.db');
if (!fs.existsSync(dbPath) && fs.existsSync(legacyDbPath)) {
  fs.copyFileSync(legacyDbPath, dbPath);
}

// A restore is staged and applied only on process startup, avoiding corruption while SQLite is open.
if (fs.existsSync(pendingRestorePath)) {
  try {
    const testDb = new DatabaseSync(pendingRestorePath, { readOnly: true });
    const valid = !!testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
    testDb.close();
    if (valid) {
      const restoreBackup = path.join(manualBackupDir, `before-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
      if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, restoreBackup);
      fs.renameSync(pendingRestorePath, dbPath);
    } else {
      fs.unlinkSync(pendingRestorePath);
    }
  } catch (error) {
    try { fs.unlinkSync(pendingRestorePath); } catch {}
    console.error('Pending database restore rejected:', error.message);
  }
}

const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function snapshotDatabase(destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temp = `${destination}.tmp`;
  try {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
    db.exec(`VACUUM INTO '${temp.replace(/'/g, "''")}'`);
    fs.renameSync(temp, destination);
    return destination;
  } catch (error) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch {}
    throw error;
  }
}

function createDailyBackup() {
  const stamp = new Date().toISOString().slice(0, 10);
  const destination = path.join(dailyBackupDir, `${stamp}.db`);
  if (!fs.existsSync(destination)) snapshotDatabase(destination);
}

try { createDailyBackup(); } catch (error) { console.error('Daily backup failed:', error.message); }
setInterval(() => { try { createDailyBackup(); } catch (error) { console.error('Scheduled daily backup failed:', error.message); } }, 60 * 60 * 1000).unref();

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toCurrency(value) {
  return Number(value || 0).toFixed(2);
}

function createInvoiceNumber(prefix = 'INV', table = 'sales') {
  const allowedTables = new Set(['sales', 'purchases']);
  const source = allowedTables.has(table) ? table : 'sales';
  const invoices = db.prepare(`SELECT invoice_number FROM ${source} WHERE invoice_number LIKE ?`).all(`${prefix}-%`);
  const lastNumber = invoices.reduce((highest, row) => {
    const match = String(row.invoice_number || '').match(new RegExp(`^${prefix}-(\\d+)$`));
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `${prefix}-${String(lastNumber + 1).padStart(4, '0')}`;
}

function recordStockMovement(product, movementType, quantity, unit, reference = '') {
  db.prepare(`INSERT INTO stock_movements (id, product_id, product_name, movement_type, quantity, unit, reference)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), product.id, product.name, movementType, quantity, unit || product.base_unit || product.unit || 'pcs', reference);
}

function resolvePaymentAllocation(payload, total, defaultMethod = 'Cash', legacyDefaultPaid = 0) {
  const hasCash = Object.prototype.hasOwnProperty.call(payload, 'cash_paid');
  const hasBank = Object.prototype.hasOwnProperty.call(payload, 'bank_paid');
  if (hasCash || hasBank) {
    const cash = safeNumber(payload.cash_paid);
    const bank = safeNumber(payload.bank_paid);
    if (cash < 0 || bank < 0 || cash + bank > total) throw new Error('Cash and bank payments cannot exceed the total amount');
    const method = cash > 0 && bank > 0 ? 'Split' : bank > 0 ? 'Bank' : cash > 0 ? 'Cash' : 'Credit';
    return { cash, bank, paid: cash + bank, method };
  }
  const method = String(payload.payment_method || defaultMethod);
  const requested = payload.paid_amount === undefined ? legacyDefaultPaid : safeNumber(payload.paid_amount);
  const paid = Math.min(total, Math.max(0, requested));
  if (method === 'Split') throw new Error('Enter the cash and bank amounts separately for a split payment');
  return {
    cash: ['Cash', 'Credit'].includes(method) ? paid : 0,
    bank: ['Bank', 'Online'].includes(method) ? paid : 0,
    paid,
    method: method === 'Online' ? 'Bank' : method
  };
}

function syncStockSupplierEntry(entry, direction) {
  if (!entry.supplier_id) return;
  const total = safeNumber(entry.total_cost);
  const cashPaid = safeNumber(entry.cash_paid);
  const bankPaid = safeNumber(entry.bank_paid);
  const paid = cashPaid + bankPaid;
  const due = total - paid;
  const reference = `STOCK-IN-${entry.id}`;
  db.prepare('UPDATE suppliers SET total_purchases=total_purchases+?, total_paid=total_paid+?, remaining_payable=remaining_payable+? WHERE id=?')
    .run(direction * total, direction * paid, direction * due, entry.supplier_id);
  if (direction < 0) {
    db.prepare('DELETE FROM supplier_transactions WHERE supplier_id=? AND reference=?').run(entry.supplier_id, reference);
    return;
  }
  db.prepare(`INSERT INTO supplier_transactions (id,supplier_id,type,amount,reference,payment_method,notes) VALUES (?,?,'purchase',?,?,?,'Stock-in purchase')`)
    .run(uuidv4(), entry.supplier_id, total, reference, entry.payment_method || 'Cash');
  if (cashPaid > 0) db.prepare(`INSERT INTO supplier_transactions (id,supplier_id,type,amount,reference,payment_method,notes) VALUES (?,?,'payment',?,?,'Cash','Cash paid with stock-in')`)
    .run(uuidv4(), entry.supplier_id, cashPaid, reference);
  if (bankPaid > 0) db.prepare(`INSERT INTO supplier_transactions (id,supplier_id,type,amount,reference,payment_method,notes) VALUES (?,?,'payment',?,?,'Bank','Bank paid with stock-in')`)
    .run(uuidv4(), entry.supplier_id, bankPaid, reference);
}

function syncStockBankEntry(entry, direction) {
  const reference = `STOCK-IN-${entry.id}`;
  if (direction < 0) {
    db.prepare("DELETE FROM bank_transactions WHERE kind='stock_in' AND reference=?").run(reference);
    return;
  }
  if (safeNumber(entry.bank_paid) > 0) addBankTxn({ direction: 'out', kind: 'stock_in', amount: entry.bank_paid, reference, notes: 'Bank stock-in payment', date: entry.entry_date });
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
}

function setSessionCookie(response, token, maxAge) {
  response.setHeader('Set-Cookie', `shop_session=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`);
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      shop_name TEXT DEFAULT 'ShopFlow Pro',
      shop_phone TEXT DEFAULT '',
      shop_address TEXT DEFAULT '',
      receipt_footer TEXT DEFAULT 'Thank you for shopping with us!',
      printer_name TEXT DEFAULT '',
      whatsapp_template TEXT DEFAULT 'Assalam o Alaikum {name}, aapka account balance {balance} hai. Meharbani karke payment update kar dein. Shukriya.'
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      name TEXT,
      role TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      barcode TEXT,
      name TEXT,
      category TEXT,
      subcategory TEXT,
      brand TEXT,
      unit TEXT,
      base_unit TEXT DEFAULT 'pcs',
      purchase_unit TEXT DEFAULT 'pcs',
      sale_unit TEXT DEFAULT 'pcs',
      purchase_factor REAL DEFAULT 1,
      purchase_price REAL DEFAULT 0,
      retail_price REAL DEFAULT 0,
      wholesale_price REAL DEFAULT 0,
      wholesale_level_1 REAL DEFAULT 0,
      wholesale_level_2 REAL DEFAULT 0,
      wholesale_level_3 REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      current_stock REAL DEFAULT 0,
      supplier_id TEXT,
      expiry_date TEXT,
      batch_no TEXT,
      image TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      address TEXT,
      type TEXT,
      credit_limit REAL DEFAULT 0,
      opening_balance REAL DEFAULT 0,
      total_purchases REAL DEFAULT 0,
      total_paid REAL DEFAULT 0,
      remaining_balance REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      address TEXT,
      opening_balance REAL DEFAULT 0,
      total_purchases REAL DEFAULT 0,
      total_paid REAL DEFAULT 0,
      remaining_payable REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      invoice_number TEXT,
      supplier_id TEXT,
      supplier_name TEXT,
      date TEXT,
      total_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      cash_paid REAL DEFAULT 0,
      bank_paid REAL DEFAULT 0,
      remaining_amount REAL DEFAULT 0,
      payment_method TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT,
      product_id TEXT,
      product_name TEXT,
      quantity REAL DEFAULT 0,
      conversion_factor REAL DEFAULT 1,
      unit_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      invoice_number TEXT,
      sale_type TEXT,
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      payment_method TEXT,
      cash_paid REAL DEFAULT 0,
      bank_paid REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      remaining_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      cost_total REAL DEFAULT 0,
      profit_total REAL DEFAULT 0,
      profit_margin REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT,
      product_id TEXT,
      product_name TEXT,
      quantity REAL DEFAULT 0,
      conversion_factor REAL DEFAULT 1,
      cost_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      total_profit REAL DEFAULT 0,
      profit_margin REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      name TEXT,
      category TEXT,
      amount REAL DEFAULT 0,
      date TEXT,
      payment_method TEXT,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      name TEXT,
      capital REAL DEFAULT 0,
      ownership_pct REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      withdrawals REAL DEFAULT 0,
      advances REAL DEFAULT 0,
      profit_share REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS partner_transactions (
      id TEXT PRIMARY KEY,
      partner_id TEXT,
      type TEXT,
      amount REAL DEFAULT 0,
      reason TEXT,
      payment_method TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customer_transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL DEFAULT 0,
      reference TEXT,
      payment_method TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS supplier_transactions (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL DEFAULT 0,
      reference TEXT,
      payment_method TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customer_payment_allocations (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      sale_id TEXT NOT NULL,
      amount REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS supplier_payment_allocations (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      entry_id TEXT NOT NULL,
      amount REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_name TEXT,
      action TEXT,
      entity TEXT,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_entries (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      unit TEXT NOT NULL,
      conversion_factor REAL DEFAULT 1,
      base_quantity REAL DEFAULT 0,
      unit_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      supplier_id TEXT,
      paid_amount REAL DEFAULT 0,
      cash_paid REAL DEFAULT 0,
      bank_paid REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'Cash',
      reference TEXT,
      expiry_date TEXT,
      update_rate INTEGER DEFAULT 0,
      entry_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      unit TEXT NOT NULL,
      reference TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_articles (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      package_type TEXT DEFAULT 'Loose',
      package_size REAL DEFAULT 1,
      base_unit TEXT DEFAULT 'pcs',
      barcode TEXT,
      purchase_price REAL DEFAULT 0,
      retail_price REAL DEFAULT 0,
      wholesale_price REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      stock_qty REAL DEFAULT 0,
      base_per_unit REAL DEFAULT 1,
      expiry_date TEXT,
      batch_no TEXT,
      status TEXT DEFAULT 'active',
      parent_article_id TEXT,
      level_no INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS stock_conversions (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      from_article_id TEXT,
      to_article_id TEXT,
      from_qty REAL DEFAULT 0,
      to_qty REAL DEFAULT 0,
      base_qty REAL DEFAULT 0,
      type TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const productColumns = db.prepare("PRAGMA table_info(products)").all().map((column) => column.name);
  if (!productColumns.includes('stock_unit')) db.exec("ALTER TABLE products ADD COLUMN stock_unit TEXT DEFAULT 'pcs'");
  if (!productColumns.includes('unit_factor')) db.exec('ALTER TABLE products ADD COLUMN unit_factor REAL DEFAULT 1');
  if (!productColumns.includes('subcategory')) db.exec("ALTER TABLE products ADD COLUMN subcategory TEXT DEFAULT ''");
  if (!productColumns.includes('base_unit')) db.exec("ALTER TABLE products ADD COLUMN base_unit TEXT DEFAULT 'pcs'");
  if (!productColumns.includes('purchase_unit')) db.exec("ALTER TABLE products ADD COLUMN purchase_unit TEXT DEFAULT 'pcs'");
  if (!productColumns.includes('sale_unit')) db.exec("ALTER TABLE products ADD COLUMN sale_unit TEXT DEFAULT 'pcs'");
  if (!productColumns.includes('purchase_factor')) db.exec('ALTER TABLE products ADD COLUMN purchase_factor REAL DEFAULT 1');

  const stockColumns = db.prepare("PRAGMA table_info(stock_entries)").all().map((column) => column.name);
  if (!stockColumns.includes('expiry_date')) db.exec('ALTER TABLE stock_entries ADD COLUMN expiry_date TEXT');
  if (!stockColumns.includes('update_rate')) db.exec('ALTER TABLE stock_entries ADD COLUMN update_rate INTEGER DEFAULT 0');
  if (!stockColumns.includes('paid_amount')) db.exec('ALTER TABLE stock_entries ADD COLUMN paid_amount REAL DEFAULT 0');
  if (!stockColumns.includes('cash_paid')) db.exec('ALTER TABLE stock_entries ADD COLUMN cash_paid REAL DEFAULT 0');
  if (!stockColumns.includes('bank_paid')) db.exec('ALTER TABLE stock_entries ADD COLUMN bank_paid REAL DEFAULT 0');
  if (!stockColumns.includes('payment_method')) db.exec("ALTER TABLE stock_entries ADD COLUMN payment_method TEXT DEFAULT 'Cash'");
  const purchaseColumns = db.prepare("PRAGMA table_info(purchases)").all().map((column) => column.name);
  if (!purchaseColumns.includes('cash_paid')) db.exec('ALTER TABLE purchases ADD COLUMN cash_paid REAL DEFAULT 0');
  if (!purchaseColumns.includes('bank_paid')) db.exec('ALTER TABLE purchases ADD COLUMN bank_paid REAL DEFAULT 0');
  const paymentSaleColumns = db.prepare("PRAGMA table_info(sales)").all().map((column) => column.name);
  if (!paymentSaleColumns.includes('cash_paid')) db.exec('ALTER TABLE sales ADD COLUMN cash_paid REAL DEFAULT 0');
  if (!paymentSaleColumns.includes('bank_paid')) db.exec('ALTER TABLE sales ADD COLUMN bank_paid REAL DEFAULT 0');
  db.exec(`
    UPDATE purchases SET cash_paid=paid_amount WHERE cash_paid=0 AND bank_paid=0 AND payment_method='Cash' AND paid_amount>0;
    UPDATE purchases SET bank_paid=paid_amount WHERE cash_paid=0 AND bank_paid=0 AND payment_method IN ('Bank','Online') AND paid_amount>0;
    UPDATE sales SET cash_paid=paid_amount WHERE cash_paid=0 AND bank_paid=0 AND payment_method='Cash' AND paid_amount>0;
    UPDATE sales SET bank_paid=paid_amount WHERE cash_paid=0 AND bank_paid=0 AND payment_method IN ('Bank','Online') AND paid_amount>0;
    UPDATE stock_entries SET cash_paid=paid_amount WHERE cash_paid=0 AND bank_paid=0 AND payment_method='Cash' AND paid_amount>0;
    UPDATE stock_entries SET bank_paid=paid_amount WHERE cash_paid=0 AND bank_paid=0 AND payment_method IN ('Bank','Online') AND paid_amount>0;
  `);

  const saleItemColumns = db.prepare("PRAGMA table_info(sale_items)").all().map((column) => column.name);
  if (!saleItemColumns.includes('discount_percent')) db.exec('ALTER TABLE sale_items ADD COLUMN discount_percent REAL DEFAULT 0');
  if (!saleItemColumns.includes('conversion_factor')) db.exec('ALTER TABLE sale_items ADD COLUMN conversion_factor REAL DEFAULT 1');

  const saleColumns = db.prepare("PRAGMA table_info(sales)").all().map((column) => column.name);
  if (!saleColumns.includes('sale_date')) {
    db.exec("ALTER TABLE sales ADD COLUMN sale_date TEXT");
    db.exec("UPDATE sales SET sale_date = date(created_at) WHERE sale_date IS NULL");
  }
  if (!saleColumns.includes('notes')) db.exec("ALTER TABLE sales ADD COLUMN notes TEXT DEFAULT ''");

  const articleSaleColumns = db.prepare("PRAGMA table_info(sale_items)").all().map((column) => column.name);
  if (!articleSaleColumns.includes('article_id')) db.exec('ALTER TABLE sale_items ADD COLUMN article_id TEXT');
  if (!articleSaleColumns.includes('no_receipt')) db.exec('ALTER TABLE sale_items ADD COLUMN no_receipt INTEGER DEFAULT 0');
  const articlePurchaseColumns = db.prepare("PRAGMA table_info(purchase_items)").all().map((column) => column.name);
  if (!articlePurchaseColumns.includes('article_id')) db.exec('ALTER TABLE purchase_items ADD COLUMN article_id TEXT');
  const articleStockColumns = db.prepare("PRAGMA table_info(stock_entries)").all().map((column) => column.name);
  if (!articleStockColumns.includes('article_id')) db.exec('ALTER TABLE stock_entries ADD COLUMN article_id TEXT');
  const productArticleColumns = db.prepare("PRAGMA table_info(product_articles)").all().map((column) => column.name);
  if (!productArticleColumns.includes('parent_article_id')) db.exec('ALTER TABLE product_articles ADD COLUMN parent_article_id TEXT');
  if (!productArticleColumns.includes('level_no')) db.exec('ALTER TABLE product_articles ADD COLUMN level_no INTEGER DEFAULT 1');
  if (!productArticleColumns.includes('wholesale_level_1')) db.exec('ALTER TABLE product_articles ADD COLUMN wholesale_level_1 REAL DEFAULT 0');
  if (!productArticleColumns.includes('wholesale_level_2')) db.exec('ALTER TABLE product_articles ADD COLUMN wholesale_level_2 REAL DEFAULT 0');
  if (!productArticleColumns.includes('wholesale_level_3')) db.exec('ALTER TABLE product_articles ADD COLUMN wholesale_level_3 REAL DEFAULT 0');

  db.exec(`CREATE TABLE IF NOT EXISTS app_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  if (!db.prepare("SELECT 1 FROM app_migrations WHERE name='article-stock-backfill-v1'").get()) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const articleRows = db.prepare(`
        SELECT a.id, a.product_id, a.base_per_unit, a.stock_qty,
          COALESCE((SELECT SUM(quantity) FROM stock_entries WHERE article_id=a.id),0)
          + COALESCE((SELECT SUM(quantity) FROM purchase_items WHERE article_id=a.id),0)
          - COALESCE((SELECT SUM(quantity) FROM sale_items WHERE article_id=a.id),0)
          + COALESCE((SELECT SUM(to_qty) FROM stock_conversions WHERE to_article_id=a.id),0)
          - COALESCE((SELECT SUM(from_qty) FROM stock_conversions WHERE from_article_id=a.id),0) AS traced_stock
        FROM product_articles a WHERE a.status='active'
      `).all();
      const updateArticleStock = db.prepare('UPDATE product_articles SET stock_qty=? WHERE id=?');
      const productArticleCounts = new Map();
      for (const article of articleRows) {
        productArticleCounts.set(article.product_id, (productArticleCounts.get(article.product_id) || 0) + 1);
      }
      for (const article of articleRows) {
        const tracedStock = Math.max(0, safeNumber(article.traced_stock));
        if (tracedStock > 0) {
          updateArticleStock.run(tracedStock, article.id);
          continue;
        }
        const storedStock = Math.max(0, safeNumber(article.stock_qty));
        if (storedStock > 0) continue;
        const product = db.prepare('SELECT current_stock FROM products WHERE id=?').get(article.product_id);
        if (!product || productArticleCounts.get(article.product_id) !== 1) continue;
        const factor = safeNumber(article.base_per_unit) || 1;
        updateArticleStock.run(Math.max(0, safeNumber(product.current_stock) / factor), article.id);
      }
      db.prepare("INSERT INTO app_migrations (name) VALUES ('article-stock-backfill-v1')").run();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  const userColumns = db.prepare("PRAGMA table_info(users)").all().map((column) => column.name);
  if (!userColumns.includes('partner_id')) db.exec('ALTER TABLE users ADD COLUMN partner_id TEXT');

  // Migrate existing simple products into a default article without changing their stock totals.
  const allProductsForArticles = db.prepare('SELECT * FROM products').all();
  const articleInsert = db.prepare(`INSERT INTO product_articles (id, product_id, name, package_type, package_size, base_unit, barcode, purchase_price, retail_price, wholesale_price, min_stock, stock_qty, base_per_unit, expiry_date, batch_no, status, parent_article_id, level_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const pr of allProductsForArticles) {
    const hasArticle = db.prepare('SELECT 1 FROM product_articles WHERE product_id = ? LIMIT 1').get(pr.id);
    if (!hasArticle) {
      const factor = safeNumber(pr.unit_factor) || 1;
      const isLoose = ['kg','g','gram','ltr','liter','litre'].includes(String(pr.base_unit || pr.unit || '').toLowerCase());
      articleInsert.run(uuidv4(), pr.id, pr.name, isLoose ? 'Loose' : 'Piece', factor, pr.base_unit || pr.unit || 'pcs', pr.barcode || null, pr.purchase_price || 0, pr.retail_price || 0, pr.wholesale_price || 0, pr.min_stock || 0, isLoose ? pr.current_stock : (factor ? pr.current_stock / factor : pr.current_stock), factor, pr.expiry_date || null, pr.batch_no || null, pr.status || 'active', null, 1);
    }
  }

  db.prepare("DELETE FROM partners WHERE name IN ('Partner 1', 'Partner 2') AND capital = 100000").run();
  db.prepare("DELETE FROM customers WHERE name = 'Walkin Customer' AND phone = '0000000000'").run();
  db.prepare("DELETE FROM suppliers WHERE name = 'Main Supplier' AND phone = '03001234567'").run();
}

initDatabase();
db.exec(`INSERT OR IGNORE INTO app_settings (id) VALUES ('default')`);

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use((req, res, next) => {
  if (!req.path.startsWith('/api') || ['/api/health', '/api/login', '/api/session', '/api/setup/status', '/api/setup'].includes(req.path)) return next();
  const token = parseCookies(req).shop_session;
  const session = token ? db.prepare('SELECT users.id, users.username, users.name, users.role FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > datetime(\'now\')').get(crypto.createHash('sha256').update(token).digest('hex')) : null;
  if (!session) return res.status(401).json({ ok: false, message: 'Your session has expired. Please sign in again.' });
  req.user = session;
  next();
});

// Role-based access control. Super admin/admin bypass everything.
// Cashier = billing only (per spec). Manager = sales/purchases/inventory/reports
// but not users, partners, settings or profit distribution.
const ROLE_RULES = [
  // { methods, pathTest, allow }  — allow lists roles permitted; admin/super_admin always pass.
  { methods: ['POST', 'PUT', 'DELETE'], pathTest: p => p.startsWith('/api/products'), allow: ['manager'] },
  { methods: ['POST', 'PUT', 'DELETE'], pathTest: p => p.startsWith('/api/suppliers'), allow: ['manager'] },
  { methods: ['POST', 'DELETE'], pathTest: p => p.startsWith('/api/expenses'), allow: ['manager'] },
  { methods: ['POST', 'PUT', 'DELETE'], pathTest: p => p.startsWith('/api/stock'), allow: ['manager'] },
  { methods: ['POST', 'PUT', 'DELETE'], pathTest: p => p.startsWith('/api/purchases'), allow: ['manager'] },
  { methods: ['PUT', 'DELETE'], pathTest: p => p.startsWith('/api/sales'), allow: ['manager'] },
  { methods: ['GET'], pathTest: p => p.startsWith('/api/reports'), allow: ['manager'] },
  { methods: ['POST'], pathTest: p => p.startsWith('/api/barcodes'), allow: ['manager'] }
];
app.use((req, res, next) => {
  if (!req.user) return next();
  if (req.user.role === 'admin' || req.user.role === 'super_admin') return next();
  const rule = ROLE_RULES.find(r => r.methods.includes(req.method) && r.pathTest(req.path));
  if (rule && !rule.allow.includes(req.user.role)) {
    return res.status(403).json({ ok: false, message: 'Aap ke role (cashier) ko ye action karne ki ijazat nahi hai. Manager/Admin se rabta karein.' });
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Shop management system is running' });
});

function isLocalSetupRequest(req) {
  const localAddresses = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  const localHosts = [`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`];
  const localOrigins = [`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`, `http://[::1]:${PORT}`];
  const origin = req.get('origin');
  return localAddresses.includes(req.socket.remoteAddress)
    && localHosts.includes(String(req.get('host') || '').toLowerCase())
    && (!origin || localOrigins.includes(origin));
}

app.get('/api/setup/status', (req, res) => {
  if (!isLocalSetupRequest(req)) return res.status(403).json({ ok: false, message: 'Initial setup is only available from this computer.' });
  const userExists = !!db.prepare('SELECT 1 FROM users LIMIT 1').get();
  res.json({ ok: true, setupRequired: !userExists });
});

app.post('/api/setup', (req, res) => {
  if (!isLocalSetupRequest(req)) return res.status(403).json({ ok: false, message: 'Initial setup is only available from this computer.' });

  const payload = req.body || {};
  const username = typeof payload.username === 'string' ? payload.username.trim() : '';
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ ok: false, message: 'Username must be between 3 and 50 characters.' });
  }
  if (name.length < 1 || name.length > 100) {
    return res.status(400).json({ ok: false, message: 'Name is required and must be 100 characters or fewer.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ ok: false, message: 'Password must be between 8 and 128 characters.' });
  }

  const createFirstAdmin = db.transaction(() => {
    if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) return false;
    db.prepare('INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), username, password, name, 'super_admin');
    return true;
  });

  if (!createFirstAdmin()) {
    return res.status(409).json({ ok: false, message: 'Initial setup is already complete. Please sign in.' });
  }
  res.status(201).json({ ok: true, message: 'Administrator account created. Sign in to continue.' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);

  if (!user) {
    return res.status(401).json({ ok: false, message: 'Invalid username or password' });
  }

  const responseUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role
  };

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const maxAge = req.body.remember_me ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
  db.prepare('DELETE FROM auth_sessions WHERE user_id = ? OR expires_at <= datetime(\'now\')').run(user.id);
  db.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime(\'now\', ?))').run(tokenHash, user.id, `+${maxAge} seconds`);
  setSessionCookie(res, token, maxAge);
  return res.json({ ok: true, user: responseUser });
});

app.get('/api/session', (req, res) => {
  const token = parseCookies(req).shop_session;
  const session = token ? db.prepare('SELECT users.id, users.username, users.name, users.role FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > datetime(\'now\')').get(crypto.createHash('sha256').update(token).digest('hex')) : null;
  if (!session) return res.json({ ok: false, message: 'No active session' });
  res.json({ ok: true, user: session });
});

app.post('/api/logout', (req, res) => {
  const token = parseCookies(req).shop_session;
  if (token) db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(crypto.createHash('sha256').update(token).digest('hex'));
  res.setHeader('Set-Cookie', 'shop_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax');
  res.json({ ok: true });
});

app.get('/api/dashboard', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const todaySales = db.prepare("SELECT COALESCE(SUM(total_amount),0) AS total, COALESCE(SUM(paid_amount),0) AS paid FROM sales WHERE date(COALESCE(sale_date, created_at), '+0 hours') = date('now', '+5 hours')").get();
  const retailSales = db.prepare("SELECT COALESCE(SUM(total_amount),0) AS total FROM sales WHERE sale_type = 'retail' AND date(COALESCE(sale_date, created_at)) = date('now', '+5 hours')").get();
  const wholesaleSales = db.prepare("SELECT COALESCE(SUM(total_amount),0) AS total FROM sales WHERE sale_type = 'wholesale' AND date(COALESCE(sale_date, created_at)) = date('now', '+5 hours')").get();
  const purchaseTotal = db.prepare("SELECT COALESCE(SUM(total_amount),0) AS total, COALESCE(SUM(paid_amount),0) AS paid FROM purchases WHERE date(COALESCE(date,created_at), '+5 hours') = date('now', '+5 hours')").get();
  const expenseTotal = db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE date = date('now', '+5 hours')").get();
  const productValue = db.prepare('SELECT COALESCE(SUM(current_stock * purchase_price),0) AS total FROM products').get();
  const receivables = db.prepare('SELECT COALESCE(SUM(remaining_balance),0) AS total FROM customers').get();
  const payables = db.prepare('SELECT COALESCE(SUM(remaining_payable),0) AS total FROM suppliers').get();
  const bankBalance = db.prepare(`
    SELECT COALESCE(SUM(a.opening_balance
      + COALESCE((SELECT SUM(amount) FROM bank_transactions t WHERE t.account_id = a.id AND t.direction = 'in'), 0)
      - COALESCE((SELECT SUM(amount) FROM bank_transactions t WHERE t.account_id = a.id AND t.direction = 'out'), 0)), 0) AS total
    FROM bank_accounts a
  `).get();
  const partnerBalances = db.prepare('SELECT COALESCE(SUM(current_balance),0) AS total FROM partners').get();
  const withdrawals = db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM partner_transactions WHERE type = 'withdrawal' AND date(created_at, '+5 hours') = date('now', '+5 hours')").get();
  const advances = db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM partner_transactions WHERE type = 'advance' AND date(created_at, '+5 hours') = date('now', '+5 hours')").get();
  const cashSales = db.prepare(`SELECT COALESCE(SUM(MAX(0,s.cash_paid-COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa
    JOIN customer_transactions ct ON ct.id=cpa.transaction_id WHERE cpa.sale_id=s.id AND ct.payment_method='Cash'),0))),0) AS total
    FROM sales s WHERE date(COALESCE(s.sale_date,s.created_at), '+5 hours') = date('now', '+5 hours')`).get();
  const cashPurchases = db.prepare(`SELECT COALESCE(SUM(MAX(0,p.cash_paid-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
    JOIN supplier_transactions st ON st.id=spa.transaction_id WHERE spa.entry_type='purchase' AND spa.entry_id=p.id AND st.payment_method='Cash'),0))),0) AS total
    FROM purchases p WHERE date(COALESCE(p.date,p.created_at), '+5 hours') = date('now', '+5 hours')`).get();
  const cashStockEntries = db.prepare(`SELECT COALESCE(SUM(MAX(0,se.cash_paid-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
    JOIN supplier_transactions st ON st.id=spa.transaction_id WHERE spa.entry_type='stock' AND spa.entry_id=se.id AND st.payment_method='Cash'),0))),0) AS total
    FROM stock_entries se WHERE date(se.entry_date) = date('now', '+5 hours')`).get();
  const cashExpenses = db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE payment_method = 'Cash' AND date = date('now', '+5 hours')").get();
  const cashWithdrawals = db.prepare("SELECT COALESCE(SUM(CASE WHEN type='capital_adjustment' THEN ABS(amount) ELSE amount END),0) AS total FROM partner_transactions WHERE (type IN ('withdrawal','advance') OR (type='capital_adjustment' AND amount<0)) AND payment_method = 'Cash' AND date(created_at, '+5 hours') = date('now', '+5 hours')").get();
  const cashPartnerContributions = db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM partner_transactions WHERE (type='capital_contribution' OR (type='capital_adjustment' AND amount>0)) AND payment_method = 'Cash' AND date(created_at, '+5 hours') = date('now', '+5 hours')").get();
  const cashCustomerPayments = db.prepare(`SELECT COALESCE(SUM(ct.amount),0) AS total FROM customer_transactions ct
    WHERE ct.type = 'payment' AND ct.payment_method = 'Cash' AND date(ct.created_at, '+5 hours') = date('now', '+5 hours')
    AND NOT (EXISTS (SELECT 1 FROM sales s WHERE s.invoice_number = ct.reference)
      AND (ct.notes LIKE '%paid with sale%' OR ct.notes LIKE '%payment for invoice%'))`).get();
  const cashSupplierPayments = db.prepare(`SELECT COALESCE(SUM(st.amount),0) AS total FROM supplier_transactions st
    WHERE st.type = 'payment' AND st.payment_method = 'Cash' AND date(st.created_at, '+5 hours') = date('now', '+5 hours')
    AND NOT ((EXISTS (SELECT 1 FROM purchases p WHERE p.invoice_number = st.reference) AND st.notes LIKE '%paid with purchase%')
      OR (EXISTS (SELECT 1 FROM stock_entries se WHERE 'STOCK-IN-' || se.id = st.reference) AND st.notes LIKE '%paid with stock-in%'))`).get();
  const cashAdvanceRepayments = db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM partner_transactions WHERE type = 'advance_repayment' AND payment_method = 'Cash' AND date(created_at, '+5 hours') = date('now', '+5 hours')").get();
  const todayCOGS = db.prepare("SELECT COALESCE(SUM(cost_total),0) AS total FROM sales WHERE date(COALESCE(sale_date,created_at), '+5 hours') = date('now', '+5 hours')").get();

  const lowStock = db.prepare('SELECT * FROM products WHERE current_stock <= min_stock ORDER BY current_stock ASC LIMIT 8').all();
  const expiring = db.prepare("SELECT * FROM products WHERE expiry_date IS NOT NULL AND expiry_date <= date('now', '+30 days') ORDER BY expiry_date ASC LIMIT 8").all();
  const recentSales = db.prepare('SELECT * FROM sales ORDER BY created_at DESC LIMIT 8').all();

  const salesByDay = db.prepare(`
    SELECT strftime('%d', created_at) as day, SUM(total_amount) as total
    FROM sales
    WHERE created_at >= datetime('now','-6 days')
    GROUP BY strftime('%Y-%m-%d', created_at)
    ORDER BY created_at ASC
  `).all();

  const monthlySales = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as period, SUM(total_amount) as total
    FROM sales
    WHERE created_at >= datetime('now','-11 months')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY period ASC
  `).all();

  const profitByDay = db.prepare(`
    SELECT strftime('%d', created_at) as day, SUM(profit_total) as total
    FROM sales
    WHERE created_at >= datetime('now','-6 days')
    GROUP BY strftime('%Y-%m-%d', created_at)
    ORDER BY created_at ASC
  `).all();

  const retailVsWholesaleByDay = db.prepare(`
    SELECT strftime('%d', created_at) as day, sale_type,
      SUM(total_amount) as total
    FROM sales
    WHERE created_at >= datetime('now','-6 days')
    GROUP BY strftime('%Y-%m-%d', created_at), sale_type
    ORDER BY created_at ASC
  `).all();
  const rwDays = [...new Set(retailVsWholesaleByDay.map(r => r.day))];
  const retailByDay = rwDays.map(day => ({ day, total: retailVsWholesaleByDay.find(r => r.day === day && r.sale_type === 'retail')?.total || 0 }));
  const wholesaleByDay = rwDays.map(day => ({ day, total: retailVsWholesaleByDay.find(r => r.day === day && r.sale_type === 'wholesale')?.total || 0 }));

  const expensesByCategory = db.prepare(`
    SELECT category as day, SUM(amount) as total
    FROM expenses
    WHERE date >= date('now','-29 days')
    GROUP BY category
    ORDER BY total DESC
    LIMIT 8
  `).all();

  const purchaseTrend = db.prepare(`
    SELECT strftime('%d', created_at) as day, SUM(total_amount) as total
    FROM purchases
    WHERE created_at >= datetime('now','-6 days')
    GROUP BY strftime('%Y-%m-%d', created_at)
    ORDER BY created_at ASC
  `).all();

  const dailyProfit = db.prepare(`
    SELECT COALESCE(SUM(profit_total),0) AS total
    FROM sales
    WHERE date(COALESCE(sale_date,created_at), '+5 hours') = date('now', '+5 hours')
  `).get();
  const inventoryStats = db.prepare('SELECT COUNT(*) AS products, COALESCE(SUM(current_stock * purchase_price), 0) AS value, SUM(CASE WHEN current_stock <= min_stock THEN 1 ELSE 0 END) AS low_stock, SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) AS out_of_stock FROM products').get();
  const stockInToday = db.prepare("SELECT COALESCE(SUM(quantity), 0) AS total FROM stock_movements WHERE movement_type = 'PURCHASE' AND date(created_at) = date('now')").get();
  const stockOutToday = db.prepare("SELECT COALESCE(SUM(ABS(quantity)), 0) AS total FROM stock_movements WHERE movement_type = 'SALE' AND date(created_at) = date('now')").get();

  // Gross profit comes from actual COGS stored on each invoice, not today's purchases.
  const grossProfit = safeNumber(todaySales.total) - safeNumber(todayCOGS.total);
  const netProfit = grossProfit - safeNumber(expenseTotal.total);
  const cashInHand = safeNumber(cashSales.total) + safeNumber(cashCustomerPayments.total) + safeNumber(cashAdvanceRepayments.total) +
    safeNumber(cashPartnerContributions.total) - safeNumber(cashPurchases.total) - safeNumber(cashStockEntries.total) -
    safeNumber(cashSupplierPayments.total) - safeNumber(cashExpenses.total) - safeNumber(cashWithdrawals.total);

  const articleLowStock = db.prepare(`SELECT a.id,a.product_id,a.name,a.package_type,a.stock_qty,a.min_stock,p.name AS product_name,p.base_unit FROM product_articles a JOIN products p ON p.id=a.product_id WHERE a.status='active' AND a.stock_qty <= a.min_stock ORDER BY a.stock_qty ASC LIMIT 12`).all();
  const articleExpiring = db.prepare(`SELECT a.id,a.product_id,a.name,a.package_type,a.stock_qty,a.expiry_date,p.name AS product_name FROM product_articles a JOIN products p ON p.id=a.product_id WHERE a.status='active' AND a.expiry_date IS NOT NULL AND a.expiry_date <= date('now','+30 days') ORDER BY a.expiry_date ASC LIMIT 12`).all();
  const totalBaseStock = db.prepare('SELECT COALESCE(SUM(current_stock),0) total FROM products').get();
  const dashboard = {
    today: {
      sales: safeNumber(todaySales.total),
      retailSales: safeNumber(retailSales.total),
      wholesaleSales: safeNumber(wholesaleSales.total),
      purchases: safeNumber(purchaseTotal.total),
      grossProfit: grossProfit,
      expenses: safeNumber(expenseTotal.total),
      netProfit: netProfit,
      cashInHand,
      bankBalance: safeNumber(bankBalance.total),
      receivables: safeNumber(receivables.total),
      payables: safeNumber(payables.total),
      stockValue: safeNumber(productValue.total),
      partnerBalances: safeNumber(partnerBalances.total),
      withdrawals: safeNumber(withdrawals.total),
      advances: safeNumber(advances.total),
      todayAdvances: safeNumber(advances.total)
    },
    inventory: {
      products: safeNumber(inventoryStats.products),
      stockValue: safeNumber(inventoryStats.value),
      lowStock: safeNumber(inventoryStats.low_stock),
      outOfStock: safeNumber(inventoryStats.out_of_stock),
      stockInToday: safeNumber(stockInToday.total),
      stockOutToday: safeNumber(stockOutToday.total)
    },
    lowStock,
    expiring,
    articleLowStock,
    articleExpiring,
    totalBaseStock: safeNumber(totalBaseStock.total),
    recentSales,
    salesByDay,
    monthlySales,
    profitByDay,
    retailByDay,
    wholesaleByDay,
    expensesByCategory,
    purchaseTrend,
    grossProfitToday: safeNumber(dailyProfit.total),
    todayDate: today
  };

  res.json(dashboard);
});

app.get('/api/products', (req, res) => {
  const items = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  const articles = db.prepare("SELECT * FROM product_articles WHERE status = 'active' ORDER BY created_at ASC").all();
  const grouped = new Map();
  for (const a of articles) { if (!grouped.has(a.product_id)) grouped.set(a.product_id, []); grouped.get(a.product_id).push(a); }
  res.json(items.map(p => ({
    ...p,
    articles: (grouped.get(p.id) || []).map(a => ({ ...a, stock_qty: Math.floor(safeNumber(a.stock_qty) * 1000) / 1000 }))
  })));
});

app.post('/api/barcodes/generate-missing', (req, res) => {
  const used = new Set([
    ...db.prepare("SELECT barcode FROM products WHERE barcode IS NOT NULL").all().map(r => String(r.barcode)),
    ...db.prepare("SELECT barcode FROM product_articles WHERE barcode IS NOT NULL AND barcode <> ''").all().map(r => String(r.barcode))
  ]);
  let n = 1000, count = 0;
  const next = () => { let c; do { c = '2' + String(n++).padStart(7, '0'); } while (used.has(c)); used.add(c); return c; };
  const rows = db.prepare("SELECT id FROM product_articles WHERE status='active' AND (barcode IS NULL OR barcode = '')").all();
  const upd = db.prepare('UPDATE product_articles SET barcode=? WHERE id=?');
  db.exec('BEGIN');
  try { for (const r of rows) { upd.run(next(), r.id); count++; } db.exec('COMMIT'); }
  catch (e) { db.exec('ROLLBACK'); return res.status(500).json({ ok:false, message:e.message }); }
  res.json({ ok:true, generated:count });
});

app.get('/api/products/:id/articles', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!product) return res.status(404).json({ok:false,message:'Product not found'});
  res.json(db.prepare('SELECT * FROM product_articles WHERE product_id=? ORDER BY created_at ASC').all(product.id));
});

app.post('/api/products/:id/articles', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!product) return res.status(404).json({ok:false,message:'Product not found'});
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const baseUnit = b.base_unit || product.base_unit || product.unit || 'pcs';
  const factor = safeNumber(b.base_per_unit) || 1;
  if (!name || factor <= 0) return res.status(400).json({ok:false,message:'Article name and conversion are required'});
  if (b.barcode && db.prepare('SELECT 1 FROM product_articles WHERE barcode=?').get(b.barcode)) return res.status(400).json({ok:false,message:'Barcode already belongs to another article'});
  const article = {id:uuidv4(),product_id:product.id,name,package_type:b.package_type||'Loose',package_size:safeNumber(b.package_size)||factor,base_unit:baseUnit,barcode:b.barcode||null,purchase_price:safeNumber(b.purchase_price)||product.purchase_price,retail_price:safeNumber(b.retail_price)||product.retail_price,wholesale_price:safeNumber(b.wholesale_price)||product.wholesale_price,wholesale_level_1:safeNumber(b.wholesale_level_1),wholesale_level_2:safeNumber(b.wholesale_level_2),wholesale_level_3:safeNumber(b.wholesale_level_3),min_stock:safeNumber(b.min_stock),stock_qty:0,base_per_unit:factor,expiry_date:b.expiry_date||null,batch_no:b.batch_no||null,status:'active',parent_article_id:b.parent_article_id||null,level_no:Math.max(1,Math.floor(safeNumber(b.level_no)||1))};
  db.prepare(`INSERT INTO product_articles (id,product_id,name,package_type,package_size,base_unit,barcode,purchase_price,retail_price,wholesale_price,wholesale_level_1,wholesale_level_2,wholesale_level_3,min_stock,stock_qty,base_per_unit,expiry_date,batch_no,status,parent_article_id,level_no) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(article.id,article.product_id,article.name,article.package_type,article.package_size,article.base_unit,article.barcode,article.purchase_price,article.retail_price,article.wholesale_price,article.wholesale_level_1,article.wholesale_level_2,article.wholesale_level_3,article.min_stock,article.stock_qty,article.base_per_unit,article.expiry_date,article.batch_no,article.status,article.parent_article_id,article.level_no);
  res.status(201).json({ok:true,article});
});

app.put('/api/products/:id/articles/:articleId', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!product) return res.status(404).json({ok:false,message:'Product not found'});
  const existing = db.prepare('SELECT * FROM product_articles WHERE id=? AND product_id=?').get(req.params.articleId, product.id);
  if (!existing) return res.status(404).json({ok:false,message:'Article not found'});

  const b = req.body || {};
  const name = String(b.name || '').trim();
  const baseUnit = b.base_unit || product.base_unit || product.unit || 'pcs';
  const factor = safeNumber(b.base_per_unit) || safeNumber(existing.base_per_unit) || 1;
  if (!name || factor <= 0) return res.status(400).json({ok:false,message:'Article name and conversion are required'});

  const barcode = String(b.barcode ?? existing.barcode ?? '').trim();
  if (barcode && db.prepare('SELECT 1 FROM product_articles WHERE barcode=? AND id <> ?').get(barcode, existing.id)) {
    return res.status(400).json({ok:false,message:'Barcode already belongs to another article'});
  }

  const updated = {
    ...existing,
    name,
    package_type: b.package_type || existing.package_type || 'Loose',
    package_size: safeNumber(b.package_size) || safeNumber(existing.package_size) || factor,
    base_unit: baseUnit,
    barcode: barcode || null,
    purchase_price: b.purchase_price !== undefined ? safeNumber(b.purchase_price) : safeNumber(existing.purchase_price),
    retail_price: b.retail_price !== undefined ? safeNumber(b.retail_price) : safeNumber(existing.retail_price),
    wholesale_price: b.wholesale_price !== undefined ? safeNumber(b.wholesale_price) : safeNumber(existing.wholesale_price),
    wholesale_level_1: b.wholesale_level_1 !== undefined ? safeNumber(b.wholesale_level_1) : safeNumber(existing.wholesale_level_1),
    wholesale_level_2: b.wholesale_level_2 !== undefined ? safeNumber(b.wholesale_level_2) : safeNumber(existing.wholesale_level_2),
    wholesale_level_3: b.wholesale_level_3 !== undefined ? safeNumber(b.wholesale_level_3) : safeNumber(existing.wholesale_level_3),
    min_stock: safeNumber(b.min_stock) || safeNumber(existing.min_stock) || 0,
    base_per_unit: factor,
    expiry_date: b.expiry_date ?? existing.expiry_date ?? null,
    batch_no: b.batch_no ?? existing.batch_no ?? null,
    parent_article_id: b.parent_article_id ?? existing.parent_article_id ?? null,
    level_no: Math.max(1, Math.floor(safeNumber(b.level_no) || safeNumber(existing.level_no) || 1))
  };

  db.prepare(`UPDATE product_articles SET name=?,package_type=?,package_size=?,base_unit=?,barcode=?,purchase_price=?,retail_price=?,wholesale_price=?,wholesale_level_1=?,wholesale_level_2=?,wholesale_level_3=?,min_stock=?,base_per_unit=?,expiry_date=?,batch_no=?,parent_article_id=?,level_no=? WHERE id=? AND product_id=?`).run(
    updated.name,
    updated.package_type,
    updated.package_size,
    updated.base_unit,
    updated.barcode,
    updated.purchase_price,
    updated.retail_price,
    updated.wholesale_price,
    updated.wholesale_level_1,
    updated.wholesale_level_2,
    updated.wholesale_level_3,
    updated.min_stock,
    updated.base_per_unit,
    updated.expiry_date,
    updated.batch_no,
    updated.parent_article_id,
    updated.level_no,
    existing.id,
    product.id
  );

  res.json({ok:true, article:updated});
});

app.delete('/api/products/:id/articles/:articleId', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!product) return res.status(404).json({ok:false,message:'Product not found'});
  const article = db.prepare('SELECT * FROM product_articles WHERE id=? AND product_id=?').get(req.params.articleId, product.id);
  if (!article) return res.status(404).json({ok:false,message:'Article not found'});

  const saleUse = db.prepare('SELECT COUNT(*) AS count FROM sale_items WHERE article_id = ?').get(article.id).count;
  const purchaseUse = db.prepare('SELECT COUNT(*) AS count FROM purchase_items WHERE article_id = ?').get(article.id).count;
  const stockUse = db.prepare('SELECT COUNT(*) AS count FROM stock_entries WHERE article_id = ?').get(article.id).count;
  if (saleUse || purchaseUse || stockUse || safeNumber(article.stock_qty) !== 0) {
    return res.status(400).json({ok:false,message:'This article has stock/history and cannot be deleted. Set it inactive or adjust stock first.'});
  }

  db.prepare('DELETE FROM product_articles WHERE id=? AND product_id=?').run(article.id, product.id);
  res.json({ok:true});
});

app.post('/api/stock/conversion', (req,res) => {
  const b=req.body||{};
  const from=db.prepare('SELECT * FROM product_articles WHERE id=?').get(b.from_article_id);
  const to=db.prepare('SELECT * FROM product_articles WHERE id=?').get(b.to_article_id);
  if(!from||!to||from.product_id!==to.product_id) return res.status(400).json({ok:false,message:'Select valid articles from the same product'});
  const fromQty=safeNumber(b.from_qty); const baseQty=fromQty*safeNumber(from.base_per_unit);
  if(fromQty<=0||from.stock_qty<fromQty) return res.status(400).json({ok:false,message:'Insufficient package stock'});
  const toQty=baseQty/safeNumber(to.base_per_unit);
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE product_articles SET stock_qty=stock_qty-? WHERE id=?').run(fromQty,from.id);
    db.prepare('UPDATE product_articles SET stock_qty=stock_qty+? WHERE id=?').run(toQty,to.id);
    db.prepare('INSERT INTO stock_conversions (id,product_id,from_article_id,to_article_id,from_qty,to_qty,base_qty,type,notes) VALUES (?,?,?,?,?,?,?,?,?)').run(uuidv4(),from.product_id,from.id,to.id,fromQty,toQty,baseQty,b.type||'BREAK','Package conversion');
    const product=db.prepare('SELECT * FROM products WHERE id=?').get(from.product_id);
    if(product) recordStockMovement(product,'PACKAGE_CONVERSION',0,product.base_unit||product.unit,`${from.name} -> ${to.name}`);
    db.exec('COMMIT'); res.json({ok:true,baseQty,toQty});
  } catch(e){db.exec('ROLLBACK');res.status(400).json({ok:false,message:e.message});}
});

app.post('/api/products', (req, res) => {
  const payload = req.body || {};
  const barcodeValue = String(payload.barcode || '').trim();
  const generatedBarcode = `BAR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const barcode = barcodeValue || generatedBarcode;
  if (db.prepare('SELECT 1 FROM products WHERE barcode = ?').get(barcode)) {
    return res.status(400).json({ ok: false, message: 'This barcode already belongs to another product' });
  }
  if (safeNumber(payload.unit_factor) < 0 || safeNumber(payload.purchase_factor) < 0) {
    return res.status(400).json({ ok: false, message: 'Unit quantity must be greater than zero' });
  }
  const product = {
    id: uuidv4(),
    barcode,
    name: payload.name || 'Unnamed Product',
    category: payload.category || 'General',
    subcategory: payload.subcategory || '',
    brand: payload.brand || 'N/A',
    unit: payload.unit || 'pcs',
    base_unit: payload.base_unit || payload.unit || 'pcs',
    purchase_unit: payload.purchase_unit || payload.stock_unit || payload.unit || 'pcs',
    sale_unit: payload.sale_unit || payload.unit || 'pcs',
    purchase_factor: safeNumber(payload.purchase_factor) || safeNumber(payload.unit_factor) || 1,
    stock_unit: payload.stock_unit || payload.unit || 'pcs',
    unit_factor: safeNumber(payload.unit_factor) || 1,
    purchase_price: safeNumber(payload.purchase_price),
    retail_price: safeNumber(payload.retail_price),
    wholesale_price: safeNumber(payload.wholesale_price),
    wholesale_level_1: safeNumber(payload.wholesale_level_1),
    wholesale_level_2: safeNumber(payload.wholesale_level_2),
    wholesale_level_3: safeNumber(payload.wholesale_level_3),
    min_stock: safeNumber(payload.min_stock),
    current_stock: 0,
    supplier_id: payload.supplier_id || null,
    expiry_date: payload.expiry_date || null,
    batch_no: payload.batch_no || null,
    image: payload.image || '',
    description: payload.description || '',
    status: payload.status || 'active'
  };

  db.prepare(`
    INSERT INTO products (
      id, barcode, name, category, subcategory, brand, unit, base_unit, purchase_unit, sale_unit, purchase_factor, purchase_price, retail_price,
      wholesale_price, wholesale_level_1, wholesale_level_2, wholesale_level_3,
      min_stock, current_stock, stock_unit, unit_factor, supplier_id, expiry_date, batch_no, image, description, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    product.id,
    product.barcode,
    product.name,
    product.category,
    product.subcategory,
    product.brand,
    product.unit,
    product.base_unit,
    product.purchase_unit,
    product.sale_unit,
    product.purchase_factor,
    product.purchase_price,
    product.retail_price,
    product.wholesale_price,
    product.wholesale_level_1,
    product.wholesale_level_2,
    product.wholesale_level_3,
    product.min_stock,
    product.current_stock,
    product.stock_unit,
    product.unit_factor,
    product.supplier_id,
    product.expiry_date,
    product.batch_no,
    product.image,
    product.description,
    product.status
  );

  db.prepare(`INSERT INTO audit_logs (id, user_name, action, entity, details) VALUES (?, ?, ?, ?, ?)`)
    .run(uuidv4(), req.user?.name || req.user?.username || 'unknown', 'Product added', 'products', JSON.stringify(product));
  const factor = safeNumber(product.unit_factor) || 1;
  const loose = ['kg','g','gram','ltr','liter','litre'].includes(String(product.base_unit || product.unit).toLowerCase());
  db.prepare(`INSERT INTO product_articles (id,product_id,name,package_type,package_size,base_unit,barcode,purchase_price,retail_price,wholesale_price,wholesale_level_1,wholesale_level_2,wholesale_level_3,min_stock,stock_qty,base_per_unit,expiry_date,batch_no,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(uuidv4(),product.id,product.name,loose?'Loose':'Piece',factor,product.base_unit||product.unit,product.barcode||null,product.purchase_price,product.retail_price,product.wholesale_price,product.wholesale_level_1,product.wholesale_level_2,product.wholesale_level_3,product.min_stock,0,factor,product.expiry_date||null,product.batch_no||null,product.status||'active');

  res.status(201).json({ ok: true, product });
});


app.post('/api/products/bulk', (req, res) => {
  const items = Array.isArray(req.body?.products) ? req.body.products : [];
  if (!items.length) return res.status(400).json({ ok: false, message: 'No products supplied' });
  let created = 0, updated = 0;
  const errors = [];
  const tx = db.createSession ? null : null;
  try {
    db.exec('BEGIN');
    for (const raw of items) {
      const payload = raw || {};
      const name = String(payload.name || '').trim();
      if (!name) { errors.push('Skipped row without product name'); continue; }
      const barcode = String(payload.barcode || '').trim();
      let existing = barcode ? db.prepare('SELECT * FROM products WHERE barcode = ?').get(barcode) : null;
      const values = {
        barcode: barcode || (existing?.barcode || `BAR-${Date.now()}-${created}`),
        name, category: payload.category || 'General', subcategory: payload.subcategory || '',
        brand: payload.brand || 'N/A', unit: payload.unit || 'pcs',
        base_unit: payload.base_unit || payload.unit || 'pcs',
        purchase_unit: payload.purchase_unit || payload.unit || 'pcs',
        sale_unit: payload.sale_unit || payload.unit || 'pcs',
        purchase_factor: safeNumber(payload.purchase_factor) || safeNumber(payload.unit_factor) || 1,
        unit_factor: safeNumber(payload.unit_factor) || 1,
        purchase_price: safeNumber(payload.purchase_price), retail_price: safeNumber(payload.retail_price),
        wholesale_price: safeNumber(payload.wholesale_price),
        wholesale_level_1: safeNumber(payload.wholesale_level_1), wholesale_level_2: safeNumber(payload.wholesale_level_2), wholesale_level_3: safeNumber(payload.wholesale_level_3),
        min_stock: safeNumber(payload.min_stock), supplier_id: payload.supplier_id || null,
        expiry_date: payload.expiry_date || null, batch_no: payload.batch_no || null,
        description: payload.description || '', status: payload.status || 'active'
      };
      if (existing) {
        db.prepare(`UPDATE products SET barcode=?,name=?,category=?,subcategory=?,brand=?,unit=?,base_unit=?,purchase_unit=?,sale_unit=?,purchase_factor=?,purchase_price=?,retail_price=?,wholesale_price=?,wholesale_level_1=?,wholesale_level_2=?,wholesale_level_3=?,min_stock=?,supplier_id=?,expiry_date=?,batch_no=?,description=?,status=? WHERE id=?`)
          .run(values.barcode,values.name,values.category,values.subcategory,values.brand,values.unit,values.base_unit,values.purchase_unit,values.sale_unit,values.purchase_factor,values.purchase_price,values.retail_price,values.wholesale_price,values.wholesale_level_1,values.wholesale_level_2,values.wholesale_level_3,values.min_stock,values.supplier_id,values.expiry_date,values.batch_no,values.description,values.status,existing.id);
        updated++;
      } else {
        const id = uuidv4();
        db.prepare(`INSERT INTO products (id,barcode,name,category,subcategory,brand,unit,base_unit,purchase_unit,sale_unit,purchase_factor,purchase_price,retail_price,wholesale_price,wholesale_level_1,wholesale_level_2,wholesale_level_3,min_stock,current_stock,stock_unit,unit_factor,supplier_id,expiry_date,batch_no,image,description,status)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(id,values.barcode,values.name,values.category,values.subcategory,values.brand,values.unit,values.base_unit,values.purchase_unit,values.sale_unit,values.purchase_factor,values.purchase_price,values.retail_price,values.wholesale_price,values.wholesale_level_1,values.wholesale_level_2,values.wholesale_level_3,values.min_stock,0,values.base_unit,values.unit_factor,values.supplier_id,values.expiry_date,values.batch_no,'',values.description,values.status);
        created++;
      }
    }
    db.exec('COMMIT');
    res.json({ ok: true, created, updated, errors });
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    res.status(400).json({ ok: false, message: error.message || 'Bulk import failed' });
  }
});



app.post('/api/articles/bulk',(req,res)=>{
  const rows=Array.isArray(req.body?.rows)?req.body.rows:[];
  if(!rows.length) return res.status(400).json({ok:false,message:'No packaging rows supplied'});
  let created=0,updated=0,skipped=0; const errors=[];
  try{
    db.exec('BEGIN');
    for(let i=0;i<rows.length;i++){
      const r=rows[i]||{}; const productId=String(r.product_id||'').trim(); const productBarcode=String(r.product_barcode||'').trim();
      let product=productId?db.prepare('SELECT * FROM products WHERE id=?').get(productId):null;
      if(!product&&productBarcode) product=db.prepare('SELECT * FROM products WHERE barcode=? LIMIT 1').get(productBarcode);
      if(!product){skipped++;errors.push({row:i+2,message:'Parent product not found'});continue;}
      const name=String(r.article_name||r.name||'').trim(); if(!name){skipped++;errors.push({row:i+2,message:'Article name is required'});continue;}
      const barcode=String(r.article_barcode||r.barcode||'').trim()||null;
      let existing=barcode?db.prepare('SELECT * FROM product_articles WHERE barcode=? LIMIT 1').get(barcode):null;
      if(!existing) existing=db.prepare('SELECT * FROM product_articles WHERE product_id=? AND name=? LIMIT 1').get(product.id,name);
      const factor=safeNumber(r.base_per_unit)||1; const baseUnit=r.base_unit||product.base_unit||product.unit||'pcs';
      const parentBarcode=String(r.parent_article_barcode||'').trim(); const parent=parentBarcode?db.prepare('SELECT * FROM product_articles WHERE barcode=? AND product_id=? LIMIT 1').get(parentBarcode,product.id):null;
      const values=[name,r.package_type||'Piece',safeNumber(r.package_size)||factor,baseUnit,barcode,safeNumber(r.purchase_price)||product.purchase_price,safeNumber(r.retail_price)||product.retail_price,safeNumber(r.wholesale_price)||product.wholesale_price,safeNumber(r.min_stock),factor,r.expiry_date||null,r.batch_no||null, parent?.id||null, Math.max(1,Math.floor(safeNumber(r.level_no)||1))];
      if(existing){
        db.prepare(`UPDATE product_articles SET name=?,package_type=?,package_size=?,base_unit=?,barcode=?,purchase_price=?,retail_price=?,wholesale_price=?,min_stock=?,base_per_unit=?,expiry_date=?,batch_no=?,parent_article_id=?,level_no=? WHERE id=?`).run(...values,existing.id);updated++;
      }else{
        db.prepare(`INSERT INTO product_articles (id,product_id,name,package_type,package_size,base_unit,barcode,purchase_price,retail_price,wholesale_price,min_stock,stock_qty,base_per_unit,expiry_date,batch_no,status,parent_article_id,level_no) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(uuidv4(),product.id,...values,0,'active');created++;
      }
    }
    db.exec('COMMIT');res.json({ok:true,created,updated,skipped,errors});
  }catch(e){try{db.exec('ROLLBACK')}catch{};res.status(400).json({ok:false,message:e.message||'Packaging import failed'});}
});

app.post('/api/stock/bulk', (req,res)=>{
  const rows=Array.isArray(req.body?.rows)?req.body.rows:[];
  if(!rows.length) return res.status(400).json({ok:false,message:'No stock rows supplied'});
  let imported=0, skipped=0; const errors=[];
  try{
    db.exec('BEGIN');
    for(let i=0;i<rows.length;i++){
      const r=rows[i]||{};
      const barcode=String(r.barcode||'').trim();
      const productId=String(r.product_id||'').trim();
      const articleId=String(r.article_id||'').trim();
      let article=null, product=null;
      if(articleId) article=db.prepare("SELECT * FROM product_articles WHERE id=? AND status='active'").get(articleId);
      if(!article && barcode) article=db.prepare("SELECT * FROM product_articles WHERE barcode=? AND status='active' LIMIT 1").get(barcode);
      if(article) product=db.prepare('SELECT * FROM products WHERE id=?').get(article.product_id);
      if(!product && productId) product=db.prepare('SELECT * FROM products WHERE id=?').get(productId);
      if(!product && barcode) product=db.prepare('SELECT * FROM products WHERE barcode=? LIMIT 1').get(barcode);
      if(!product){ skipped++; errors.push({row:i+2,message:'Product/article not found'}); continue; }
      if(!article && product){ article=db.prepare('SELECT * FROM product_articles WHERE product_id=? ORDER BY level_no ASC, created_at ASC LIMIT 1').get(product.id); }
      const qty=safeNumber(r.quantity); const factor=safeNumber(r.conversion_factor)||safeNumber(article?.base_per_unit)||safeNumber(product.unit_factor)||1; const cost=safeNumber(r.unit_cost); const expiry=r.expiry_date||null; const entryDate=r.entry_date||new Date().toISOString().slice(0,10);
      if(qty<=0||factor<=0){ skipped++; errors.push({row:i+2,message:'Quantity/conversion must be greater than zero'}); continue; }
      const baseQty=qty*factor;
      const entryId=uuidv4();
      db.prepare(`INSERT INTO stock_entries (id,product_id,article_id,product_name,quantity,unit,conversion_factor,base_quantity,unit_cost,total_cost,supplier_id,reference,expiry_date,update_rate,entry_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(entryId,product.id,article?.id||null,product.name,qty,r.unit||article?.package_type||product.unit||'pcs',factor,baseQty,cost,baseQty*cost,r.supplier_id||null,r.reference||'BULK-OPENING',expiry, r.update_rate?1:0,entryDate);
      if(article){ db.prepare("UPDATE product_articles SET stock_qty=stock_qty+?, purchase_price=CASE WHEN ? > 0 THEN ? ELSE purchase_price END, expiry_date=CASE WHEN ? IS NOT NULL AND ?<>'' THEN ? ELSE expiry_date END WHERE id=?").run(qty,cost,cost,expiry,expiry,expiry,article.id); }
      db.prepare("UPDATE products SET current_stock=current_stock+?, purchase_price=CASE WHEN ?=1 AND ? > 0 THEN ? ELSE purchase_price END, expiry_date=CASE WHEN ? IS NOT NULL AND ?<>'' THEN ? ELSE expiry_date END WHERE id=?").run(baseQty,r.update_rate?1:0,cost,cost,expiry,expiry,expiry,product.id);
      recordStockMovement(product,'OPENING_STOCK',baseQty,product.base_unit||product.unit,r.reference||'BULK-OPENING');
      imported++;
    }
    db.exec('COMMIT'); res.json({ok:true,imported,skipped,errors});
  }catch(e){ try{db.exec('ROLLBACK')}catch{}; res.status(400).json({ok:false,message:e.message||'Bulk stock import failed'}); }
});

app.get('/api/stock', (req, res) => {
  const date = req.query.date;
  const entries = date
    ? db.prepare(`SELECT se.*, s.name AS supplier_name, a.name AS article_name FROM stock_entries se
        LEFT JOIN suppliers s ON s.id=se.supplier_id LEFT JOIN product_articles a ON a.id=se.article_id
        WHERE se.entry_date = ? ORDER BY se.created_at DESC`).all(date)
    : db.prepare(`SELECT se.*, s.name AS supplier_name, a.name AS article_name FROM stock_entries se
        LEFT JOIN suppliers s ON s.id=se.supplier_id LEFT JOIN product_articles a ON a.id=se.article_id
        ORDER BY se.created_at DESC`).all();
  res.json(entries);
});

app.get('/api/stock/ledger/:productId', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.productId);
  if (!product) return res.status(404).json({ ok: false, message: 'Product not found' });
  const movements = db.prepare('SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC').all(product.id);
  res.json({ product, movements });
});

app.post('/api/stock/adjustment', (req, res) => {
  const payload = req.body || {};
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(payload.product_id);
  const article = payload.article_id ? db.prepare('SELECT * FROM product_articles WHERE id=? AND product_id=?').get(payload.article_id, payload.product_id) : null;
  const adjustmentQuantity = safeNumber(payload.quantity);
  const direction = payload.direction === 'out' ? -1 : 1;
  const quantity = direction * adjustmentQuantity;
  const conversionFactor = article ? safeNumber(article.base_per_unit) || 1 : 1;
  const baseQuantity = quantity * conversionFactor;
  const reason = String(payload.reason || '').trim();
  if (!product || (payload.article_id && !article)) return res.status(400).json({ ok: false, message: 'Product or article not found' });
  if (!Number.isFinite(adjustmentQuantity) || adjustmentQuantity <= 0) return res.status(400).json({ ok: false, message: 'Enter an adjustment quantity greater than zero' });
  if (!reason) return res.status(400).json({ ok: false, message: 'Enter an adjustment reason' });
  const nextStock = safeNumber(product.current_stock) + baseQuantity;
  const nextArticleStock = article ? safeNumber(article.stock_qty) + quantity : null;
  if (nextStock < 0) return res.status(400).json({ ok: false, message: 'Adjustment would create negative stock' });
  if (article && nextArticleStock < 0) return res.status(400).json({ ok: false, message: 'Adjustment would create negative article stock' });

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE products SET current_stock = ? WHERE id = ?').run(nextStock, product.id);
    if (article) db.prepare('UPDATE product_articles SET stock_qty=? WHERE id=?').run(nextArticleStock, article.id);
    db.prepare(`INSERT INTO stock_entries (id, product_id, article_id, product_name, quantity, unit, conversion_factor, base_quantity, unit_cost, total_cost, supplier_id, reference, expiry_date, update_rate, entry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      uuidv4(), product.id, article?.id || null, product.name, quantity, article?.package_type || product.base_unit || product.unit || 'pcs', conversionFactor, baseQuantity,
      0, 0, null, reason, null, 0, new Date().toISOString().slice(0, 10)
    );
    recordStockMovement(product, baseQuantity > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', baseQuantity, product.base_unit || product.unit, reason);
    db.exec('COMMIT');
    res.status(201).json({ ok: true, currentStock: nextStock, articleStock: nextArticleStock });
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    res.status(400).json({ ok: false, message: error.message || 'Adjustment failed' });
  }
});

app.post('/api/stock', (req, res) => {
  const payload = req.body || {};
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(payload.product_id);
  if (!product) return res.status(400).json({ ok: false, message: 'Product not found' });
  const article = payload.article_id ? db.prepare('SELECT * FROM product_articles WHERE id=? AND product_id=?').get(payload.article_id, product.id) : null;
  if (payload.article_id && !article) return res.status(400).json({ ok: false, message: 'Article not found for this product' });

  const quantity = safeNumber(payload.quantity);
  const conversionFactor = safeNumber(payload.conversion_factor) || safeNumber(product.unit_factor) || 1;
  const baseQuantity = quantity * conversionFactor;
  const unitCost = safeNumber(payload.unit_cost);
  const totalCost = baseQuantity * unitCost;
  let tender;
  try { tender = resolvePaymentAllocation(payload, totalCost, payload.payment_method || 'Cash', safeNumber(payload.paid_amount)); }
  catch (error) { return res.status(400).json({ ok: false, message: error.message }); }
  const entryDate = payload.entry_date || new Date().toISOString().slice(0, 10);
  const expiryDate = payload.expiry_date || null;
  const updateRate = payload.update_rate === true || payload.update_rate === 'true' || payload.update_rate === 'on';
  if (quantity <= 0 || conversionFactor <= 0) return res.status(400).json({ ok: false, message: 'Quantity and pack contents must be greater than zero' });
  if (payload.supplier_id && !db.prepare('SELECT 1 FROM suppliers WHERE id=?').get(payload.supplier_id)) return res.status(400).json({ ok: false, message: 'Supplier not found' });
  if (unitCost < 0) return res.status(400).json({ ok: false, message: 'Cost must be valid and non-negative' });
  if (tender.paid < totalCost && !payload.supplier_id) return res.status(400).json({ ok: false, message: 'Select a supplier to record the unpaid stock-in balance' });

  const entry = {
    id: uuidv4(), product_id: product.id, article_id: article ? article.id : null, product_name: product.name, quantity,
    unit: payload.unit || product.stock_unit || product.unit || 'pcs', conversion_factor: conversionFactor,
    base_quantity: baseQuantity, unit_cost: unitCost, total_cost: totalCost, paid_amount: tender.paid,
    cash_paid: tender.cash, bank_paid: tender.bank, payment_method: tender.method,
    supplier_id: payload.supplier_id || null, reference: payload.reference || '', expiry_date: expiryDate,
    update_rate: updateRate ? 1 : 0, entry_date: entryDate
  };

  db.exec('BEGIN');
  try {
    db.prepare(`INSERT INTO stock_entries
      (id, product_id, article_id, product_name, quantity, unit, conversion_factor, base_quantity, unit_cost, total_cost, supplier_id, reference, expiry_date, update_rate, entry_date, paid_amount, cash_paid, bank_paid, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(entry.id, entry.product_id, entry.article_id, entry.product_name, entry.quantity, entry.unit, entry.conversion_factor, entry.base_quantity, entry.unit_cost, entry.total_cost, entry.supplier_id, entry.reference, entry.expiry_date, entry.update_rate, entry.entry_date, entry.paid_amount, entry.cash_paid, entry.bank_paid, entry.payment_method);
    if (article) {
      db.prepare("UPDATE product_articles SET stock_qty = stock_qty + ?, purchase_price = CASE WHEN ? > 0 THEN ? ELSE purchase_price END, expiry_date = CASE WHEN ? IS NOT NULL AND ? <> '' THEN ? ELSE expiry_date END WHERE id=?").run(quantity, unitCost, unitCost, expiryDate, expiryDate, expiryDate, article.id);
    }
    db.prepare(`UPDATE products SET current_stock = current_stock + ?,
      purchase_price = CASE WHEN ? = 1 AND ? > 0 THEN ? ELSE purchase_price END,
      expiry_date = CASE WHEN ? IS NOT NULL AND ? <> '' THEN ? ELSE expiry_date END WHERE id = ?`)
      .run(baseQuantity, updateRate ? 1 : 0, unitCost, unitCost, expiryDate, expiryDate, expiryDate, product.id);
    syncStockSupplierEntry(entry, 1);
    syncStockBankEntry(entry, 1);
    recordStockMovement(product, 'PURCHASE', baseQuantity, product.base_unit || product.unit, entry.reference || entry.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return res.status(400).json({ ok: false, message: error.message || 'Stock entry failed' });
  }
  res.status(201).json({ ok: true, entry });
});

app.put('/api/stock/:id', (req, res) => {
  const oldEntry = db.prepare('SELECT * FROM stock_entries WHERE id = ?').get(req.params.id);
  if (!oldEntry) return res.status(404).json({ ok: false, message: 'Stock entry not found' });
  if (db.prepare("SELECT 1 FROM supplier_payment_allocations WHERE entry_type='stock' AND entry_id=?").get(oldEntry.id)) {
    return res.status(400).json({ ok: false, message: 'This stock entry has later supplier payments allocated. Resolve those payments before editing it.' });
  }
  const payload = req.body || {};
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(oldEntry.product_id);
  if (!product) return res.status(404).json({ ok: false, message: 'Product not found' });
  const article = oldEntry.article_id ? db.prepare('SELECT * FROM product_articles WHERE id=?').get(oldEntry.article_id) : null;
  const quantity = safeNumber(payload.quantity);
  const conversionFactor = safeNumber(payload.conversion_factor) || safeNumber(oldEntry.conversion_factor) || safeNumber(product.unit_factor) || 1;
  const baseQuantity = quantity * conversionFactor;
  const unitCost = safeNumber(payload.unit_cost);
  const totalCost = baseQuantity * unitCost;
  let tender;
  try {
    tender = resolvePaymentAllocation(payload, totalCost, oldEntry.payment_method || 'Cash', safeNumber(oldEntry.paid_amount));
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }
  const expiryDate = payload.expiry_date || null;
  const updateRate = payload.update_rate === true || payload.update_rate === 'true' || payload.update_rate === 'on';
  const supplierId = payload.supplier_id === undefined ? oldEntry.supplier_id : (payload.supplier_id || null);
  const nextStock = safeNumber(product.current_stock) - safeNumber(oldEntry.base_quantity) + baseQuantity;
  const nextArticleStock = article ? safeNumber(article.stock_qty) - safeNumber(oldEntry.quantity) + quantity : 0;
  if (quantity <= 0 || conversionFactor <= 0 || unitCost < 0) return res.status(400).json({ ok: false, message: 'Quantity and cost must be valid' });
  if (supplierId && !db.prepare('SELECT 1 FROM suppliers WHERE id=?').get(supplierId)) return res.status(400).json({ ok: false, message: 'Supplier not found' });
  if (tender.paid < totalCost && !supplierId) return res.status(400).json({ ok: false, message: 'Select a supplier to record the unpaid stock-in balance' });
  if (nextStock < 0 || (article && nextArticleStock < 0)) return res.status(400).json({ ok: false, message: 'Correction would create negative stock' });
  const entry = {
    ...oldEntry, quantity, unit: payload.unit || oldEntry.unit, conversion_factor: conversionFactor,
    base_quantity: baseQuantity, unit_cost: unitCost, total_cost: totalCost, paid_amount: tender.paid,
    cash_paid: tender.cash, bank_paid: tender.bank, payment_method: tender.method, supplier_id: supplierId, reference: payload.reference ?? oldEntry.reference ?? '',
    expiry_date: expiryDate, update_rate: updateRate ? 1 : 0, entry_date: payload.entry_date || oldEntry.entry_date
  };
  db.exec('BEGIN');
  try {
    syncStockSupplierEntry(oldEntry, -1);
    syncStockBankEntry(oldEntry, -1);
    db.prepare(`UPDATE stock_entries SET quantity = ?, unit = ?, conversion_factor = ?, base_quantity = ?, unit_cost = ?,
      total_cost = ?, supplier_id = ?, reference = ?, expiry_date = ?, update_rate = ?, entry_date = ?, paid_amount = ?, cash_paid = ?, bank_paid = ?, payment_method = ? WHERE id = ?`).run(
      entry.quantity, entry.unit, entry.conversion_factor, entry.base_quantity, entry.unit_cost, entry.total_cost,
      entry.supplier_id, entry.reference, entry.expiry_date, entry.update_rate, entry.entry_date, entry.paid_amount, entry.cash_paid, entry.bank_paid, entry.payment_method, entry.id
    );
    db.prepare(`UPDATE products SET current_stock = ?,
      purchase_price = CASE WHEN ? = 1 AND ? > 0 THEN ? ELSE purchase_price END,
      expiry_date = CASE WHEN ? IS NOT NULL AND ? <> '' THEN ? ELSE expiry_date END WHERE id = ?`)
      .run(nextStock, updateRate ? 1 : 0, unitCost, unitCost, expiryDate, expiryDate, expiryDate, product.id);
    if (article) db.prepare('UPDATE product_articles SET stock_qty=? WHERE id=?').run(nextArticleStock, article.id);
    syncStockSupplierEntry(entry, 1);
    syncStockBankEntry(entry, 1);
    recordStockMovement(product, 'MANUAL_CORRECTION', baseQuantity - safeNumber(oldEntry.base_quantity), product.base_unit || product.unit, oldEntry.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return res.status(400).json({ ok: false, message: error.message || 'Stock correction failed' });
  }
  res.json({ ok: true });
});

app.delete('/api/stock/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM stock_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ ok: false, message: 'Stock entry not found' });
  if (db.prepare("SELECT 1 FROM supplier_payment_allocations WHERE entry_type='stock' AND entry_id=?").get(entry.id)) {
    return res.status(400).json({ ok: false, message: 'This stock entry has later supplier payments allocated and cannot be deleted.' });
  }
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(entry.product_id);
  const article = entry.article_id ? db.prepare('SELECT * FROM product_articles WHERE id=?').get(entry.article_id) : null;
  if (!product || safeNumber(product.current_stock) < safeNumber(entry.base_quantity) ||
      (article && safeNumber(article.stock_qty) < safeNumber(entry.quantity))) {
    return res.status(400).json({ ok: false, message: 'Entry cannot be deleted because its stock has already been consumed' });
  }
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE products SET current_stock = current_stock - ? WHERE id = ?').run(entry.base_quantity, entry.product_id);
    if (article) db.prepare('UPDATE product_articles SET stock_qty=stock_qty-? WHERE id=?').run(entry.quantity, article.id);
    syncStockSupplierEntry(entry, -1);
    syncStockBankEntry(entry, -1);
    recordStockMovement(product, 'PURCHASE_RETURN', -entry.base_quantity, product.base_unit || product.unit, entry.id);
    db.prepare('DELETE FROM stock_entries WHERE id = ?').run(entry.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return res.status(400).json({ ok: false, message: error.message || 'Stock entry delete failed' });
  }
  res.json({ ok: true });
});

app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  const existingProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existingProduct) return res.status(404).json({ ok: false, message: 'Product not found' });

  const barcodeValue = String(payload.barcode ?? existingProduct.barcode ?? '').trim();
  const barcode = barcodeValue || existingProduct.barcode || `BAR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (db.prepare('SELECT 1 FROM products WHERE barcode = ? AND id <> ?').get(barcode, id)) {
    return res.status(400).json({ ok: false, message: 'This barcode already belongs to another product' });
  }
  if (safeNumber(payload.unit_factor) < 0 || safeNumber(payload.purchase_factor) < 0) {
    return res.status(400).json({ ok: false, message: 'Unit quantity must be greater than zero' });
  }

  db.prepare(`
    UPDATE products SET
      barcode = ?, name = ?, category = ?, subcategory = ?, brand = ?, unit = ?, base_unit = ?, purchase_unit = ?, sale_unit = ?, purchase_factor = ?,
      purchase_price = ?, retail_price = ?, wholesale_price = ?,
      wholesale_level_1 = ?, wholesale_level_2 = ?, wholesale_level_3 = ?,
      min_stock = ?, stock_unit = ?, unit_factor = ?, supplier_id = ?, expiry_date = ?,
      batch_no = ?, image = ?, description = ?, status = ?
    WHERE id = ?
  `).run(
    barcode,
    payload.name || existingProduct.name || 'Unnamed Product',
    payload.category || existingProduct.category || 'General',
    payload.subcategory ?? existingProduct.subcategory ?? '',
    payload.brand || existingProduct.brand || 'N/A',
    payload.unit || existingProduct.unit || 'pcs',
    payload.base_unit || existingProduct.base_unit || payload.unit || existingProduct.unit || 'pcs',
    payload.purchase_unit || existingProduct.purchase_unit || payload.stock_unit || existingProduct.stock_unit || payload.unit || existingProduct.unit || 'pcs',
    payload.sale_unit || existingProduct.sale_unit || payload.unit || existingProduct.unit || 'pcs',
    safeNumber(payload.purchase_factor) || safeNumber(existingProduct.purchase_factor) || safeNumber(payload.unit_factor) || safeNumber(existingProduct.unit_factor) || 1,
    safeNumber(payload.purchase_price) || safeNumber(existingProduct.purchase_price) || 0,
    safeNumber(payload.retail_price) || safeNumber(existingProduct.retail_price) || 0,
    safeNumber(payload.wholesale_price) || safeNumber(existingProduct.wholesale_price) || 0,
    safeNumber(payload.wholesale_level_1) || safeNumber(existingProduct.wholesale_level_1) || 0,
    safeNumber(payload.wholesale_level_2) || safeNumber(existingProduct.wholesale_level_2) || 0,
    safeNumber(payload.wholesale_level_3) || safeNumber(existingProduct.wholesale_level_3) || 0,
    safeNumber(payload.min_stock) || safeNumber(existingProduct.min_stock) || 0,
    payload.stock_unit || existingProduct.stock_unit || payload.unit || existingProduct.unit || 'pcs',
    safeNumber(payload.unit_factor) || safeNumber(existingProduct.unit_factor) || 1,
    payload.supplier_id ?? existingProduct.supplier_id ?? null,
    payload.expiry_date ?? existingProduct.expiry_date ?? null,
    payload.batch_no ?? existingProduct.batch_no ?? null,
    payload.image ?? existingProduct.image ?? '',
    payload.description ?? existingProduct.description ?? '',
    payload.status || existingProduct.status || 'active',
    id
  );

  res.json({ ok: true });
});

app.delete('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ ok:false, message:'Product not found' });
  const saleUse = db.prepare('SELECT COUNT(*) AS count FROM sale_items WHERE product_id = ?').get(req.params.id).count;
  const purchaseUse = db.prepare('SELECT COUNT(*) AS count FROM purchase_items WHERE product_id = ?').get(req.params.id).count;
  const stockUse = db.prepare('SELECT COUNT(*) AS count FROM stock_entries WHERE product_id = ?').get(req.params.id).count;
  if (saleUse || purchaseUse || stockUse || safeNumber(product.current_stock) !== 0) {
    return res.status(400).json({ ok:false, message:'This product has transaction/stock history and cannot be deleted. Set its status to inactive instead.' });
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/customers', (req, res) => {
  res.json(db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all());
});

app.post('/api/customers', (req, res) => {
  const payload = req.body || {};
  const customer = {
    id: uuidv4(),
    name: payload.name || 'New Customer',
    phone: payload.phone || '',
    address: payload.address || '',
    type: payload.type || 'Retail',
    credit_limit: safeNumber(payload.credit_limit),
    opening_balance: safeNumber(payload.opening_balance),
    total_purchases: 0,
    total_paid: 0,
    remaining_balance: safeNumber(payload.opening_balance)
  };

  db.prepare(`
    INSERT INTO customers (id, name, phone, address, type, credit_limit, opening_balance, total_purchases, total_paid, remaining_balance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    customer.id,
    customer.name,
    customer.phone,
    customer.address,
    customer.type,
    customer.credit_limit,
    customer.opening_balance,
    customer.total_purchases,
    customer.total_paid,
    customer.remaining_balance
  );
  if (customer.opening_balance !== 0) {
    db.prepare(`INSERT INTO customer_transactions (id, customer_id, type, amount, reference, payment_method, notes) VALUES (?, ?, 'opening_balance', ?, ?, 'Internal', ?)`)
      .run(uuidv4(), customer.id, Math.abs(customer.opening_balance), 'Opening balance', customer.opening_balance > 0 ? 'Opening amount due from customer' : 'Customer advance balance');
  }

  res.status(201).json({ ok: true, customer });
});

app.put('/api/customers/:id', (req, res) => {
  const payload = req.body || {};
  db.prepare(`UPDATE customers SET name = ?, phone = ?, address = ?, type = ?, credit_limit = ? WHERE id = ?`).run(
    payload.name || 'Customer', payload.phone || '', payload.address || '', payload.type || 'Retail', safeNumber(payload.credit_limit), req.params.id
  );
  res.json({ ok: true });
});

app.delete('/api/customers/:id', (req, res) => {
  const customer = db.prepare('SELECT COUNT(*) AS count FROM sales WHERE customer_id = ?').get(req.params.id);
  if (customer.count > 0) return res.status(400).json({ ok: false, message: 'Customer has invoices and cannot be deleted' });
  db.prepare('DELETE FROM customer_transactions WHERE customer_id = ?').run(req.params.id);
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/customers/:id/ledger', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ ok: false, message: 'Customer not found' });
  let balance = safeNumber(customer.remaining_balance);
  const transactions = db.prepare('SELECT * FROM customer_transactions WHERE customer_id = ? ORDER BY created_at DESC, rowid DESC').all(req.params.id).map((transaction) => {
    const runningBalance = balance;
    const amount = safeNumber(transaction.amount);
    const delta = transaction.type === 'payment' ? -amount :
      transaction.type === 'opening_balance' && /advance/i.test(transaction.notes || '') ? -amount :
      ['sale', 'opening_balance'].includes(transaction.type) ? amount : 0;
    balance -= delta;
    return { ...transaction, running_balance: runningBalance };
  });
  res.json({ customer, transactions });
});

app.post('/api/customer-payments', (req, res) => {
  const payload = req.body || {};
  const amount = safeNumber(payload.amount);
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(payload.customer_id);
  if (!customer || amount <= 0) return res.status(400).json({ ok: false, message: 'Valid customer and amount are required' });
  const paymentMethod = payload.payment_method || 'Cash';
  if (!['Cash', 'Bank', 'Online'].includes(paymentMethod)) return res.status(400).json({ ok: false, message: 'Payment method must be Cash or Bank' });
  const paymentDate = payload.date || new Date().toISOString().slice(0, 10);
  db.exec('BEGIN IMMEDIATE');
  try {
    const reference = payload.reference || 'Account payment';
    const transactionId = uuidv4();
    db.prepare(`INSERT INTO customer_transactions (id, customer_id, type, amount, reference, payment_method, notes, created_at) VALUES (?, ?, 'payment', ?, ?, ?, ?, ?)`).run(transactionId, customer.id, amount, reference, paymentMethod, payload.notes || '', `${paymentDate} 00:00:00`);
    let unapplied = amount;
    const unpaidSales = db.prepare(`SELECT id, total_amount, paid_amount, cash_paid, bank_paid, remaining_amount
      FROM sales WHERE customer_id=? AND remaining_amount>0 ORDER BY date(COALESCE(sale_date,created_at)), created_at, rowid`).all(customer.id);
    for (const sale of unpaidSales) {
      if (unapplied <= 0) break;
      const allocation = Math.min(unapplied, safeNumber(sale.remaining_amount));
      const cashPaid = safeNumber(sale.cash_paid) + (paymentMethod === 'Cash' ? allocation : 0);
      const bankPaid = safeNumber(sale.bank_paid) + (paymentMethod !== 'Cash' ? allocation : 0);
      const paid = safeNumber(sale.paid_amount) + allocation;
      const due = Math.max(0, safeNumber(sale.total_amount) - paid);
      db.prepare('UPDATE sales SET paid_amount=?, cash_paid=?, bank_paid=?, remaining_amount=?, payment_method=? WHERE id=?')
        .run(paid, cashPaid, bankPaid, due, cashPaid > 0 && bankPaid > 0 ? 'Split' : due > 0 ? 'Credit' : bankPaid > 0 ? 'Bank' : 'Cash', sale.id);
      db.prepare('INSERT INTO customer_payment_allocations (id, transaction_id, sale_id, amount) VALUES (?, ?, ?, ?)')
        .run(uuidv4(), transactionId, sale.id, allocation);
      unapplied -= allocation;
    }
    db.prepare('UPDATE customers SET total_paid = total_paid + ?, remaining_balance = remaining_balance - ? WHERE id = ?').run(amount, amount, customer.id);
    if (['Bank', 'Online'].includes(paymentMethod)) addBankTxn({ direction: 'in', kind: 'customer_payment', amount, reference, notes: `${paymentMethod} customer payment`, date: paymentDate });
    db.exec('COMMIT');
    res.status(201).json({ ok: true });
  } catch (error) {
    db.exec('ROLLBACK');
    res.status(400).json({ ok: false, message: error.message || 'Customer payment could not be saved' });
  }
});

app.get('/api/suppliers', (req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers ORDER BY created_at DESC').all());
});

app.post('/api/suppliers', (req, res) => {
  const payload = req.body || {};
  const supplier = {
    id: uuidv4(),
    name: payload.name || 'New Supplier',
    phone: payload.phone || '',
    address: payload.address || '',
    opening_balance: safeNumber(payload.opening_balance),
    total_purchases: 0,
    total_paid: 0,
    remaining_payable: safeNumber(payload.opening_balance)
  };

  db.prepare(`
    INSERT INTO suppliers (id, name, phone, address, opening_balance, total_purchases, total_paid, remaining_payable)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    supplier.id,
    supplier.name,
    supplier.phone,
    supplier.address,
    supplier.opening_balance,
    supplier.total_purchases,
    supplier.total_paid,
    supplier.remaining_payable
  );
  if (supplier.opening_balance !== 0) {
    db.prepare(`INSERT INTO supplier_transactions (id, supplier_id, type, amount, reference, payment_method, notes) VALUES (?, ?, 'opening_balance', ?, ?, 'Internal', ?)`)
      .run(uuidv4(), supplier.id, Math.abs(supplier.opening_balance), 'Opening balance', supplier.opening_balance > 0 ? 'Opening payable to supplier' : 'Supplier advance balance');
  }

  res.status(201).json({ ok: true, supplier });
});

app.put('/api/suppliers/:id', (req, res) => {
  const payload = req.body || {};
  db.prepare('UPDATE suppliers SET name = ?, phone = ?, address = ? WHERE id = ?').run(payload.name || 'Supplier', payload.phone || '', payload.address || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/suppliers/:id', (req, res) => {
  const supplier = db.prepare('SELECT COUNT(*) AS count FROM purchases WHERE supplier_id = ?').get(req.params.id);
  const stockEntries = db.prepare('SELECT COUNT(*) AS count FROM stock_entries WHERE supplier_id = ?').get(req.params.id);
  if (supplier.count > 0 || stockEntries.count > 0) return res.status(400).json({ ok: false, message: 'Supplier has purchase or stock-in history and cannot be deleted' });
  db.prepare('DELETE FROM supplier_transactions WHERE supplier_id = ?').run(req.params.id);
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/suppliers/:id/ledger', (req, res) => {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ ok: false, message: 'Supplier not found' });
  let balance = safeNumber(supplier.remaining_payable);
  const transactions = db.prepare('SELECT * FROM supplier_transactions WHERE supplier_id = ? ORDER BY created_at DESC, rowid DESC').all(req.params.id).map((transaction) => {
    const runningBalance = balance;
    const amount = safeNumber(transaction.amount);
    const delta = transaction.type === 'payment' ? -amount :
      transaction.type === 'opening_balance' && /advance/i.test(transaction.notes || '') ? -amount :
      ['purchase', 'opening_balance'].includes(transaction.type) ? amount : 0;
    balance -= delta;
    return { ...transaction, running_balance: runningBalance };
  });
  res.json({ supplier, transactions });
});

app.post('/api/supplier-payments', (req, res) => {
  const payload = req.body || {};
  const amount = safeNumber(payload.amount);
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(payload.supplier_id);
  if (!supplier || amount <= 0) return res.status(400).json({ ok: false, message: 'Valid supplier and amount are required' });
  const paymentMethod = payload.payment_method || 'Cash';
  if (!['Cash', 'Bank', 'Online'].includes(paymentMethod)) return res.status(400).json({ ok: false, message: 'Payment method must be Cash or Bank' });
  if (amount > safeNumber(supplier.remaining_payable)) return res.status(400).json({ ok: false, message: `Payment cannot exceed current payable (${toCurrency(supplier.remaining_payable)})` });
  const paymentDate = payload.date || new Date().toISOString().slice(0, 10);
  db.exec('BEGIN IMMEDIATE');
  try {
    const reference = payload.reference || 'Supplier payment';
    const transactionId = uuidv4();
    db.prepare(`INSERT INTO supplier_transactions (id, supplier_id, type, amount, reference, payment_method, notes, created_at) VALUES (?, ?, 'payment', ?, ?, ?, ?, ?)`).run(transactionId, supplier.id, amount, reference, paymentMethod, payload.notes || '', `${paymentDate} 00:00:00`);
    const bills = [
      ...db.prepare(`SELECT id, date AS bill_date, total_amount, paid_amount, cash_paid, bank_paid, remaining_amount
        FROM purchases WHERE supplier_id=? AND remaining_amount>0`).all(supplier.id).map((bill) => ({ ...bill, entry_type: 'purchase' })),
      ...db.prepare(`SELECT id, entry_date AS bill_date, total_cost AS total_amount, paid_amount, cash_paid, bank_paid,
          total_cost-paid_amount AS remaining_amount FROM stock_entries
        WHERE supplier_id=? AND total_cost>paid_amount`).all(supplier.id).map((bill) => ({ ...bill, entry_type: 'stock' }))
    ].sort((a, b) => String(a.bill_date).localeCompare(String(b.bill_date)));
    let unapplied = amount;
    let allocatedAmount = 0;
    for (const bill of bills) {
      if (unapplied <= 0) break;
      const allocation = Math.min(unapplied, safeNumber(bill.remaining_amount));
      const cashPaid = safeNumber(bill.cash_paid) + (paymentMethod === 'Cash' ? allocation : 0);
      const bankPaid = safeNumber(bill.bank_paid) + (paymentMethod !== 'Cash' ? allocation : 0);
      const paid = safeNumber(bill.paid_amount) + allocation;
      const due = Math.max(0, safeNumber(bill.total_amount) - paid);
      const mode = cashPaid > 0 && bankPaid > 0 ? 'Split' : due > 0 ? 'Credit' : bankPaid > 0 ? 'Bank' : 'Cash';
      if (bill.entry_type === 'purchase') {
        db.prepare('UPDATE purchases SET paid_amount=?, cash_paid=?, bank_paid=?, remaining_amount=?, payment_method=? WHERE id=?')
          .run(paid, cashPaid, bankPaid, due, mode, bill.id);
      } else {
        db.prepare('UPDATE stock_entries SET paid_amount=?, cash_paid=?, bank_paid=?, payment_method=? WHERE id=?')
          .run(paid, cashPaid, bankPaid, mode, bill.id);
      }
      db.prepare('INSERT INTO supplier_payment_allocations (id, transaction_id, entry_type, entry_id, amount) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), transactionId, bill.entry_type, bill.id, allocation);
      unapplied -= allocation;
      allocatedAmount += allocation;
    }
    db.prepare('UPDATE suppliers SET total_paid = total_paid + ?, remaining_payable = remaining_payable - ? WHERE id = ?').run(amount, amount, supplier.id);
    if (['Bank', 'Online'].includes(paymentMethod)) addBankTxn({ direction: 'out', kind: 'supplier_payment', amount, reference, notes: `${paymentMethod} supplier payment`, date: paymentDate });
    db.exec('COMMIT');
    res.status(201).json({ ok: true, allocatedAmount, unallocatedAmount: unapplied });
  } catch (error) {
    db.exec('ROLLBACK');
    res.status(400).json({ ok: false, message: error.message || 'Supplier payment could not be saved' });
  }
});

app.get('/api/expenses', (req, res) => {
  res.json(db.prepare('SELECT * FROM expenses ORDER BY created_at DESC').all());
});

app.post('/api/expenses', (req, res) => {
  const payload = req.body || {};
  const amount = safeNumber(payload.amount);
  const paymentMethod = payload.payment_method || 'Cash';
  if (amount <= 0) return res.status(400).json({ ok: false, message: 'Expense amount must be greater than zero' });
  if (!['Cash', 'Bank', 'Online'].includes(paymentMethod)) return res.status(400).json({ ok: false, message: 'Invalid payment method' });
  const expense = {
    id: uuidv4(),
    name: payload.name || 'Expense',
    category: payload.category || 'Miscellaneous',
    amount,
    date: payload.date || new Date().toISOString().slice(0, 10),
    payment_method: paymentMethod,
    description: payload.description || ''
  };

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO expenses (id, name, category, amount, date, payment_method, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(expense.id, expense.name, expense.category, expense.amount, expense.date, expense.payment_method, expense.description);
    if (['Bank', 'Online'].includes(paymentMethod)) {
      addBankTxn({ direction: 'out', kind: 'expense', amount, reference: expense.id, notes: `${paymentMethod} expense - ${expense.name}`, date: expense.date });
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return res.status(400).json({ ok: false, message: error.message || 'Expense could not be saved' });
  }

  res.status(201).json({ ok: true, expense });
});

app.get('/api/partners', (req, res) => {
  res.json(db.prepare('SELECT * FROM partners ORDER BY created_at ASC').all());
});

app.post('/api/partners', (req, res) => {
  if (req.user.role === 'partner' || req.user.role === 'cashier' || req.user.role === 'manager') return res.status(403).json({ok:false,message:'Admin access required'});
  const payload = req.body || {};
  const ownership = safeNumber(payload.ownership_pct);
  const capital = safeNumber(payload.capital);
  const paymentMethod = payload.payment_method || 'Cash';
  if (ownership < 0 || ownership > 100 || capital < 0) return res.status(400).json({ ok: false, message: 'Ownership and capital must be valid non-negative amounts' });
  if (!['Cash', 'Bank', 'Online'].includes(paymentMethod)) return res.status(400).json({ ok: false, message: 'Capital source must be Cash or Bank' });
  const currentOwnership = db.prepare('SELECT COALESCE(SUM(ownership_pct),0) AS total FROM partners').get().total;
  if (safeNumber(currentOwnership) + ownership > 100.01) return res.status(400).json({ ok: false, message: 'Partner ownership shares cannot total more than 100%' });
  const partner = {
    id: uuidv4(),
    name: payload.name || 'Partner',
    capital,
    ownership_pct: ownership,
    current_balance: capital,
    withdrawals: 0,
    advances: 0,
    profit_share: 0
  };

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      INSERT INTO partners (id, name, capital, ownership_pct, current_balance, withdrawals, advances, profit_share)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(partner.id, partner.name, partner.capital, partner.ownership_pct, partner.current_balance, partner.withdrawals, partner.advances, partner.profit_share);

    if (capital > 0) {
      const date = payload.date || new Date().toISOString().slice(0, 10);
      db.prepare(`INSERT INTO partner_transactions (id, partner_id, type, amount, reason, payment_method, notes, created_at)
        VALUES (?, ?, 'capital_contribution', ?, 'Initial partner capital', ?, ?, ?)`)
        .run(uuidv4(), partner.id, capital, paymentMethod, payload.notes || '', `${date} 00:00:00`);
      if (['Bank', 'Online'].includes(paymentMethod)) addBankTxn({ direction: 'in', kind: 'partner', amount: capital, reference: `PARTNER-CAPITAL-${partner.id}`, notes: `${partner.name} initial capital`, date });
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return res.status(400).json({ ok: false, message: error.message || 'Partner could not be saved' });
  }
  res.status(201).json({ ok: true, partner });
});

app.put('/api/partners/:id', (req, res) => {
  if (req.user.role === 'partner' || req.user.role === 'cashier' || req.user.role === 'manager') return res.status(403).json({ok:false,message:'Admin access required'});
  const payload = req.body || {};
  const partner = db.prepare('SELECT * FROM partners WHERE id=?').get(req.params.id);
  if (!partner) return res.status(404).json({ ok: false, message: 'Partner not found' });
  const ownership = payload.ownership_pct === undefined ? safeNumber(partner.ownership_pct) : safeNumber(payload.ownership_pct);
  const otherShares = db.prepare('SELECT COALESCE(SUM(ownership_pct),0) AS total FROM partners WHERE id<>?').get(partner.id).total;
  if (ownership < 0 || ownership > 100 || safeNumber(otherShares) + ownership > 100.01) return res.status(400).json({ ok: false, message: 'Partner ownership shares cannot total more than 100%' });
  const capital = payload.capital === undefined ? safeNumber(partner.capital) : safeNumber(payload.capital);
  if (capital < 0) return res.status(400).json({ ok: false, message: 'Partner capital cannot be negative' });
  const capitalDelta = capital - safeNumber(partner.capital);
  if (capitalDelta < 0 && Math.abs(capitalDelta) > safeNumber(partner.current_balance)) {
    return res.status(400).json({ ok: false, message: "Capital cannot be reduced below the partner's current balance. Record withdrawals first." });
  }
  const paymentMethod = payload.payment_method || 'Cash';
  if (capitalDelta !== 0 && !['Cash', 'Bank', 'Online'].includes(paymentMethod)) {
    return res.status(400).json({ ok: false, message: 'Capital change source must be Cash or Bank' });
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE partners SET name = ?, ownership_pct = ?, capital = ?, current_balance = current_balance + ? WHERE id = ?')
      .run(String(payload.name || partner.name).trim(), ownership, capital, capitalDelta, partner.id);
    if (capitalDelta !== 0) {
      const date = payload.date || new Date().toISOString().slice(0, 10);
      const notes = `Capital corrected from ${safeNumber(partner.capital)} to ${capital}`;
      db.prepare(`INSERT INTO partner_transactions (id, partner_id, type, amount, reason, payment_method, notes, created_at)
        VALUES (?, ?, 'capital_adjustment', ?, 'Capital correction', ?, ?, ?)`)
        .run(uuidv4(), partner.id, capitalDelta, paymentMethod, notes, `${date} ${new Date().toISOString().slice(11, 19)}`);
      if (['Bank', 'Online'].includes(paymentMethod)) addBankTxn({
        direction: capitalDelta > 0 ? 'in' : 'out',
        kind: 'partner',
        amount: Math.abs(capitalDelta),
        reference: `PARTNER-CAPITAL-ADJUSTMENT-${partner.id}-${uuidv4()}`,
        notes: `${partner.name}: ${notes}`,
        date
      });
    }
    db.exec('COMMIT');
    res.json({ ok: true, capitalDelta });
  } catch (error) {
    db.exec('ROLLBACK');
    res.status(400).json({ ok: false, message: error.message || 'Partner could not be updated' });
  }
});

app.delete('/api/partners/:id', (req, res) => {
  if (req.user.role === 'partner' || req.user.role === 'cashier' || req.user.role === 'manager') return res.status(403).json({ok:false,message:'Admin access required'});
  const partner = db.prepare('SELECT * FROM partners WHERE id=?').get(req.params.id);
  if (!partner) return res.status(404).json({ ok: false, message: 'Partner not found' });
  const transactions = db.prepare('SELECT COUNT(*) AS count FROM partner_transactions WHERE partner_id = ?').get(partner.id);
  if (transactions.count > 0 || safeNumber(partner.current_balance) !== 0 || safeNumber(partner.advances) !== 0) {
    return res.status(400).json({ ok: false, message: 'This partner has ledger history or a balance and cannot be deleted. Keep the account to preserve its transactions; edit the name, share, or capital instead.' });
  }
  const otherShares = db.prepare('SELECT COALESCE(SUM(ownership_pct),0) AS total FROM partners WHERE id<>?').get(partner.id).total;
  if (Math.abs(safeNumber(otherShares) - 100) > 0.01) {
    return res.status(400).json({ ok: false, message: "Reassign this partner's ownership share to the other partners before deleting; active ownership must total 100%." });
  }
  db.prepare('DELETE FROM partners WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/purchases', (req, res) => {
  res.json(db.prepare('SELECT * FROM purchases ORDER BY created_at DESC').all());
});

app.post('/api/purchases', (req, res) => {
  const payload = req.body || {};
  const items = payload.items || [];
  if (!items.length) return res.status(400).json({ok:false,message:'Add at least one purchase item'});
  let totalAmount = 0;
  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
    const article = item.article_id ? db.prepare('SELECT 1 FROM product_articles WHERE id = ? AND product_id = ?').get(item.article_id, item.product_id) : null;
    const quantity = safeNumber(item.quantity);
    const conversionFactor = safeNumber(item.conversion_factor) || safeNumber(product?.purchase_factor) || safeNumber(product?.unit_factor) || 1;
    const unitCost = safeNumber(item.unit_cost);
    if (!product || (item.article_id && !article) || quantity <= 0 || conversionFactor <= 0 || unitCost < 0) {
      return res.status(400).json({ ok: false, message: 'Invalid purchase item or price' });
    }
    totalAmount += quantity * conversionFactor * unitCost;
  }
  const paidAmount = Math.min(totalAmount, Math.max(0, safeNumber(payload.paid_amount)));
  let tender;
  try { tender = resolvePaymentAllocation(payload, totalAmount, payload.payment_method || 'Cash', paidAmount); }
  catch (error) { return res.status(400).json({ ok: false, message: error.message }); }
  if (tender.paid < totalAmount && !payload.supplier_id) return res.status(400).json({ ok: false, message: 'Select a supplier to record the unpaid purchase balance' });
  if (payload.supplier_id && !db.prepare('SELECT 1 FROM suppliers WHERE id = ?').get(payload.supplier_id)) {
    return res.status(400).json({ ok: false, message: 'Supplier not found' });
  }
  const purchaseId = uuidv4();
  let invoiceNumber;

  db.exec('BEGIN IMMEDIATE');
  try {
  invoiceNumber = createInvoiceNumber('PUR', 'purchases');
  db.prepare(`
    INSERT INTO purchases (id, invoice_number, supplier_id, supplier_name, date, total_amount, paid_amount, cash_paid, bank_paid, remaining_amount, payment_method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    purchaseId,
    invoiceNumber,
    payload.supplier_id || null,
    payload.supplier_name || (payload.supplier_id ? db.prepare('SELECT name FROM suppliers WHERE id = ?').get(payload.supplier_id)?.name : '') || 'Supplier',
    payload.date || new Date().toISOString().slice(0, 10),
    totalAmount,
    tender.paid,
    tender.cash,
    tender.bank,
    totalAmount - tender.paid,
    tender.method
  );

  items.forEach((item) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
    const article = item.article_id ? db.prepare('SELECT * FROM product_articles WHERE id=? AND product_id=?').get(item.article_id, item.product_id) : null;
    const itemId = uuidv4();
    const qty = safeNumber(item.quantity);
    const conversionFactor = safeNumber(item.conversion_factor) || safeNumber(product?.purchase_factor) || safeNumber(product?.unit_factor) || 1;
    const unitCost = safeNumber(item.unit_cost);
    const totalCost = qty * conversionFactor * unitCost;
    if (!product || qty <= 0 || conversionFactor <= 0 || unitCost < 0) throw new Error('Invalid purchase item or price');
    if (item.article_id && !article) throw new Error(`Article not found for ${product.name}`);

    db.prepare(`
      INSERT INTO purchase_items (id, purchase_id, product_id, article_id, product_name, quantity, conversion_factor, unit_cost, total_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(itemId, purchaseId, item.product_id, article?.id || null, product.name, qty, conversionFactor, unitCost, totalCost);

    const baseQuantity = qty * conversionFactor;
    db.prepare('UPDATE products SET current_stock = current_stock + ?, purchase_price = ? WHERE id = ?').run(baseQuantity, unitCost, item.product_id);
    if (article) db.prepare('UPDATE product_articles SET stock_qty=stock_qty+?, purchase_price=? WHERE id=?').run(qty, unitCost, article.id);
    recordStockMovement(product, 'PURCHASE', baseQuantity, product.base_unit || product.unit, invoiceNumber);
  });

  if (payload.supplier_id) {
    db.prepare('UPDATE suppliers SET total_purchases = total_purchases + ?, total_paid = total_paid + ?, remaining_payable = remaining_payable + ? WHERE id = ?')
      .run(totalAmount, tender.paid, totalAmount - tender.paid, payload.supplier_id);
    db.prepare(`INSERT INTO supplier_transactions (id, supplier_id, type, amount, reference, payment_method, notes) VALUES (?, ?, 'purchase', ?, ?, ?, ?)`).run(uuidv4(), payload.supplier_id, totalAmount, invoiceNumber, tender.method, 'Purchase invoice');
    if (tender.cash > 0) db.prepare(`INSERT INTO supplier_transactions (id, supplier_id, type, amount, reference, payment_method, notes) VALUES (?, ?, 'payment', ?, ?, 'Cash', 'Cash paid with purchase')`).run(uuidv4(), payload.supplier_id, tender.cash, invoiceNumber);
    if (tender.bank > 0) db.prepare(`INSERT INTO supplier_transactions (id, supplier_id, type, amount, reference, payment_method, notes) VALUES (?, ?, 'payment', ?, ?, 'Bank', 'Bank paid with purchase')`).run(uuidv4(), payload.supplier_id, tender.bank, invoiceNumber);
  }

  if (tender.bank > 0) addBankTxn({ direction: 'out', kind: 'purchase', amount: tender.bank, reference: invoiceNumber, notes: `Bank payment - ${invoiceNumber}`, date: payload.date });
  db.exec('COMMIT');
  res.status(201).json({ ok: true, invoiceNumber, purchaseId });
  } catch (error) {
    db.exec('ROLLBACK');
    res.status(400).json({ ok: false, message: error.message || 'Purchase could not be saved' });
  }
});

app.get('/api/sales', (req, res) => {
  res.json(db.prepare('SELECT * FROM sales ORDER BY created_at DESC').all());
});

app.post('/api/sales', (req, res) => {
  const payload = req.body || {};
  const saleType = payload.sale_type || 'retail';
  const items = payload.items || [];
  if (!items.length) return res.status(400).json({ ok: false, message: 'Add at least one item to the bill' });
  let totalAmount = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let totalDiscount = 0;

  const saleId = uuidv4();
  const invoiceNumber = createInvoiceNumber('POS');

  const requestedStockByProduct = new Map();
  for (const item of items) {
    const product = db.prepare('SELECT name, current_stock FROM products WHERE id = ?').get(item.product_id);
    const article = item.article_id ? db.prepare('SELECT * FROM product_articles WHERE id=? AND product_id=?').get(item.article_id, item.product_id) : null;
    if (!product) return res.status(400).json({ ok: false, message: 'Product not found' });
    if (item.article_id && !article) return res.status(400).json({ ok: false, message: `Article not found for ${product.name}` });
    const conversionFactor = safeNumber(item.conversion_factor) || safeNumber(product.unit_factor) || 1;
    const stockQuantity = safeNumber(item.quantity) * conversionFactor;
    const requestedTotal = (requestedStockByProduct.get(item.product_id) || 0) + stockQuantity;
    requestedStockByProduct.set(item.product_id, requestedTotal);
    if (safeNumber(item.quantity) <= 0 || conversionFactor <= 0 || safeNumber(product.current_stock) < requestedTotal) {
      return res.status(400).json({ ok: false, message: `Insufficient stock for ${product.name}` });
    }
  }

  db.exec('BEGIN IMMEDIATE');
  try {
  items.forEach((item) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
    if (!product) return;

    const qty = safeNumber(item.quantity);
    const stockQuantity = qty * (safeNumber(item.conversion_factor) || product.unit_factor || 1);
    const price = safeNumber(item.price);
    const cost = safeNumber(item.cost || product.purchase_price);
    if (qty <= 0 || stockQuantity <= 0 || price < 0 || cost < 0) throw new Error(`Invalid quantity or price for ${product.name}`);
    const subtotal = qty * price;
    const requestedDiscount = safeNumber(item.discount || 0);
    const discountPercent = Math.max(0, Math.min(100, safeNumber(item.discount_percent || 0)));
    const discount = Math.min(subtotal, Math.max(0, requestedDiscount || (subtotal * discountPercent / 100)));
    const itemTotalCost = stockQuantity * cost;
    const itemProfit = subtotal - discount - itemTotalCost;

    totalAmount += subtotal - discount;
    totalCost += itemTotalCost;
    totalProfit += itemProfit;
    totalDiscount += discount;

    db.prepare('UPDATE products SET current_stock = current_stock - ? WHERE id = ?').run(stockQuantity, item.product_id);
    if (item.article_id) db.prepare('UPDATE product_articles SET stock_qty = stock_qty - ? WHERE id=?').run(qty, item.article_id);
    recordStockMovement(product, 'SALE', -stockQuantity, product.base_unit || product.unit, invoiceNumber);

    db.prepare(`
      INSERT INTO sale_items (id, sale_id, product_id, article_id, product_name, quantity, conversion_factor, cost_price, selling_price, discount_amount, discount_percent, subtotal, total_cost, total_profit, profit_margin, no_receipt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      saleId,
      item.product_id,
      item.article_id || null,
      product.name,
      qty,
      safeNumber(item.conversion_factor) || product.unit_factor || 1,
      cost,
      price,
      discount,
      discountPercent,
      subtotal,
      itemTotalCost,
      itemProfit,
      subtotal > 0 ? (itemProfit / subtotal) * 100 : 0,
      item.no_receipt ? 1 : 0
    );
  });

  const customerId = payload.customer_id || null;
  const customer = customerId ? db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) : null;
  const paymentMethod = payload.payment_method || 'Cash';
  const isCreditSale = String(paymentMethod).toLowerCase() === 'credit';
  if (customerId && !customer) throw new Error('Customer not found');
  if (isCreditSale && !customer) throw new Error('Select a customer before creating a credit bill');
  const requestedPaidAmount = safeNumber(payload.paid_amount);
  const tender = resolvePaymentAllocation(payload, totalAmount, paymentMethod, isCreditSale ? requestedPaidAmount : (requestedPaidAmount || totalAmount));
  const paidAmount = tender.paid;
  const remainingAmount = totalAmount - paidAmount;
  if (remainingAmount > 0 && !customer) throw new Error('Select a customer to add the unpaid balance to their account');
  if (customer && safeNumber(customer.credit_limit) > 0 && safeNumber(customer.remaining_balance) + remainingAmount > safeNumber(customer.credit_limit)) throw new Error(`Customer credit limit exceeded. Available credit: ${Math.max(0,safeNumber(customer.credit_limit)-safeNumber(customer.remaining_balance)).toFixed(2)}`);
  const profitMargin = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;

  db.prepare(`
    INSERT INTO sales (id, invoice_number, sale_type, customer_id, customer_name, customer_phone, payment_method, total_amount, paid_amount, cash_paid, bank_paid, remaining_amount, discount_amount, cost_total, profit_total, profit_margin, sale_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    saleId,
    invoiceNumber,
    saleType,
    customerId,
    customer ? customer.name : (payload.customer_name || 'Walk-in Customer'),
    customer ? customer.phone : (payload.customer_phone || ''),
    paymentMethod,
    totalAmount,
    paidAmount,
    tender.cash,
    tender.bank,
    remainingAmount,
    totalDiscount,
    totalCost,
    totalProfit,
    profitMargin,
    payload.sale_date || new Date().toISOString().slice(0, 10),
    payload.notes || ''
  );

  if (customer) {
    const updatedRemaining = customer.remaining_balance + remainingAmount;
    db.prepare('UPDATE customers SET total_purchases = total_purchases + ?, total_paid = total_paid + ?, remaining_balance = ? WHERE id = ?')
      .run(totalAmount, paidAmount, updatedRemaining, customer.id);
    db.prepare(`INSERT INTO customer_transactions (id, customer_id, type, amount, reference, payment_method, notes) VALUES (?, ?, 'sale', ?, ?, ?, ?)`).run(uuidv4(), customer.id, totalAmount, invoiceNumber, paymentMethod, 'Sales invoice');
    if (tender.cash > 0) db.prepare(`INSERT INTO customer_transactions (id, customer_id, type, amount, reference, payment_method, notes) VALUES (?, ?, 'payment', ?, ?, 'Cash', 'Cash paid with sale')`).run(uuidv4(), customer.id, tender.cash, invoiceNumber);
    if (tender.bank > 0) db.prepare(`INSERT INTO customer_transactions (id, customer_id, type, amount, reference, payment_method, notes) VALUES (?, ?, 'payment', ?, ?, 'Bank', 'Bank paid with sale')`).run(uuidv4(), customer.id, tender.bank, invoiceNumber);
  }

  if (tender.bank > 0) addBankTxn({ direction: 'in', kind: 'sale', amount: tender.bank, reference: invoiceNumber, notes: `Bank payment - ${invoiceNumber}` });

  db.prepare(`INSERT INTO audit_logs (id, user_name, action, entity, details) VALUES (?, ?, ?, ?, ?)`)
    .run(uuidv4(), req.user?.name || req.user?.username || 'unknown', 'Sale created', 'sales', JSON.stringify({ invoiceNumber, totalAmount, profit: totalProfit }));

  db.exec('COMMIT');
  res.status(201).json({ ok: true, saleId, invoiceNumber, totalAmount, totalProfit, profitMargin });
  } catch (error) {
    db.exec('ROLLBACK');
    res.status(400).json({ ok: false, message: error.message || 'Sale could not be saved' });
  }
});

app.get('/api/sales/:id', (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ? OR invoice_number = ?').get(req.params.id, req.params.id);
  if (!sale) return res.status(404).json({ ok: false, message: 'Invoice not found' });
  sale.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC').all(sale.id);
  res.json(sale);
});

app.put('/api/sales/:id', (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ ok: false, message: 'Invoice not found' });
  if (db.prepare('SELECT 1 FROM customer_payment_allocations WHERE sale_id=?').get(sale.id)) {
    return res.status(400).json({ ok: false, message: 'This invoice has later customer payments allocated. Resolve those payments before editing it.' });
  }

  if (Array.isArray(req.body.items)) {
    const items = req.body.items;
    if (!items.length) return res.status(400).json({ ok: false, message: 'At least one bill item is required' });
    try {
      db.exec('BEGIN');
      const oldItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
      db.prepare("DELETE FROM bank_transactions WHERE kind='sale' AND reference=?").run(sale.invoice_number);
      oldItems.forEach((item) => {
        const restoredQuantity = item.quantity * (item.conversion_factor || 1);
        db.prepare('UPDATE products SET current_stock = current_stock + ? WHERE id = ?').run(restoredQuantity, item.product_id);
        if (item.article_id) db.prepare('UPDATE product_articles SET stock_qty = stock_qty + ? WHERE id=?').run(item.quantity, item.article_id);
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        if (product) recordStockMovement(product, 'SALE_RETURN', restoredQuantity, product.base_unit || product.unit, `${sale.invoice_number}-EDIT`);
      });
      if (sale.customer_id) {
        db.prepare('UPDATE customers SET total_purchases = total_purchases - ?, total_paid = total_paid - ?, remaining_balance = remaining_balance - ? WHERE id = ?')
          .run(sale.total_amount, sale.paid_amount, sale.remaining_amount, sale.customer_id);
        db.prepare('DELETE FROM customer_transactions WHERE customer_id = ? AND reference = ?').run(sale.customer_id, sale.invoice_number);
      }

      let totalAmount = 0;
      let totalCost = 0;
      let totalProfit = 0;
      let totalDiscount = 0;
      const preparedItems = [];
      for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        if (!product) throw new Error('Product not found');
        const quantity = safeNumber(item.quantity);
        const conversionFactor = safeNumber(item.conversion_factor) || product.unit_factor || 1;
        const stockQuantity = quantity * conversionFactor;
        const article = item.article_id ? db.prepare('SELECT * FROM product_articles WHERE id=? AND product_id=?').get(item.article_id, product.id) : null;
        if (item.article_id && !article) throw new Error(`Article not found for ${product.name}`);
        if (quantity <= 0 || product.current_stock < stockQuantity) throw new Error(`Insufficient stock for ${product.name}`);
        const price = safeNumber(item.price);
        const cost = safeNumber(item.cost || product.purchase_price);
        const subtotal = quantity * price;
        const discountPercent = Math.max(0, Math.min(100, safeNumber(item.discount_percent || 0)));
        const discount = Math.min(subtotal, Math.max(0, safeNumber(item.discount || 0) || subtotal * discountPercent / 100));
        const itemTotalCost = stockQuantity * cost;
        const itemProfit = subtotal - discount - itemTotalCost;
        totalAmount += subtotal - discount;
        totalCost += itemTotalCost;
        totalProfit += itemProfit;
        totalDiscount += discount;
        preparedItems.push({ product, article_id: item.article_id || null, quantity, conversionFactor, stockQuantity, price, cost, subtotal, discount, discountPercent, itemTotalCost, itemProfit });
      }

      db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(sale.id);
      preparedItems.forEach((item) => {
        db.prepare('UPDATE products SET current_stock = current_stock - ? WHERE id = ?').run(item.stockQuantity, item.product.id);
        if (item.article_id) db.prepare('UPDATE product_articles SET stock_qty = stock_qty - ? WHERE id=?').run(item.quantity, item.article_id);
        recordStockMovement(item.product, 'SALE', -item.stockQuantity, item.product.base_unit || item.product.unit, `${sale.invoice_number}-EDIT`);
        db.prepare(`INSERT INTO sale_items (id, sale_id, product_id, article_id, product_name, quantity, conversion_factor, cost_price, selling_price, discount_amount, discount_percent, subtotal, total_cost, total_profit, profit_margin)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          uuidv4(), sale.id, item.product.id, item.article_id || null, item.product.name, item.quantity, item.conversionFactor, item.cost, item.price,
          item.discount, item.discountPercent, item.subtotal, item.itemTotalCost, item.itemProfit,
          item.subtotal > 0 ? item.itemProfit / item.subtotal * 100 : 0
        );
      });

      const customerId = req.body.customer_id || null;
      const customer = customerId ? db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) : null;
      const paymentMethod = req.body.payment_method || sale.payment_method;
      if (String(paymentMethod).toLowerCase() === 'credit' && !customer) throw new Error('Select a customer for a credit bill');
      const legacyPaid = req.body.paid_amount === undefined ? safeNumber(sale.paid_amount) : safeNumber(req.body.paid_amount);
      const tender = resolvePaymentAllocation(req.body, totalAmount, paymentMethod, legacyPaid);
      const paidAmount = tender.paid;
      const remainingAmount = totalAmount - paidAmount;
      if (remainingAmount > 0 && !customer) throw new Error('Select a customer to add the unpaid balance to their account');
      if (customer && safeNumber(customer.credit_limit) > 0 && safeNumber(customer.remaining_balance) + remainingAmount > safeNumber(customer.credit_limit)) throw new Error('Customer credit limit exceeded');
      db.prepare(`UPDATE sales SET sale_type = ?, customer_id = ?, customer_name = ?, customer_phone = ?, payment_method = ?, total_amount = ?, paid_amount = ?, cash_paid = ?, bank_paid = ?, remaining_amount = ?, discount_amount = ?, cost_total = ?, profit_total = ?, profit_margin = ?, sale_date = ?, notes = ? WHERE id = ?`).run(
        req.body.sale_type || sale.sale_type, customerId, customer ? customer.name : (req.body.customer_name || 'Walk-in Customer'), customer ? customer.phone : '', tender.method,
        totalAmount, paidAmount, tender.cash, tender.bank, remainingAmount, totalDiscount, totalCost, totalProfit, totalAmount > 0 ? totalProfit / totalAmount * 100 : 0, req.body.sale_date || sale.sale_date, req.body.notes || sale.notes || '', sale.id
      );
      if (customer) {
        db.prepare('UPDATE customers SET total_purchases = total_purchases + ?, total_paid = total_paid + ?, remaining_balance = remaining_balance + ? WHERE id = ?').run(totalAmount, paidAmount, remainingAmount, customer.id);
        db.prepare(`INSERT INTO customer_transactions (id, customer_id, type, amount, reference, payment_method, notes) VALUES (?, ?, 'sale', ?, ?, ?, ?)`).run(uuidv4(), customer.id, totalAmount, sale.invoice_number, tender.method, 'Edited sales invoice');
        if (tender.cash > 0) db.prepare(`INSERT INTO customer_transactions (id, customer_id, type, amount, reference, payment_method, notes) VALUES (?, ?, 'payment', ?, ?, 'Cash', 'Cash paid with edited sale')`).run(uuidv4(), customer.id, tender.cash, sale.invoice_number);
        if (tender.bank > 0) db.prepare(`INSERT INTO customer_transactions (id, customer_id, type, amount, reference, payment_method, notes) VALUES (?, ?, 'payment', ?, ?, 'Bank', 'Bank paid with edited sale')`).run(uuidv4(), customer.id, tender.bank, sale.invoice_number);
      }
      if (tender.bank > 0) addBankTxn({ direction: 'in', kind: 'sale', amount: tender.bank, reference: sale.invoice_number, notes: `Bank payment - ${sale.invoice_number}` });
      db.exec('COMMIT');
      return res.json({ ok: true, saleId: sale.id, invoiceNumber: sale.invoice_number, totalAmount, remainingAmount });
    } catch (error) {
      db.exec('ROLLBACK');
      return res.status(400).json({ ok: false, message: error.message || 'Invoice could not be updated' });
    }
  }

  const paymentMethod = req.body.payment_method || sale.payment_method;
  const paidValue = req.body.paid_amount === undefined ? safeNumber(sale.paid_amount) : safeNumber(req.body.paid_amount);
  let tender;
  try { tender = resolvePaymentAllocation(req.body, sale.total_amount, paymentMethod, paidValue); }
  catch (error) { return res.status(400).json({ ok: false, message: error.message }); }
  const paidAmount = tender.paid;
  const remainingAmount = sale.total_amount - paidAmount;
  const paidDelta = paidAmount - sale.paid_amount;
  const balanceDelta = remainingAmount - sale.remaining_amount;
  if (remainingAmount > 0 && !sale.customer_id) return res.status(400).json({ ok: false, message: 'Select a customer to add the unpaid balance to their account' });
  db.exec('BEGIN');
  try {
    db.prepare("DELETE FROM bank_transactions WHERE kind='sale' AND reference=?").run(sale.invoice_number);
    db.prepare('UPDATE sales SET paid_amount = ?, cash_paid = ?, bank_paid = ?, remaining_amount = ?, payment_method = ? WHERE id = ?')
      .run(paidAmount, tender.cash, tender.bank, remainingAmount, tender.method, sale.id);
    if (sale.customer_id) {
      db.prepare('UPDATE customers SET total_paid = total_paid + ?, remaining_balance = remaining_balance + ? WHERE id = ?')
        .run(paidDelta, balanceDelta, sale.customer_id);
      db.prepare("DELETE FROM customer_transactions WHERE customer_id=? AND reference=? AND type='payment'").run(sale.customer_id, sale.invoice_number);
      if (tender.cash > 0) db.prepare(`INSERT INTO customer_transactions (id, customer_id, type, amount, reference, payment_method, notes) VALUES (?, ?, 'payment', ?, ?, 'Cash', 'Cash payment for invoice')`).run(uuidv4(), sale.customer_id, tender.cash, sale.invoice_number);
      if (tender.bank > 0) db.prepare(`INSERT INTO customer_transactions (id, customer_id, type, amount, reference, payment_method, notes) VALUES (?, ?, 'payment', ?, ?, 'Bank', 'Bank payment for invoice')`).run(uuidv4(), sale.customer_id, tender.bank, sale.invoice_number);
    }
    if (tender.bank > 0) addBankTxn({ direction: 'in', kind: 'sale', amount: tender.bank, reference: sale.invoice_number, notes: `Bank payment - ${sale.invoice_number}` });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    return res.status(400).json({ ok: false, message: error.message || 'Invoice payment could not be updated' });
  }
  res.json({ ok: true, paidAmount, remainingAmount });
});

app.delete('/api/sales/:id', (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ ok: false, message: 'Invoice not found' });
  if (db.prepare('SELECT 1 FROM customer_payment_allocations WHERE sale_id=?').get(sale.id)) {
    return res.status(400).json({ ok: false, message: 'This invoice has later customer payments allocated and cannot be deleted.' });
  }
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
  items.forEach((item) => {
    const restoredQuantity = item.quantity * (item.conversion_factor || 1);
    db.prepare('UPDATE products SET current_stock = current_stock + ? WHERE id = ?').run(restoredQuantity, item.product_id);
    if (item.article_id) db.prepare('UPDATE product_articles SET stock_qty = stock_qty + ? WHERE id=?').run(item.quantity, item.article_id);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
    if (product) recordStockMovement(product, 'SALE_RETURN', restoredQuantity, product.base_unit || product.unit, sale.invoice_number);
  });
  if (sale.customer_id) {
    db.prepare('UPDATE customers SET total_purchases = total_purchases - ?, total_paid = total_paid - ?, remaining_balance = remaining_balance - ? WHERE id = ?')
      .run(sale.total_amount, sale.paid_amount, sale.remaining_amount, sale.customer_id);
    db.prepare('DELETE FROM customer_transactions WHERE customer_id = ? AND reference = ?').run(sale.customer_id, sale.invoice_number);
  }
  db.prepare("DELETE FROM bank_transactions WHERE kind = 'sale' AND reference = ?").run(sale.invoice_number);
  db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(sale.id);
  db.prepare('DELETE FROM sales WHERE id = ?').run(sale.id);
  res.json({ ok: true });
});

app.get('/api/users', (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ ok:false, message:'Admin access required' });
  res.json(db.prepare('SELECT id, username, name, role, created_at FROM users ORDER BY created_at DESC').all());
});

app.post('/api/users', (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ ok:false, message:'Admin access required' });
  const payload = req.body || {};
  if (!payload.username || !payload.password) return res.status(400).json({ ok: false, message: 'Username and password are required' });
  try {
    const user = { id: uuidv4(), username: payload.username.trim(), password: payload.password, name: payload.name || payload.username, role: payload.role || 'cashier', partner_id: payload.partner_id || null };
    db.prepare('INSERT INTO users (id, username, password, name, role, partner_id) VALUES (?, ?, ?, ?, ?, ?)').run(user.id, user.username, user.password, user.name, user.role, user.partner_id);
    res.status(201).json({ ok: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch (error) {
    res.status(400).json({ ok: false, message: 'Username already exists' });
  }
});

app.put('/api/users/:id', (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ ok:false, message:'Admin access required' });
  const payload = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ ok: false, message: 'User not found' });
  db.prepare('UPDATE users SET name = ?, role = ?, password = CASE WHEN ? <> \'\' THEN ? ELSE password END WHERE id = ?')
    .run(payload.name || user.name, payload.role || user.role, payload.password || '', payload.password || '', user.id);
  res.json({ ok: true });
});

app.delete('/api/users/:id', (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ ok:false, message:'Admin access required' });
  const count = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (count <= 1) return res.status(400).json({ ok: false, message: 'At least one user must remain' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/partners/ledger/:id', (req, res) => {
  const partnerId = req.params.id;
  const partner = db.prepare('SELECT * FROM partners WHERE id=?').get(partnerId);
  if (!partner) return res.status(404).json({ ok: false, message: 'Partner not found' });
  if (req.user.role === 'partner' && req.user.partner_id !== partner.id) return res.status(403).json({ ok: false, message: 'Access denied' });
  let partnerBalance = safeNumber(partner.current_balance);
  let advanceBalance = safeNumber(partner.advances);
  const transactions = db.prepare('SELECT * FROM partner_transactions WHERE partner_id = ? ORDER BY created_at DESC, rowid DESC').all(partnerId).map((transaction) => {
    const row = { ...transaction, partner_balance: partnerBalance, advance_balance: advanceBalance };
    const amount = safeNumber(transaction.amount);
    if (['capital_contribution', 'profit_distribution', 'capital_adjustment'].includes(transaction.type)) partnerBalance -= amount;
    if (transaction.type === 'withdrawal') partnerBalance += amount;
    if (transaction.type === 'advance') advanceBalance -= amount;
    if (['advance_repayment', 'advance_offset'].includes(transaction.type)) advanceBalance += amount;
    return row;
  });
  res.json({ partner, transactions });
});

function applyPartnerActivity(payload, forcedType) {
  const partner = db.prepare('SELECT * FROM partners WHERE id=?').get(payload.partner_id);
  const type = forcedType || payload.type;
  const amount = safeNumber(payload.amount);
  const paymentMethod = payload.payment_method || 'Cash';
  const allowedTypes = ['capital_contribution', 'withdrawal', 'advance', 'advance_repayment'];
  if (!partner || !allowedTypes.includes(type) || amount <= 0) throw new Error('Choose a partner, valid activity, and amount greater than zero');
  if (!['Cash', 'Bank', 'Online'].includes(paymentMethod)) throw new Error('Payment source must be Cash or Bank');
  if (type === 'withdrawal' && amount > safeNumber(partner.current_balance)) throw new Error(`Withdrawal cannot exceed partner balance (${toCurrency(partner.current_balance)})`);
  if (type === 'advance_repayment' && amount > safeNumber(partner.advances)) throw new Error(`Repayment cannot exceed advance due (${toCurrency(partner.advances)})`);
  const date = payload.date || new Date().toISOString().slice(0, 10);
  const id = uuidv4();
  const reason = String(payload.reason || type.replace(/_/g, ' '));
  const direction = ['capital_contribution', 'advance_repayment'].includes(type) ? 'in' : 'out';
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO partner_transactions (id, partner_id, type, amount, reason, payment_method, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, partner.id, type, amount, reason, paymentMethod, payload.notes || '', `${date} ${new Date().toISOString().slice(11, 19)}`);
    if (type === 'capital_contribution') db.prepare('UPDATE partners SET capital=capital+?, current_balance=current_balance+? WHERE id=?').run(amount, amount, partner.id);
    if (type === 'withdrawal') db.prepare('UPDATE partners SET withdrawals=withdrawals+?, current_balance=current_balance-? WHERE id=?').run(amount, amount, partner.id);
    if (type === 'advance') db.prepare('UPDATE partners SET advances=advances+? WHERE id=?').run(amount, partner.id);
    if (type === 'advance_repayment') db.prepare('UPDATE partners SET advances=advances-? WHERE id=?').run(amount, partner.id);
    if (['Bank', 'Online'].includes(paymentMethod)) addBankTxn({
      direction, kind: 'partner', amount, reference: `PARTNER-${type}-${id}`, notes: `${partner.name}: ${reason}`, date
    });
    db.exec('COMMIT');
    return { id };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function handlePartnerActivity(req, res, forcedType) {
  if (['partner', 'cashier', 'manager'].includes(req.user.role)) return res.status(403).json({ ok: false, message: 'Admin access required' });
  try {
    const result = applyPartnerActivity(req.body || {}, forcedType);
    return res.status(201).json({ ok: true, ...result });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message || 'Partner activity could not be saved' });
  }
}

app.post('/api/partner-transactions', (req, res) => handlePartnerActivity(req, res));
app.post('/api/partner-withdrawals', (req, res) => handlePartnerActivity(req, res, 'withdrawal'));
app.post('/api/partner-advances', (req, res) => handlePartnerActivity(req, res, 'advance'));
app.post('/api/partner-advance-repayment', (req, res) => handlePartnerActivity(req, res, 'advance_repayment'));

app.get('/api/partners/:id/summary', (req,res) => {
  const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(req.params.id);
  if (!partner) return res.status(404).json({ok:false,message:'Partner not found'});
  if (req.user.role === 'partner' && req.user.partner_id !== partner.id) return res.status(403).json({ok:false,message:'Access denied'});
  const tx = db.prepare('SELECT * FROM partner_transactions WHERE partner_id = ? ORDER BY created_at DESC').all(partner.id);
  const totalProfit = db.prepare('SELECT COALESCE(SUM(profit_total),0) total FROM sales').get().total;
  const totalExpenses = db.prepare('SELECT COALESCE(SUM(amount),0) total FROM expenses').get().total;
  const netProfit = safeNumber(totalProfit) - safeNumber(totalExpenses);
  const profitShare = netProfit * safeNumber(partner.ownership_pct) / 100;
  const advances = safeNumber(partner.advances);
  const withdrawals = safeNumber(partner.withdrawals);
  res.json({partner, transactions:tx, businessNetProfit:netProfit, calculatedProfitShare:profitShare, advanceOutstanding:advances, withdrawableProfit:Math.max(0,profitShare-advances-withdrawals)});
});

app.post('/api/profit-distribution', (req,res) => {
  const totalProfit = Math.max(0, safeNumber(req.body.net_profit));
  const date = req.body.date || new Date().toISOString().slice(0,10);
  const partners = db.prepare('SELECT * FROM partners ORDER BY created_at ASC').all();
  if (!partners.length) return res.status(400).json({ok:false,message:'Add partners first'});
  const shareTotal = partners.reduce((n,p)=>n+safeNumber(p.ownership_pct),0);
  if (Math.abs(shareTotal-100)>0.01) return res.status(400).json({ok:false,message:`Partner ownership must total 100%. Current total: ${shareTotal}%`});
  const results=[];
  db.exec('BEGIN');
  try {
    for (const partner of partners) {
      const grossShare = totalProfit * safeNumber(partner.ownership_pct) / 100;
      const advanceOffset = Math.min(grossShare, safeNumber(partner.advances));
      const payable = grossShare - advanceOffset;
      db.prepare('UPDATE partners SET profit_share = profit_share + ?, current_balance = current_balance + ?, advances = advances - ? WHERE id = ?').run(grossShare, payable, advanceOffset, partner.id);
      db.prepare(`INSERT INTO partner_transactions (id, partner_id, type, amount, reason, payment_method, notes, created_at) VALUES (?, ?, 'profit_distribution', ?, ?, ?, ?, ?)`).run(uuidv4(), partner.id, payable, `Profit distribution ${date}`, 'Internal', `Gross share ${grossShare}; advance offset ${advanceOffset}`, `${date} 00:00:00`);
      if (advanceOffset > 0) db.prepare(`INSERT INTO partner_transactions (id, partner_id, type, amount, reason, payment_method, notes, created_at) VALUES (?, ?, 'advance_offset', ?, ?, 'Internal', ?, ?)`)
        .run(uuidv4(), partner.id, advanceOffset, `Advance offset ${date}`, `Offset against profit distribution`, `${date} 00:00:01`);
      results.push({partnerId:partner.id, partner:partner.name, ownership_pct:safeNumber(partner.ownership_pct), grossShare, advanceOffset, payable});
    }
    db.exec('COMMIT');
    res.json({ok:true,totalProfit,date,results});
  } catch(e){db.exec('ROLLBACK');res.status(400).json({ok:false,message:e.message});}
});

app.get('/api/products/export-excel', (req, res) => {
  const items = db.prepare('SELECT * FROM products ORDER BY name ASC').all();
  const rows = items.map(p => ({
    'Product': p.name, 'Category': p.category, 'Barcode': p.barcode || '',
    'Base Unit': p.base_unit || p.unit, 'Purchase Price': p.purchase_price,
    'Retail Price': p.retail_price, 'Wholesale Price': p.wholesale_price,
    'Current Stock': p.current_stock, 'Min Stock': p.min_stock
  }));
  sendExcel(res, 'Products-Report.xlsx', [['Products', rows]]);
});

app.get('/api/stock/export-excel', (req, res) => {
  const entries = db.prepare(`SELECT se.*, sup.name as supplier_name FROM stock_entries se LEFT JOIN suppliers sup ON sup.id = se.supplier_id ORDER BY se.created_at DESC`).all();
  const rows = entries.map(e => ({
    'Date': e.entry_date, 'Product': e.product_name, 'Quantity': e.quantity,
    'Unit': e.unit, 'Base Quantity': e.base_quantity, 'Unit Cost': e.unit_cost,
    'Expiry': e.expiry_date || '', 'Supplier': e.supplier_name || ''
  }));
  sendExcel(res, 'Stock-Report.xlsx', [['Stock', rows]]);
});

app.get('/api/reports/export-excel', (req, res) => {
  const from = req.query.from || '1970-01-01'; const to = req.query.to || '2999-12-31';
  const sales = db.prepare(`SELECT sale_type, COUNT(*) count, COALESCE(SUM(total_amount),0) sales, COALESCE(SUM(cost_total),0) cogs, COALESCE(SUM(profit_total),0) profit, COALESCE(SUM(paid_amount),0) paid, COALESCE(SUM(remaining_amount),0) receivable FROM sales WHERE date(COALESCE(sale_date,created_at)) BETWEEN ? AND ? GROUP BY sale_type`).all(from, to);
  const expenses = db.prepare(`SELECT category, COALESCE(SUM(amount),0) amount FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category ORDER BY amount DESC`).all(from, to);
  const products = db.prepare(`SELECT sale_items.product_name, SUM(sale_items.quantity) qty, SUM(sale_items.total_profit) profit, SUM(sale_items.subtotal - sale_items.discount_amount) revenue FROM sale_items JOIN sales ON sales.id=sale_items.sale_id WHERE date(COALESCE(sales.sale_date,sales.created_at)) BETWEEN ? AND ? GROUP BY sale_items.product_name ORDER BY profit DESC LIMIT 200`).all(from, to);
  sendExcel(res, `Business-Report-${from}-to-${to}.xlsx`, [
    ['Sales Summary', sales.map(s => ({ 'Type': s.sale_type, 'Sales': s.sales, 'COGS': s.cogs, 'Profit': s.profit, 'Paid': s.paid, 'Receivable': s.receivable }))],
    ['Expenses', expenses.map(e => ({ 'Category': e.category, 'Amount': e.amount }))],
    ['Top Products', products.map(p => ({ 'Product': p.product_name, 'Revenue': p.revenue, 'Profit': p.profit, 'Qty Sold': p.qty }))]
  ]);
});

app.get('/api/reports/comprehensive', (req,res) => {
  const from = req.query.from || '1970-01-01'; const to = req.query.to || '2999-12-31';
  const sales = db.prepare(`SELECT sale_type, COUNT(*) count, COALESCE(SUM(total_amount),0) sales, COALESCE(SUM(cost_total),0) cogs, COALESCE(SUM(profit_total),0) profit, COALESCE(SUM(paid_amount),0) paid, COALESCE(SUM(remaining_amount),0) receivable FROM sales WHERE date(COALESCE(sale_date,created_at)) BETWEEN ? AND ? GROUP BY sale_type`).all(from,to);
  const purchases = db.prepare(`SELECT COUNT(*) count, COALESCE(SUM(total_amount),0) total, COALESCE(SUM(paid_amount),0) paid, COALESCE(SUM(remaining_amount),0) payable FROM purchases WHERE date(created_at) BETWEEN ? AND ?`).get(from,to);
  const expenses = db.prepare(`SELECT category, COALESCE(SUM(amount),0) amount FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category ORDER BY amount DESC`).all(from,to);
  const products = db.prepare(`SELECT sale_items.product_name, SUM(sale_items.quantity) qty, SUM(sale_items.total_profit) profit, SUM(sale_items.subtotal - sale_items.discount_amount) revenue FROM sale_items JOIN sales ON sales.id=sale_items.sale_id WHERE date(COALESCE(sales.sale_date,sales.created_at)) BETWEEN ? AND ? GROUP BY sale_items.product_name ORDER BY profit DESC LIMIT 100`).all(from,to);
  const categories = db.prepare(`SELECT COALESCE(p.category,'Uncategorized') category, SUM(si.subtotal-si.discount_amount) revenue, SUM(si.total_profit) profit FROM sale_items si JOIN sales s ON s.id=si.sale_id LEFT JOIN products p ON p.id=si.product_id WHERE date(COALESCE(s.sale_date,s.created_at)) BETWEEN ? AND ? GROUP BY COALESCE(p.category,'Uncategorized') ORDER BY profit DESC`).all(from,to);
  res.json({from,to,sales,purchases,expenses,products,categories});
});

app.get('/api/reports/daily', (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ ok: false, message: 'Choose a valid report date.' });
  }

  const sales = db.prepare(`SELECT invoice_number AS reference, COALESCE(customer_name, 'Walk-in Customer') AS customer,
      sale_type AS type, total_amount AS total,
      MAX(0,cash_paid-COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa
        JOIN customer_transactions ct ON ct.id=cpa.transaction_id WHERE cpa.sale_id=sales.id AND ct.payment_method='Cash'),0)) AS cash,
      MAX(0,bank_paid-COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa
        JOIN customer_transactions ct ON ct.id=cpa.transaction_id WHERE cpa.sale_id=sales.id AND ct.payment_method IN ('Bank','Online')),0)) AS bank,
      MAX(0,total_amount-(paid_amount-COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa
        WHERE cpa.sale_id=sales.id),0))-COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa
        JOIN customer_transactions ct ON ct.id=cpa.transaction_id WHERE cpa.sale_id=sales.id AND date(ct.created_at)<=?),0)) AS due,
      profit_total AS profit
    FROM sales WHERE date(COALESCE(sale_date, created_at))=? ORDER BY created_at, rowid`).all(date, date);
  const soldItems = db.prepare(`SELECT s.invoice_number AS reference, COALESCE(s.customer_name, 'Walk-in Customer') AS customer,
      si.product_name AS product, COALESCE(a.name, '') AS article, si.quantity, si.subtotal-si.discount_amount AS amount,
      si.total_cost AS cost, si.total_profit AS profit
    FROM sale_items si JOIN sales s ON s.id=si.sale_id LEFT JOIN product_articles a ON a.id=si.article_id
    WHERE date(COALESCE(s.sale_date,s.created_at))=? ORDER BY s.created_at, si.rowid`).all(date);

  const purchaseRows = db.prepare(`SELECT COALESCE(p.date,date(p.created_at)) AS date, p.invoice_number AS reference,
      COALESCE(s.name,p.supplier_name,'Supplier') AS supplier, 'Purchase' AS type, p.total_amount AS total,
      MAX(0,p.cash_paid-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
        JOIN supplier_transactions st ON st.id=spa.transaction_id WHERE spa.entry_type='purchase' AND spa.entry_id=p.id AND st.payment_method='Cash'),0)) AS cash,
      MAX(0,p.bank_paid-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
        JOIN supplier_transactions st ON st.id=spa.transaction_id WHERE spa.entry_type='purchase' AND spa.entry_id=p.id AND st.payment_method IN ('Bank','Online')),0)) AS bank,
      MAX(0,p.total_amount-(p.paid_amount-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
        WHERE spa.entry_type='purchase' AND spa.entry_id=p.id),0))-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
        JOIN supplier_transactions st ON st.id=spa.transaction_id WHERE spa.entry_type='purchase' AND spa.entry_id=p.id AND date(st.created_at)<=?),0)) AS due
    FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id
    WHERE date(COALESCE(p.date,p.created_at))=?`).all(date, date);
  const stockRows = db.prepare(`SELECT se.entry_date AS date, COALESCE(se.reference,'Stock In') AS reference,
      COALESCE(s.name,'Supplier') AS supplier, 'Stock In' AS type, se.total_cost AS total,
      MAX(0,se.cash_paid-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
        JOIN supplier_transactions st ON st.id=spa.transaction_id WHERE spa.entry_type='stock' AND spa.entry_id=se.id AND st.payment_method='Cash'),0)) AS cash,
      MAX(0,se.bank_paid-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
        JOIN supplier_transactions st ON st.id=spa.transaction_id WHERE spa.entry_type='stock' AND spa.entry_id=se.id AND st.payment_method IN ('Bank','Online')),0)) AS bank,
      MAX(0,se.total_cost-(se.paid_amount-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
        WHERE spa.entry_type='stock' AND spa.entry_id=se.id),0))-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
        JOIN supplier_transactions st ON st.id=spa.transaction_id WHERE spa.entry_type='stock' AND spa.entry_id=se.id AND date(st.created_at)<=?),0)) AS due
    FROM stock_entries se LEFT JOIN suppliers s ON s.id=se.supplier_id
    WHERE se.entry_date=? AND se.total_cost>0`).all(date, date);
  const purchases = [...purchaseRows, ...stockRows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const purchasedItems = [
    ...db.prepare(`SELECT p.invoice_number AS reference, COALESCE(s.name,p.supplier_name,'Supplier') AS supplier,
        pi.product_name AS product, COALESCE(a.name,pi.product_name) AS article, pi.quantity,
        COALESCE(a.package_type,'') AS unit, pi.total_cost AS amount
      FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id
      LEFT JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN product_articles a ON a.id=pi.article_id
      WHERE date(COALESCE(p.date,p.created_at))=?`).all(date),
    ...db.prepare(`SELECT COALESCE(se.reference,'Stock In') AS reference, COALESCE(s.name,'Supplier') AS supplier,
        se.product_name AS product, COALESCE(a.name,se.product_name) AS article, se.quantity,
        se.unit, se.total_cost AS amount
      FROM stock_entries se LEFT JOIN suppliers s ON s.id=se.supplier_id LEFT JOIN product_articles a ON a.id=se.article_id
      WHERE se.entry_date=? AND se.total_cost>0`).all(date)
  ];

  const customerPayments = db.prepare(`SELECT date(ct.created_at) AS date, COALESCE(c.name,'Customer') AS customer,
      ct.payment_method AS method, COALESCE(ct.reference,'') AS reference, ct.amount
    FROM customer_transactions ct LEFT JOIN customers c ON c.id=ct.customer_id
    WHERE ct.type='payment' AND date(ct.created_at)=?
      AND NOT (EXISTS (SELECT 1 FROM sales s WHERE s.invoice_number=ct.reference)
        AND (ct.notes LIKE '%paid with sale%' OR ct.notes LIKE '%payment for invoice%'))
    ORDER BY ct.created_at, ct.rowid`).all(date);
  const supplierPayments = db.prepare(`SELECT date(st.created_at) AS date, COALESCE(s.name,'Supplier') AS supplier,
      st.payment_method AS method, COALESCE(st.reference,'') AS reference, st.amount
    FROM supplier_transactions st LEFT JOIN suppliers s ON s.id=st.supplier_id
    WHERE st.type='payment' AND date(st.created_at)=?
      AND NOT ((EXISTS (SELECT 1 FROM purchases p WHERE p.invoice_number=st.reference) AND st.notes LIKE '%paid with purchase%')
        OR (EXISTS (SELECT 1 FROM stock_entries se WHERE 'STOCK-IN-' || se.id=st.reference) AND st.notes LIKE '%paid with stock-in%'))
    ORDER BY st.created_at, st.rowid`).all(date);
  const expenses = db.prepare(`SELECT date, name, category, payment_method AS method, description, amount
    FROM expenses WHERE date=? ORDER BY created_at, rowid`).all(date);
  const partnerActivity = db.prepare(`SELECT date(t.created_at) AS date, p.name AS partner, t.type,
      t.payment_method AS method, COALESCE(t.reason,t.notes,t.type) AS reason, t.amount
    FROM partner_transactions t LEFT JOIN partners p ON p.id=t.partner_id
    WHERE date(t.created_at)=? ORDER BY t.created_at, t.rowid`).all(date);
  const bankTransactions = db.prepare(`SELECT date(t.txn_date) AS date, a.name AS account, t.kind,
      COALESCE(t.reference,t.notes,'') AS reference, t.direction, t.amount
    FROM bank_transactions t JOIN bank_accounts a ON a.id=t.account_id
    WHERE date(t.txn_date)=? ORDER BY t.txn_date,t.created_at,t.rowid`).all(date);

  const cashSales = db.prepare(`SELECT COALESCE(SUM(MAX(0,cash_paid-COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa
      JOIN customer_transactions ct ON ct.id=cpa.transaction_id WHERE cpa.sale_id=sales.id AND ct.payment_method='Cash'),0))),0) AS total FROM sales
    WHERE date(COALESCE(sale_date,created_at))=?`).get(date).total;
  const cashPurchases = db.prepare(`SELECT COALESCE(SUM(MAX(0,cash_paid-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
      JOIN supplier_transactions st ON st.id=spa.transaction_id WHERE spa.entry_type='purchase' AND spa.entry_id=purchases.id AND st.payment_method='Cash'),0))),0) AS total FROM purchases
    WHERE date(COALESCE(date,created_at))=?`).get(date).total;
  const cashStock = db.prepare(`SELECT COALESCE(SUM(MAX(0,cash_paid-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
      JOIN supplier_transactions st ON st.id=spa.transaction_id WHERE spa.entry_type='stock' AND spa.entry_id=stock_entries.id AND st.payment_method='Cash'),0))),0) AS total FROM stock_entries WHERE entry_date=?`).get(date).total;
  const cashCustomerPayments = customerPayments.reduce((sum, payment) => sum + (payment.method === 'Cash' ? safeNumber(payment.amount) : 0), 0);
  const cashSupplierPayments = supplierPayments.reduce((sum, payment) => sum + (payment.method === 'Cash' ? safeNumber(payment.amount) : 0), 0);
  const cashExpenses = expenses.reduce((sum, expense) => sum + (expense.method === 'Cash' ? safeNumber(expense.amount) : 0), 0);
  const cashPartnerIn = partnerActivity.reduce((sum, transaction) =>
    sum + (transaction.method === 'Cash' && ['capital_contribution','advance_repayment'].includes(transaction.type) ? safeNumber(transaction.amount) : 0)
      + (transaction.method === 'Cash' && transaction.type === 'capital_adjustment' && safeNumber(transaction.amount) > 0 ? safeNumber(transaction.amount) : 0), 0);
  const cashPartnerOut = partnerActivity.reduce((sum, transaction) =>
    sum + (transaction.method === 'Cash' && ['withdrawal','advance'].includes(transaction.type) ? safeNumber(transaction.amount) : 0)
      + (transaction.method === 'Cash' && transaction.type === 'capital_adjustment' && safeNumber(transaction.amount) < 0 ? Math.abs(safeNumber(transaction.amount)) : 0), 0);
  const bankIn = bankTransactions.reduce((sum, transaction) => sum + (transaction.direction === 'in' ? safeNumber(transaction.amount) : 0), 0);
  const bankOut = bankTransactions.reduce((sum, transaction) => sum + (transaction.direction === 'out' ? safeNumber(transaction.amount) : 0), 0);
  const salesTotal = sales.reduce((sum, sale) => sum + safeNumber(sale.total), 0);
  const grossProfit = sales.reduce((sum, sale) => sum + safeNumber(sale.profit), 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + safeNumber(expense.amount), 0);
  const summary = {
    salesTotal,
    grossProfit,
    expenses: expenseTotal,
    netProfit: grossProfit - expenseTotal,
    purchasesTotal: purchases.reduce((sum, purchase) => sum + safeNumber(purchase.total), 0),
    customerReceipts: customerPayments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0),
    supplierPayments: supplierPayments.reduce((sum, payment) => sum + safeNumber(payment.amount), 0),
    salesDue: sales.reduce((sum, sale) => sum + safeNumber(sale.due), 0),
    cashIn: safeNumber(cashSales) + cashCustomerPayments + cashPartnerIn,
    cashOut: safeNumber(cashPurchases) + safeNumber(cashStock) + cashSupplierPayments + cashExpenses + cashPartnerOut,
    bankIn,
    bankOut
  };
  res.json({ ok: true, date, summary, sales, soldItems, purchases, purchasedItems, customerPayments, supplierPayments, expenses, partnerActivity, bankTransactions });
});

app.get('/api/data-info', (req,res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ok:false,message:'Admin access required'});
  let size = 0;
  try { size = fs.statSync(dbPath).size; } catch {}
  res.json({ ok:true, databasePath: dbPath, backupDirectory: backupDir, databaseSizeBytes: size, pendingRestore: fs.existsSync(pendingRestorePath) });
});

app.get('/api/audit-logs', (req,res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ok:false,message:'Admin access required'});
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200').all();
  res.json({ ok:true, logs });
});

app.get('/api/settings', (req,res) => {
  const row = db.prepare("SELECT * FROM app_settings WHERE id='default'").get();
  res.json({ ok:true, settings: row });
});

app.put('/api/settings', (req,res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ok:false,message:'Admin access required'});
  const b = req.body || {};
  db.prepare(`UPDATE app_settings SET shop_name=?, shop_phone=?, shop_address=?, receipt_footer=?, printer_name=?, whatsapp_template=? WHERE id='default'`)
    .run(
      String(b.shop_name || 'ShopFlow Pro'),
      String(b.shop_phone || ''),
      String(b.shop_address || ''),
      String(b.receipt_footer || 'Thank you for shopping with us!'),
      String(b.printer_name || ''),
      String(b.whatsapp_template || 'Assalam o Alaikum {name}, aapka account balance {balance} hai. Meharbani karke payment update kar dein. Shukriya.')
    );
  res.json({ ok:true, settings: db.prepare("SELECT * FROM app_settings WHERE id='default'").get() });
});

app.get('/api/backup', (req,res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ok:false,message:'Admin access required'});
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    const destination = path.join(manualBackupDir, `shop-backup-${stamp}.db`);
    snapshotDatabase(destination);
    res.download(destination, path.basename(destination));
  } catch (error) { res.status(500).json({ok:false,message:`Backup failed: ${error.message}`}); }
});

const restoreUpload = multer({ storage: multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dataDir),
  filename: (_req, _file, cb) => cb(null, `restore-upload-${Date.now()}.db`)
}), limits: { fileSize: 500 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  cb(null, /\.db$/i.test(file.originalname) || file.mimetype === 'application/octet-stream');
} });

app.post('/api/restore', restoreUpload.single('database'), (req,res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(403).json({ok:false,message:'Admin access required'});
  }
  if (!req.file) return res.status(400).json({ok:false,message:'Please select a .db backup file.'});
  try {
    const testDb = new DatabaseSync(req.file.path, { readOnly: true });
    const required = ['products','sales','purchases','customers','suppliers'];
    const missing = required.filter(name => !testDb.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=?').get(name));
    testDb.close();
    if (missing.length) throw new Error(`Invalid SHOP ERP backup. Missing tables: ${missing.join(', ')}`);
    if (fs.existsSync(pendingRestorePath)) fs.unlinkSync(pendingRestorePath);
    fs.renameSync(req.file.path, pendingRestorePath);
    res.json({ok:true,message:'Backup validated. Restart SHOP ERP to apply the restored database.'});
  } catch (error) {
    try { fs.unlinkSync(req.file.path); } catch {}
    res.status(400).json({ok:false,message:`Restore rejected: ${error.message}`});
  }
});

app.delete('/api/purchases/:id', (req,res) => {
  const purchase = db.prepare('SELECT * FROM purchases WHERE id=?').get(req.params.id);
  if (!purchase) return res.status(404).json({ok:false,message:'Purchase not found'});
  if (db.prepare("SELECT 1 FROM supplier_payment_allocations WHERE entry_type='purchase' AND entry_id=?").get(purchase.id)) {
    return res.status(400).json({ ok: false, message: 'This purchase has later supplier payments allocated and cannot be deleted.' });
  }
  const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id=?').all(purchase.id);
  db.exec('BEGIN');
  try {
    for (const item of items) {
      const product=db.prepare('SELECT * FROM products WHERE id=?').get(item.product_id);
      const baseQty=safeNumber(item.quantity)*(safeNumber(item.conversion_factor)||safeNumber(product?.purchase_factor)||1);
      const current=safeNumber(product?.current_stock);
      if (!product || current < baseQty) throw new Error(`Cannot delete purchase: insufficient stock remaining for ${item.product_name}`);
      db.prepare('UPDATE products SET current_stock=current_stock-? WHERE id=?').run(baseQty,item.product_id);
      if(item.article_id){ const ar=db.prepare('SELECT * FROM product_articles WHERE id=?').get(item.article_id); if(ar && ar.stock_qty < safeNumber(item.quantity)) throw new Error(`Cannot delete purchase: insufficient article stock for ${item.product_name}`); if(ar) db.prepare('UPDATE product_articles SET stock_qty=stock_qty-? WHERE id=?').run(safeNumber(item.quantity),ar.id); }
      if(product) recordStockMovement(product,'PURCHASE_DELETE',-baseQty,product.base_unit||product.unit,purchase.invoice_number);
    }
    if(purchase.supplier_id) db.prepare('UPDATE suppliers SET total_purchases=total_purchases-?, total_paid=total_paid-?, remaining_payable=remaining_payable-? WHERE id=?').run(purchase.total_amount,purchase.paid_amount,purchase.remaining_amount,purchase.supplier_id);
    db.prepare('DELETE FROM supplier_transactions WHERE reference=?').run(purchase.invoice_number);
    db.prepare("DELETE FROM bank_transactions WHERE kind='purchase' AND reference=?").run(purchase.invoice_number);
    db.prepare('DELETE FROM purchase_items WHERE purchase_id=?').run(purchase.id);
    db.prepare('DELETE FROM purchases WHERE id=?').run(purchase.id);
    db.exec('COMMIT'); res.json({ok:true});
  } catch(e){db.exec('ROLLBACK');res.status(400).json({ok:false,message:e.message});}
});

app.delete('/api/expenses/:id', (req,res) => {
  const expense = db.prepare('SELECT * FROM expenses WHERE id=?').get(req.params.id);
  if (!expense) return res.status(404).json({ok:false,message:'Expense not found'});
  db.exec('BEGIN');
  try {
    db.prepare("DELETE FROM bank_transactions WHERE kind='expense' AND reference=?").run(expense.id);
    db.prepare('DELETE FROM expenses WHERE id=?').run(expense.id);
    db.exec('COMMIT');
    res.json({ok:true});
  } catch (error) {
    db.exec('ROLLBACK');
    res.status(400).json({ok:false,message:error.message || 'Expense could not be deleted'});
  }
});

app.get('/api/reports', (req, res) => {
  const date = req.query.date;
  const from = req.query.from;
  const to = req.query.to;
  const search = String(req.query.search || '').trim();
  const filters = [];
  const params = [];
  if (date) { filters.push('date(COALESCE(s.sale_date, s.created_at)) = ?'); params.push(date); }
  if (from) { filters.push('date(COALESCE(s.sale_date, s.created_at)) >= ?'); params.push(from); }
  if (to) { filters.push('date(COALESCE(s.sale_date, s.created_at)) <= ?'); params.push(to); }
  if (search) {
    filters.push(`(s.invoice_number LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ? OR EXISTS (SELECT 1 FROM sale_items sx WHERE sx.sale_id = s.id AND sx.product_name LIKE ?))`);
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const sales = db.prepare(`SELECT s.* FROM sales s ${where} ORDER BY s.created_at DESC`).all(...params);
  const recentItems = db.prepare(`SELECT sale_items.* FROM sale_items JOIN sales s ON s.id = sale_items.sale_id ${where} ORDER BY sale_items.created_at DESC LIMIT 20`).all(...params);
  const expenseFilters = date ? 'WHERE date = ?' : from || to ? `${from ? 'WHERE date >= ?' : 'WHERE 1 = 1'}${to ? `${from ? ' AND' : ' AND'} date <= ?` : ''}` : '';
  const expenseParams = date ? [date] : [ ...(from ? [from] : []), ...(to ? [to] : []) ];
  const expenses = db.prepare(`SELECT * FROM expenses ${expenseFilters} ORDER BY created_at DESC`).all(...expenseParams);
  const topProducts = db.prepare(`
    SELECT sale_items.product_name, SUM(sale_items.quantity) as qty, SUM(sale_items.total_profit) as profit
    FROM sale_items JOIN sales s ON s.id = sale_items.sale_id
    ${where}
    GROUP BY product_name
    ORDER BY qty DESC
    LIMIT 10
  `).all(...params);

  res.json({ sales, recentItems, expenses, topProducts });
});

app.get('/api/accounts/daily', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const sales = db.prepare('SELECT COALESCE(SUM(total_amount), 0) AS total, COALESCE(SUM(paid_amount), 0) AS paid, COALESCE(SUM(profit_total), 0) AS profit, COUNT(*) AS count FROM sales WHERE date(COALESCE(sale_date, created_at)) = ?').get(date);
  const purchases = db.prepare('SELECT COALESCE(SUM(total_amount), 0) AS total, COALESCE(SUM(paid_amount), 0) AS paid, COUNT(*) AS count FROM purchases WHERE date(COALESCE(date,created_at)) = ?').get(date);
  const expenses = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM expenses WHERE date = ?').get(date);
  const stockIn = db.prepare('SELECT COALESCE(SUM(total_cost), 0) AS total, COALESCE(SUM(base_quantity), 0) AS quantity, COUNT(*) AS count FROM stock_entries WHERE entry_date = ?').get(date);
  const cashSales = db.prepare(`SELECT COALESCE(SUM(MAX(0,cash_paid-COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa
    JOIN customer_transactions ct ON ct.id=cpa.transaction_id WHERE cpa.sale_id=sales.id AND ct.payment_method='Cash'),0))),0) total
    FROM sales WHERE date(COALESCE(sale_date,created_at))=?`).get(date);
  const cashPurchases = db.prepare(`SELECT COALESCE(SUM(MAX(0,cash_paid-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
    JOIN supplier_transactions st ON st.id=spa.transaction_id WHERE spa.entry_type='purchase' AND spa.entry_id=purchases.id AND st.payment_method='Cash'),0))),0) total
    FROM purchases WHERE date(COALESCE(date,created_at))=?`).get(date);
  const cashStockIn = db.prepare(`SELECT COALESCE(SUM(MAX(0,cash_paid-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
    JOIN supplier_transactions st ON st.id=spa.transaction_id WHERE spa.entry_type='stock' AND spa.entry_id=stock_entries.id AND st.payment_method='Cash'),0))),0) total
    FROM stock_entries WHERE date(entry_date)=?`).get(date);
  const cashExpenses = db.prepare("SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE payment_method='Cash' AND date=?").get(date);
  const customerPayments = db.prepare(`SELECT COALESCE(SUM(ct.amount),0) total FROM customer_transactions ct
    WHERE ct.type='payment' AND ct.payment_method='Cash' AND date(ct.created_at)=?
    AND NOT (EXISTS (SELECT 1 FROM sales s WHERE s.invoice_number=ct.reference)
      AND (ct.notes LIKE '%paid with sale%' OR ct.notes LIKE '%payment for invoice%'))
    `).get(date);
  const supplierPayments = db.prepare(`SELECT COALESCE(SUM(st.amount),0) total FROM supplier_transactions st
    WHERE st.type='payment' AND st.payment_method='Cash' AND date(st.created_at)=?
    AND NOT ((EXISTS (SELECT 1 FROM purchases p WHERE p.invoice_number=st.reference) AND st.notes LIKE '%paid with purchase%')
      OR (EXISTS (SELECT 1 FROM stock_entries se WHERE 'STOCK-IN-' || se.id=st.reference) AND st.notes LIKE '%paid with stock-in%'))
    `).get(date);
  const partnerOut = db.prepare("SELECT COALESCE(SUM(CASE WHEN type='capital_adjustment' THEN ABS(amount) ELSE amount END),0) total FROM partner_transactions WHERE (type IN ('withdrawal','advance') OR (type='capital_adjustment' AND amount<0)) AND payment_method='Cash' AND date(created_at) = ?").get(date);
  const partnerRepay = db.prepare("SELECT COALESCE(SUM(amount),0) total FROM partner_transactions WHERE type='advance_repayment' AND payment_method='Cash' AND date(created_at) = ?").get(date);
  const partnerContributions = db.prepare("SELECT COALESCE(SUM(amount),0) total FROM partner_transactions WHERE (type='capital_contribution' OR (type='capital_adjustment' AND amount>0)) AND payment_method='Cash' AND date(created_at) = ?").get(date);
  const cashIn = safeNumber(cashSales.total) + safeNumber(customerPayments.total) + safeNumber(partnerRepay.total) + safeNumber(partnerContributions.total);
  const cashOut = safeNumber(cashPurchases.total) + safeNumber(cashStockIn.total) + safeNumber(supplierPayments.total) +
    safeNumber(cashExpenses.total) + safeNumber(partnerOut.total);
  res.json({ date, sales, purchases, expenses, stockIn, customerPayments, supplierPayments, partnerOut, partnerRepay, partnerContributions,
    cashIn, cashOut, cash: cashIn - cashOut,
    netProfit: safeNumber(sales.profit) - safeNumber(expenses.total) });
});

app.use(express.static(path.join(rootDir, 'public')));



// ===== Dukaan ke products (atta, ghee, blade) ek click mein =====
app.post('/api/setup/shop-products', (req, res) => {
  const defs = [
    { name: 'Atta 50 KG', category: 'Atta', base: 'kg', arts: [['Poori Bori 50 KG', 'Bag', 50], ['Loose (1 KG)', 'Loose', 1]] },
    { name: 'Atta 10 KG', category: 'Atta', base: 'kg', arts: [['Poori Bori 10 KG', 'Bag', 10], ['Loose (1 KG)', 'Loose', 1]] },
    { name: 'Ghee 16 KG Balti', category: 'Ghee', base: 'kg', arts: [['Poori Balti 16 KG', 'Bucket', 16], ['Loose (1 KG)', 'Loose', 1]] },
    { name: 'Ghee 1 KG Pouch', category: 'Ghee', base: 'pcs', arts: [['Pouch 1 KG', 'Pouch', 1]] },
    { name: 'Ghee 500 G Pouch', category: 'Ghee', base: 'pcs', arts: [['Pouch 500 G', 'Pouch', 1]] },
    { name: 'Ghee 250 G Pouch', category: 'Ghee', base: 'pcs', arts: [['Pouch 250 G', 'Pouch', 1]] },
    { name: 'Blade (10 pcs ki dhabi)', category: 'Blade', base: 'pcs', arts: [['Poora Card (20 dhabi)', 'Card', 200], ['Dhabi (10 pcs)', 'Dhabi', 10], ['Single Blade', 'Piece', 1]] },
    { name: 'Blade (5 pcs ki dhabi)', category: 'Blade', base: 'pcs', arts: [['Poora Card (20 dhabi)', 'Card', 100], ['Dhabi (5 pcs)', 'Dhabi', 5], ['Single Blade', 'Piece', 1]] }
  ];
  let created = 0;
  const insP = db.prepare(`INSERT INTO products (id, barcode, name, category, brand, unit, base_unit, purchase_unit, sale_unit, stock_unit, unit_factor, purchase_factor, current_stock) VALUES (?, ?, ?, ?, 'N/A', ?, ?, ?, ?, ?, 1, 1, 0)`);
  const insA = db.prepare(`INSERT INTO product_articles (id, product_id, name, package_type, package_size, base_unit, base_per_unit, level_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  db.transaction(() => {
    defs.forEach((d, i) => {
      if (db.prepare('SELECT 1 FROM products WHERE name = ?').get(d.name)) return;
      const pid = uuidv4();
      insP.run(pid, `SF-${Date.now()}-${i}`, d.name, d.category, d.base, d.base, d.base, d.base, d.base);
      d.arts.forEach((a, n) => insA.run(uuidv4(), pid, a[0], a[1], a[2], d.base, a[2], n + 1));
      created++;
    });
  })();
  res.json({ ok: true, created, message: created ? `${created} products ban gaye. Ab Products mein har article ka rate set karo.` : 'Ye products pehle se maujood hain.' });
});

// ===== Hisab kitab reports =====
app.get('/api/reports/stock', (req, res) => {
  const rows = db.prepare(`SELECT id, name, category, base_unit, current_stock, min_stock, purchase_price, retail_price,
      current_stock * purchase_price AS stock_value, current_stock * retail_price AS sale_value FROM products WHERE status <> 'deleted' ORDER BY category, name`).all();
  const totals = rows.reduce((t, r) => ({ value: t.value + safeNumber(r.stock_value), saleValue: t.saleValue + safeNumber(r.sale_value),
    low: t.low + (r.current_stock <= r.min_stock ? 1 : 0) }), { value: 0, saleValue: 0, low: 0 });
  res.json({ ok: true, rows, totals });
});

app.get('/api/reports/products', (req, res) => {
  const from = req.query.from || '1970-01-01', to = req.query.to || '2999-12-31';
  const rows = db.prepare(`SELECT si.product_name, SUM(si.quantity) AS qty, SUM(si.subtotal - si.discount_amount) AS revenue,
      SUM(si.total_cost) AS cost, SUM(si.total_profit) AS profit
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE date(COALESCE(s.sale_date, s.created_at)) BETWEEN ? AND ?
    GROUP BY si.product_name ORDER BY revenue DESC`).all(from, to);
  res.json({ ok: true, rows });
});

app.get('/api/reports/expenses', (req, res) => {
  const from = req.query.from || '1970-01-01', to = req.query.to || '2999-12-31';
  const rows = db.prepare('SELECT * FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC').all(from, to);
  const byCategory = db.prepare('SELECT category, SUM(amount) AS amount FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category ORDER BY amount DESC').all(from, to);
  res.json({ ok: true, rows, byCategory, total: rows.reduce((t, r) => t + safeNumber(r.amount), 0) });
});

app.get('/api/reports/partners', (req, res) => {
  const from = req.query.from || '1970-01-01', to = req.query.to || '2999-12-31';
  const rows = db.prepare(`SELECT t.*, p.name AS partner_name FROM partner_transactions t LEFT JOIN partners p ON p.id = t.partner_id
    WHERE date(t.created_at) BETWEEN ? AND ? ORDER BY t.created_at DESC`).all(from, to);
  const summary = db.prepare('SELECT name, capital, ownership_pct, withdrawals, advances, profit_share, current_balance FROM partners ORDER BY name').all();
  res.json({ ok: true, rows, summary });
});

app.get('/api/reports/due-customers', (req, res) => {
  const rows = db.prepare(`SELECT id, name, phone, total_purchases, total_paid, remaining_balance
    FROM customers WHERE remaining_balance > 0 ORDER BY remaining_balance DESC, name`).all();
  res.json({ ok: true, rows, total: rows.reduce((sum, row) => sum + safeNumber(row.remaining_balance), 0) });
});

app.get('/api/reports/due-suppliers', (req, res) => {
  const rows = db.prepare(`SELECT id, name, phone, total_purchases, total_paid, remaining_payable
    FROM suppliers WHERE remaining_payable > 0 ORDER BY remaining_payable DESC, name`).all();
  res.json({ ok: true, rows, total: rows.reduce((sum, row) => sum + safeNumber(row.remaining_payable), 0) });
});

app.get('/api/reports/purchases', (req, res) => {
  const from = req.query.from || '1970-01-01', to = req.query.to || '2999-12-31';
  const invoices = db.prepare(`SELECT invoice_number AS reference, COALESCE(date, date(created_at)) AS date, supplier_name AS party,
      total_amount AS total, paid_amount AS paid, remaining_amount AS due, 'Purchase' AS type
    FROM purchases WHERE date(COALESCE(date, created_at)) BETWEEN ? AND ?`).all(from, to);
  const stockEntries = db.prepare(`SELECT COALESCE(reference, 'Stock-in') AS reference, entry_date AS date,
      COALESCE((SELECT name FROM suppliers WHERE id = stock_entries.supplier_id), 'Supplier') AS party,
      total_cost AS total, paid_amount AS paid, total_cost - paid_amount AS due, 'Stock In' AS type
    FROM stock_entries WHERE entry_date BETWEEN ? AND ? AND total_cost > 0`).all(from, to);
  const rows = [...invoices, ...stockEntries].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  res.json({ ok: true, rows, total: rows.reduce((sum, row) => sum + safeNumber(row.total), 0),
    paid: rows.reduce((sum, row) => sum + safeNumber(row.paid), 0), due: rows.reduce((sum, row) => sum + safeNumber(row.due), 0) });
});

app.get('/api/reports/supplier-items', (req, res) => {
  const from = req.query.from || '1970-01-01', to = req.query.to || '2999-12-31';
  const supplierId = req.query.supplier_id || null;
  const purchaseRows = db.prepare(`SELECT p.date, p.invoice_number AS reference, COALESCE(s.name, p.supplier_name, 'Supplier') AS supplier,
      pi.product_name AS product, COALESCE(a.name, pi.product_name) AS article, pi.quantity, pi.conversion_factor,
      pi.unit_cost, pi.total_cost AS amount, 'Purchase' AS source
    FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id
    LEFT JOIN suppliers s ON s.id=p.supplier_id LEFT JOIN product_articles a ON a.id=pi.article_id
    WHERE date(COALESCE(p.date,p.created_at)) BETWEEN ? AND ? AND (? IS NULL OR p.supplier_id=?)`)
    .all(from, to, supplierId, supplierId);
  const stockRows = db.prepare(`SELECT se.entry_date AS date, COALESCE(se.reference, 'Stock In') AS reference,
      COALESCE(s.name, 'Supplier') AS supplier, se.product_name AS product, COALESCE(a.name, se.product_name) AS article,
      se.quantity, se.conversion_factor, se.unit_cost, se.total_cost AS amount, 'Stock In' AS source
    FROM stock_entries se LEFT JOIN suppliers s ON s.id=se.supplier_id LEFT JOIN product_articles a ON a.id=se.article_id
    WHERE se.entry_date BETWEEN ? AND ? AND se.total_cost>0 AND (? IS NULL OR se.supplier_id=?)`)
    .all(from, to, supplierId, supplierId);
  const rows = [...purchaseRows, ...stockRows].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  res.json({ ok: true, rows, total: rows.reduce((sum, row) => sum + safeNumber(row.amount), 0) });
});

app.get('/api/reports/cash', (req, res) => {
  const from = req.query.from || '1970-01-01', to = req.query.to || '2999-12-31';
  const ranges = [from, to];
  const rows = [
    ...db.prepare(`SELECT COALESCE(sale_date, date(created_at)) AS date, invoice_number AS reference, customer_name AS party, 'Sale' AS type,
        MAX(0,cash_paid-COALESCE((SELECT SUM(cpa.amount) FROM customer_payment_allocations cpa
          JOIN customer_transactions ct ON ct.id=cpa.transaction_id WHERE cpa.sale_id=sales.id AND ct.payment_method='Cash'),0)) AS amount, 'in' AS direction
      FROM sales WHERE date(COALESCE(sale_date, created_at)) BETWEEN ? AND ? AND cash_paid > 0`).all(...ranges),
    ...db.prepare(`SELECT ct.created_at AS date, ct.reference, c.name AS party, 'Customer Payment' AS type, ct.amount, 'in' AS direction
      FROM customer_transactions ct LEFT JOIN customers c ON c.id=ct.customer_id
      WHERE ct.type='payment' AND ct.payment_method='Cash' AND date(ct.created_at) BETWEEN ? AND ?
      AND NOT (EXISTS (SELECT 1 FROM sales s WHERE s.invoice_number=ct.reference)
        AND (ct.notes LIKE '%paid with sale%' OR ct.notes LIKE '%payment for invoice%'))`).all(...ranges),
    ...db.prepare(`SELECT COALESCE(date, date(created_at)) AS date, invoice_number AS reference, supplier_name AS party, 'Purchase' AS type,
        MAX(0,cash_paid-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
          JOIN supplier_transactions st ON st.id=spa.transaction_id WHERE spa.entry_type='purchase' AND spa.entry_id=purchases.id AND st.payment_method='Cash'),0)) AS amount, 'out' AS direction
      FROM purchases WHERE date(COALESCE(date, created_at)) BETWEEN ? AND ? AND cash_paid > 0`).all(...ranges),
    ...db.prepare(`SELECT entry_date AS date, reference, product_name AS party, 'Stock In' AS type,
        MAX(0,cash_paid-COALESCE((SELECT SUM(spa.amount) FROM supplier_payment_allocations spa
          JOIN supplier_transactions st ON st.id=spa.transaction_id WHERE spa.entry_type='stock' AND spa.entry_id=stock_entries.id AND st.payment_method='Cash'),0)) AS amount, 'out' AS direction
      FROM stock_entries WHERE entry_date BETWEEN ? AND ? AND cash_paid > 0`).all(...ranges),
    ...db.prepare(`SELECT st.created_at AS date, st.reference, s.name AS party, 'Supplier Payment' AS type, st.amount, 'out' AS direction
      FROM supplier_transactions st LEFT JOIN suppliers s ON s.id=st.supplier_id
      WHERE st.type='payment' AND st.payment_method='Cash' AND date(st.created_at) BETWEEN ? AND ?
      AND NOT ((EXISTS (SELECT 1 FROM purchases p WHERE p.invoice_number=st.reference) AND st.notes LIKE '%paid with purchase%')
        OR (EXISTS (SELECT 1 FROM stock_entries se WHERE 'STOCK-IN-' || se.id=st.reference) AND st.notes LIKE '%paid with stock-in%'))`).all(...ranges),
    ...db.prepare(`SELECT date AS date, name AS reference, name AS party, 'Expense' AS type, amount, 'out' AS direction
      FROM expenses WHERE payment_method='Cash' AND date BETWEEN ? AND ?`).all(...ranges),
    ...db.prepare(`SELECT t.created_at AS date, COALESCE(t.reason, t.notes, t.type) AS reference, p.name AS party, t.type, ABS(t.amount) AS amount,
      CASE WHEN t.type IN ('advance_repayment','capital_contribution') OR (t.type='capital_adjustment' AND t.amount>0) THEN 'in' ELSE 'out' END AS direction
      FROM partner_transactions t LEFT JOIN partners p ON p.id=t.partner_id
      WHERE t.payment_method='Cash' AND (t.type IN ('withdrawal','advance','advance_repayment','capital_contribution') OR t.type='capital_adjustment') AND date(t.created_at) BETWEEN ? AND ?`).all(...ranges)
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const totals = rows.reduce((sum, row) => {
    sum[row.direction] += safeNumber(row.amount);
    return sum;
  }, { in: 0, out: 0 });
  res.json({ ok: true, rows, totals, balance: totals.in - totals.out });
});

app.get('/api/reports/bank', (req, res) => {
  const from = req.query.from || '1970-01-01', to = req.query.to || '2999-12-31';
  const transactions = db.prepare(`SELECT t.*, a.name AS account_name FROM bank_transactions t
    JOIN bank_accounts a ON a.id=t.account_id WHERE date(t.txn_date) BETWEEN ? AND ?
    ORDER BY t.txn_date DESC, t.created_at DESC`).all(from, to);
  const accounts = db.prepare(`SELECT a.name, a.opening_balance,
      a.opening_balance + COALESCE(SUM(CASE WHEN t.direction='in' THEN t.amount ELSE -t.amount END), 0) AS balance
    FROM bank_accounts a LEFT JOIN bank_transactions t ON t.account_id=a.id
    GROUP BY a.id ORDER BY a.is_default DESC, a.name`).all();
  const totals = transactions.reduce((sum, txn) => {
    sum[txn.direction] += safeNumber(txn.amount);
    return sum;
  }, { in: 0, out: 0 });
  res.json({ ok: true, transactions, accounts, totals });
});
// ===== end reports =====

// ===== Cash in Bank =====
db.exec(`
  CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    account_no TEXT DEFAULT '',
    opening_balance REAL DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS bank_transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    kind TEXT DEFAULT 'manual',
    amount REAL NOT NULL,
    reference TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    txn_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

function getDefaultBankAccount() {
  let acc = db.prepare('SELECT * FROM bank_accounts WHERE is_default = 1').get() || db.prepare('SELECT * FROM bank_accounts ORDER BY created_at LIMIT 1').get();
  if (!acc) {
    const id = uuidv4();
    db.prepare('INSERT INTO bank_accounts (id, name, is_default) VALUES (?, ?, 1)').run(id, 'Main Bank');
    acc = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id);
  }
  return acc;
}

function addBankTxn({ accountId, direction, kind, amount, reference, notes, date }) {
  const acc = accountId ? db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(accountId) : getDefaultBankAccount();
  if (!acc || !(Number(amount) > 0)) return null;
  const id = uuidv4();
  db.prepare('INSERT INTO bank_transactions (id, account_id, direction, kind, amount, reference, notes, txn_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, acc.id, direction, kind || 'manual', Number(amount), reference || '', notes || '', date || new Date().toISOString().slice(0, 10));
  return id;
}

app.get('/api/bank', (req, res) => {
  getDefaultBankAccount();
  const accounts = db.prepare(`
    SELECT a.*,
      a.opening_balance
        + COALESCE((SELECT SUM(amount) FROM bank_transactions t WHERE t.account_id = a.id AND t.direction = 'in'), 0)
        - COALESCE((SELECT SUM(amount) FROM bank_transactions t WHERE t.account_id = a.id AND t.direction = 'out'), 0) AS balance
    FROM bank_accounts a ORDER BY a.is_default DESC, a.created_at
  `).all();
  const transactions = db.prepare(`
    SELECT t.*, a.name AS account_name FROM bank_transactions t
    JOIN bank_accounts a ON a.id = t.account_id
    ORDER BY t.txn_date DESC, t.created_at DESC LIMIT 300
  `).all();
  const total = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
  res.json({ ok: true, accounts, transactions, total });
});

app.post('/api/bank/accounts', (req, res) => {
  const b = req.body || {};
  if (!String(b.name || '').trim()) return res.status(400).json({ ok: false, message: 'Account name required' });
  const id = uuidv4();
  db.prepare('INSERT INTO bank_accounts (id, name, account_no, opening_balance) VALUES (?, ?, ?, ?)')
    .run(id, String(b.name).trim(), String(b.account_no || ''), safeNumber(b.opening_balance));
  res.status(201).json({ ok: true, id });
});

app.post('/api/bank/transactions', (req, res) => {
  const b = req.body || {};
  const amount = safeNumber(b.amount);
  if (amount <= 0) return res.status(400).json({ ok: false, message: 'Enter a valid amount' });
  if (!['deposit', 'withdraw'].includes(b.type)) return res.status(400).json({ ok: false, message: 'Invalid type' });
  const id = addBankTxn({
    accountId: b.account_id,
    direction: b.type === 'deposit' ? 'in' : 'out',
    kind: b.type,
    amount, reference: b.reference, notes: b.notes, date: b.date
  });
  if (!id) return res.status(400).json({ ok: false, message: 'Bank account not found' });
  res.status(201).json({ ok: true, id });
});

app.delete('/api/bank/transactions/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ ok: false, message: 'Not found' });
  if (!['deposit', 'withdraw'].includes(t.kind)) return res.status(400).json({ ok: false, message: 'Automatic entries cannot be deleted here. Delete the invoice instead.' });
  db.prepare('DELETE FROM bank_transactions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
// ===== end Cash in Bank =====

app.get('*', (req, res) => {
  res.sendFile(path.join(rootDir, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Shop Management System running on http://localhost:${PORT}`);
});
