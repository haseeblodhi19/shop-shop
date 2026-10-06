const state = {
  currentUser: null,
  settings: {},
  products: [],
  customers: [],
  suppliers: [],
  partners: [],
  expenses: [],
  sales: [],
  posItems: [],
  purchaseItems: [],
  dashboard: null,
  currentSection: 'dashboard'
  ,users: [], purchases: [], editingProductId: null
};

const el = {
  loginScreen: document.getElementById('loginScreen'),
  mainApp: document.getElementById('mainApp'),
  loginForm: document.getElementById('loginForm'),
  setupForm: document.getElementById('setupForm'),
  username: document.getElementById('username'),
  password: document.getElementById('password'),
  setupName: document.getElementById('setupName'),
  setupUsername: document.getElementById('setupUsername'),
  setupPassword: document.getElementById('setupPassword'),
  loginKicker: document.getElementById('loginKicker'),
  loginTitle: document.getElementById('loginTitle'),
  loginSubtitle: document.getElementById('loginSubtitle'),
  welcomeTitle: document.getElementById('welcomeTitle'),
  userBadge: document.getElementById('userBadge'),
  sidebar: document.getElementById('sidebar'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  backButton: document.getElementById('backButton'),
  globalSearch: document.getElementById('globalSearch'),
  themeToggle: document.getElementById('themeToggle'),
  dashboardStats: document.getElementById('dashboardStats'),
  lowStockTable: document.getElementById('lowStockTable'),
  recentSalesTable: document.getElementById('recentSalesTable'),
  dailySalesChart: document.getElementById('dailySalesChart'),
  monthlySalesChart: document.getElementById('monthlySalesChart'),
  productSelect: document.getElementById('productSelect'),
  posArticleSelect: document.getElementById('posArticleSelect'),
  posBarcode: document.getElementById('posBarcode'),
  customerDuePreview: document.getElementById('customerDuePreview'),
  stockArticleSelect: document.getElementById('stockArticleSelect'),
  stockBarcode: document.getElementById('stockBarcode'),
  wholesaleLevelSelect: document.getElementById('wholesaleLevelSelect'),
  wholesaleLevelWrap: document.getElementById('wholesaleLevelWrap'),
  articleBuilderList: document.getElementById('articleBuilderList'),
  addArticleBtn: document.getElementById('addArticleBtn'),
  expiryTable: document.getElementById('expiryTable'),
  expiryCount: document.getElementById('expiryCount'),
  lowStockCount: document.getElementById('lowStockCount'),
  lastSyncText: document.getElementById('lastSyncText'),
  billBalanceBadge: document.getElementById('billBalanceBadge'),
  customerSelect: document.getElementById('customerSelect'),
  posQty: document.getElementById('posQty'),
  posItemsBody: document.getElementById('posItemsBody'),
  totalSaleValue: document.getElementById('totalSaleValue'),
  totalCostValue: document.getElementById('totalCostValue'),
  grossProfitValue: document.getElementById('grossProfitValue'),
  profitMarginValue: document.getElementById('profitMarginValue'),
  saleTypeSelect: document.getElementById('saleTypeSelect'),
  paidAmountInput: document.getElementById('paidAmountInput'),
  paymentMethodSelect: document.getElementById('paymentMethodSelect'),
  productForm: document.getElementById('productForm'),
  productsTableBody: document.getElementById('productsTableBody'),
  purchaseSupplierSelect: document.getElementById('purchaseSupplierSelect'),
  purchaseProductSelect: document.getElementById('purchaseProductSelect'),
  purchaseQty: document.getElementById('purchaseQty'),
  purchaseUnitCost: document.getElementById('purchaseUnitCost'),
  purchaseItemsBody: document.getElementById('purchaseItemsBody'),
  purchaseForm: document.getElementById('purchaseForm'),
  customerForm: document.getElementById('customerForm'),
  customersTableBody: document.getElementById('customersTableBody'),
  supplierForm: document.getElementById('supplierForm'),
  suppliersTableBody: document.getElementById('suppliersTableBody'),
  supplierProfile: document.getElementById('supplierProfile'),
  partnerForm: document.getElementById('partnerForm'),
  partnersTableBody: document.getElementById('partnersTableBody'),
  partnerSummary: document.getElementById('partnerSummary'),
  partnerActivityForm: document.getElementById('partnerActivityForm'),
  partnerActivitySelect: document.getElementById('partnerActivitySelect'),
  partnerActivityBody: document.getElementById('partnerActivityBody'),
  partnerActivityTitle: document.getElementById('partnerActivityTitle'),
  partnerDistributionBtn: document.getElementById('partnerDistributionBtn'),
  partnerRepaymentBtn: document.getElementById('partnerRepaymentBtn'),
  hisabSupplierFilter: document.getElementById('hisabSupplierFilter'),
  expenseForm: document.getElementById('expenseForm'),
  expensesTableBody: document.getElementById('expensesTableBody'),
  salesReportsBody: document.getElementById('salesReportsBody'),
  reportSummary: document.getElementById('reportSummary')
  ,stockForm: document.getElementById('stockForm')
  ,stockProductSelect: document.getElementById('stockProductSelect')
  ,stockSupplierSelect: document.getElementById('stockSupplierSelect')
  ,stockAdjustmentForm: document.getElementById('stockAdjustmentForm')
  ,adjustmentProductSelect: document.getElementById('adjustmentProductSelect')
  ,adjustmentArticleSelect: document.getElementById('adjustmentArticleSelect')
  ,stockTableBody: document.getElementById('stockTableBody')
  ,reportDate: document.getElementById('reportDate')
  ,dailyReportDate: document.getElementById('dailyReportDate')
  ,dailyReportBtn: document.getElementById('dailyReportBtn')
  ,reportRange: document.getElementById('reportRange')
  ,reportSearch: document.getElementById('reportSearch')
  ,clearReportDate: document.getElementById('clearReportDate')
  ,accountsDate: document.getElementById('accountsDate')
  ,accountsSummary: document.getElementById('accountsSummary')
  ,accountsBreakdown: document.getElementById('accountsBreakdown')
  ,userForm: document.getElementById('userForm')
  ,settingsForm: document.getElementById('settingsForm')
  ,usersTableBody: document.getElementById('usersTableBody')
  ,customerSearch: document.getElementById('customerSearch')
  ,supplierSearch: document.getElementById('supplierSearch')
  ,posProductSearch: document.getElementById('posProductSearch')
  ,posCategoryFilter: document.getElementById('posCategoryFilter')
  ,posSaleMode: document.getElementById('posSaleMode')
  ,posAmount: document.getElementById('posAmount')
  ,purchaseProductSearch: document.getElementById('purchaseProductSearch')
  ,purchaseConversionFactor: document.getElementById('purchaseConversionFactor')
  ,invoiceDetail: document.getElementById('invoiceDetail')
  ,customerProfile: document.getElementById('customerProfile')
  ,stockCalculation: document.getElementById('stockCalculation')
};

let loginParticlesFrame = null;
let loginParticlesRunning = false;
let loginParticlesResizeHandler = null;
let loginParticlesCanvas = null;


// Electron does not support window.prompt(), so every "Edit" that used it silently did nothing.
// uiPrompt shows a real in-page dialog and returns the typed text (or null if cancelled).
function uiPrompt(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-card" style="width:min(460px,94vw)">
      <h3 style="margin:0 0 12px;white-space:pre-line"></h3>
      <input type="text" class="ui-prompt-input" style="width:100%;font-size:1.05rem" />
      <div class="modal-footer"><button type="button" class="ghost-btn" data-act="cancel">Cancel</button><button type="button" class="primary-btn" data-act="ok">OK</button></div>
    </div>`;
    overlay.querySelector('h3').textContent = message;
    const input = overlay.querySelector('input');
    input.value = defaultValue == null ? '' : String(defaultValue);
    const done = (val) => { overlay.remove(); resolve(val); };
    overlay.addEventListener('click', (e) => {
      if (e.target.dataset.act === 'ok') done(input.value);
      else if (e.target.dataset.act === 'cancel' || e.target === overlay) done(null);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(input.value);
      if (e.key === 'Escape') done(null);
    });
    document.body.appendChild(overlay);
    input.focus(); input.select();
  });
}

function uiPaymentPrompt(title, maximum = null) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<form class="modal-card" style="width:min(460px,94vw)">
      <h3 style="margin:0 0 12px"></h3>
      <div class="form-grid">
        <div><label>Amount</label><input name="amount" type="number" min="0.01" step="0.01" required /></div>
        <div><label>Payment Source</label><select name="payment_method"><option>Cash</option><option>Bank</option></select></div>
        <div><label>Date</label><input name="date" type="date" required /></div>
        <div><label>Reference / Note</label><input name="reference" placeholder="Optional" /></div>
      </div>
      <div class="modal-footer"><button type="button" class="ghost-btn" data-act="cancel">Cancel</button><button type="submit" class="primary-btn">Save Payment</button></div>
    </form>`;
    overlay.querySelector('h3').textContent = title;
    const form = overlay.querySelector('form');
    const amount = form.elements.amount;
    if (maximum !== null) amount.max = String(maximum);
    form.elements.date.value = new Date().toISOString().slice(0, 10);
    const done = (value) => { overlay.remove(); resolve(value); };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = Number(amount.value);
      if (value <= 0 || (maximum !== null && value > maximum)) {
        amount.setCustomValidity(maximum !== null && value > maximum ? `Maximum payable is ${formatMoney(maximum)}` : 'Enter an amount greater than zero');
        amount.reportValidity();
        amount.setCustomValidity('');
        return;
      }
      done(Object.fromEntries(new FormData(form).entries()));
    });
    overlay.addEventListener('click', (event) => {
      if (event.target.dataset.act === 'cancel' || event.target === overlay) done(null);
    });
    form.addEventListener('keydown', (event) => { if (event.key === 'Escape') done(null); });
    document.body.appendChild(overlay);
    amount.focus();
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(Number(value || 0));
}

function showMessage(text, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = text;
  Object.assign(toast.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    background: type === 'error' ? '#ef4444' : '#22c55e',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: '10px',
    zIndex: 1000,
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.currentUser) resetSessionView();
    const error = new Error(data.message || 'Request failed');
    error.status = response.status;
    throw error;
  }

  return data;
}

async function startWorkspace(user) {
  stopLoginParticles();
  state.currentUser = user;
  el.welcomeTitle.textContent = `Welcome, ${user.name}`;
  el.userBadge.textContent = user.role;
  el.loginScreen.classList.add('hidden');
  el.mainApp.classList.remove('hidden');
  await Promise.all([loadDashboard(), loadProducts(), loadCustomers(), loadSuppliers(), loadPartners(), loadExpenses(), loadReports(), loadStock(), loadAccounts(), loadUsers(), loadPurchases(), loadSettings()]);
}

function resetSessionView() {
  state.currentUser = null;
  el.mainApp.classList.add('hidden');
  el.loginScreen.classList.remove('hidden');
  showSignInForm();
  initLoginParticles();
  setSection('dashboard');
}

function showSignInForm() {
  el.loginForm.classList.remove('hidden');
  el.setupForm.classList.add('hidden');
  el.loginKicker.textContent = 'WELCOME BACK';
  el.loginTitle.textContent = 'Sign in to ShopFlow';
  el.loginSubtitle.textContent = 'Your shop floor is ready.';
}

function showInitialSetupForm() {
  el.loginForm.classList.add('hidden');
  el.setupForm.classList.remove('hidden');
  el.loginKicker.textContent = 'FIRST-TIME SETUP';
  el.loginTitle.textContent = 'Create your admin account';
  el.loginSubtitle.textContent = 'Set a username and password to secure this workspace.';
  initLoginParticles();
}

function setSection(section) {
  state.currentSection = section;
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });

  document.querySelectorAll('.content-section').forEach((sectionEl) => {
    sectionEl.classList.toggle('active', sectionEl.id === `${section}Section`);
  });
  if (section === 'settings') { refreshPrinterList(); loadAuditLog(); }
  if (section === 'bank') loadBank();
  if (section === 'hisab') loadHisab();
}

function applyTheme(theme = localStorage.getItem('shop-theme') || 'dark') {
  document.body.dataset.theme = theme;
  localStorage.setItem('shop-theme', theme);
  el.themeToggle.textContent = theme === 'dark' ? 'Light' : 'Dark';
}

function renderProductArticleEditors(product) {
  const articles = Array.isArray(product.articles) ? product.articles : [];
  if (!articles.length) return 'Default article';
  return articles.map((article) => `
    <div class="article-inline-editor" data-product-id="${escapeHtml(product.id)}" data-article-id="${escapeHtml(article.id)}">
      <div class="article-inline-fields">
        <input data-article-name value="${escapeHtml(article.name || '')}" aria-label="Article name" placeholder="Article name">
        <select data-article-type aria-label="Article type">
          ${['Carton','Card','Bag','Box','Dabba','Loose','Pack','Piece','Bottle','Pouch','Lari'].map((type) => `<option value="${type}" ${String(article.package_type || 'Loose') === type ? 'selected' : ''}>${type}</option>`).join('')}
        </select>
        <input data-article-size type="number" min="0.001" step="0.001" value="${Number(article.base_per_unit || article.package_size || 1)}" aria-label="Base units" title="Base units">
        <input data-article-cost type="number" min="0" step="0.01" value="${Number(article.purchase_price || 0)}" aria-label="Cost" title="Cost">
        <input data-article-retail type="number" min="0" step="0.01" value="${Number(article.retail_price || 0)}" aria-label="Retail price" title="Retail">
        <input data-article-wholesale type="number" min="0" step="0.01" value="${Number(article.wholesale_price || 0)}" aria-label="Wholesale price" title="Wholesale">
        <input data-article-barcode value="${escapeHtml(article.barcode || '')}" aria-label="Barcode" placeholder="Barcode">
        <button class="small-btn" type="button" data-save-article>Save</button>
      </div>
      <small class="table-sub">Stock: ${Number(article.stock_qty || 0).toFixed(3)} ${escapeHtml(article.package_type || '')}</small>
    </div>
  `).join('');
}

function bindArticleEditorButtons() {
  document.querySelectorAll('[data-save-article]').forEach((btn) => {
    btn.onclick = async () => {
      const editor = btn.closest('.article-inline-editor');
      if (!editor) return;
      const name = editor.querySelector('[data-article-name]').value.trim();
      const factor = Number(editor.querySelector('[data-article-size]').value);
      if (!name || !Number.isFinite(factor) || factor <= 0) {
        showMessage('Article name and base units are required', 'error');
        return;
      }
      const article = state.products
        .find((product) => product.id === editor.dataset.productId)
        ?.articles?.find((item) => item.id === editor.dataset.articleId);
      if (!article) {
        showMessage('Article not found. Refresh the product list and try again.', 'error');
        return;
      }
      const payload = {
        name,
        package_type: editor.querySelector('[data-article-type]').value,
        package_size: factor,
        base_per_unit: factor,
        base_unit: article.base_unit,
        barcode: editor.querySelector('[data-article-barcode]').value.trim(),
        purchase_price: Number(editor.querySelector('[data-article-cost]').value || 0),
        retail_price: Number(editor.querySelector('[data-article-retail]').value || 0),
        wholesale_price: Number(editor.querySelector('[data-article-wholesale]').value || 0)
      };
      btn.disabled = true;
      try {
        await apiRequest(`/api/products/${editor.dataset.productId}/articles/${editor.dataset.articleId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        await loadProducts();
        showMessage('Article updated');
      } catch (error) {
        showMessage(error.message, 'error');
      } finally {
        btn.disabled = false;
      }
    };
  });
}

function handleGlobalSearch() {
  const term = (el.globalSearch.value || '').trim().toLowerCase();
  if (!term) {
    loadProducts();
    return;
  }

  const filtered = state.products.filter((product) => {
    return (
      product.name.toLowerCase().includes(term) ||
      (product.barcode || '').toLowerCase().includes(term) ||
      (product.category || '').toLowerCase().includes(term) ||
      (product.articles || []).some((article) => `${article.name || ''} ${article.barcode || ''}`.toLowerCase().includes(term))
    );
  });

  el.productsTableBody.innerHTML = filtered.map((p) => `
    <tr>
      <td><strong>${escapeHtml(p.name)}</strong><small class="table-sub">${escapeHtml(p.brand || '')}</small></td>
      <td>${escapeHtml(p.category || '')}</td>
      <td class="article-cell">${renderProductArticleEditors(p)}</td>
      <td>${formatMoney(p.retail_price)}</td>
      <td>${formatMoney(p.wholesale_price)}</td>
      <td><strong>${Number(p.current_stock || 0).toFixed(3)}</strong> ${escapeHtml(p.base_unit || p.unit || '')}</td>
      <td>${Number(p.current_stock || 0) <= 0 ? '<span class="status-badge danger">Out</span>' : Number(p.current_stock || 0) <= Number(p.min_stock || 0) ? '<span class="status-badge warning">Low</span>' : '<span class="status-badge success">Healthy</span>'}</td>
      <td><button class="small-btn" data-edit-product="${p.id}">Edit</button><button class="small-btn danger-btn" data-delete-product="${p.id}">Delete</button></td>
    </tr>
  `).join('');
  document.querySelectorAll('[data-delete-product]').forEach((btn) => {
    btn.onclick = async () => {
      if (!window.confirm('Delete this product? Products used in sales or purchases cannot be deleted; use inactive status instead.')) return;
      try { await apiRequest(`/api/products/${btn.dataset.deleteProduct}`, { method: 'DELETE' }); await loadProducts(); showMessage('Product deleted'); } catch (error) { showMessage(error.message, 'error'); }
    };
  });
  document.querySelectorAll('[data-edit-product]').forEach((btn) => { btn.onclick = () => editProduct(btn.dataset.editProduct); });
  bindArticleEditorButtons();
}

function filterProductSelect(input, select) {
  const term = (input.value || '').toLowerCase();
  const category = el.posCategoryFilter ? el.posCategoryFilter.value : '';
  const selected = select.value;
  select.innerHTML = state.products.filter((product) => (!category || product.category === category) && `${product.name} ${product.subcategory || ''} ${product.barcode || ''} ${product.category || ''} ${product.base_unit || ''}`.toLowerCase().includes(term))
    .map((product) => `<option value="${product.id}">${product.name} - ${product.current_stock} base units</option>`).join('');
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}

async function loadDashboard() {
  const dashboard = await apiRequest('/api/dashboard');
  state.dashboard = dashboard;

  const stats = [
    { label: 'Today Sales', value: formatMoney(dashboard.today.sales) },
    { label: 'Retail Sales', value: formatMoney(dashboard.today.retailSales) },
    { label: 'Wholesale Sales', value: formatMoney(dashboard.today.wholesaleSales) },
    { label: 'Purchase', value: formatMoney(dashboard.today.purchases) },
    { label: 'Gross Profit', value: formatMoney(dashboard.today.grossProfit) },
    { label: 'Expenses', value: formatMoney(dashboard.today.expenses) },
    { label: 'Net Profit', value: formatMoney(dashboard.today.netProfit) },
    { label: 'Cash in Hand', value: formatMoney(dashboard.today.cashInHand) },
    { label: 'Bank Balance', value: formatMoney(dashboard.today.bankBalance) },
    { label: 'Products', value: dashboard.inventory.products },
    { label: 'Stock Value', value: formatMoney(dashboard.inventory.stockValue) },
    { label: 'Low Stock', value: dashboard.inventory.lowStock },
    { label: 'Out of Stock', value: dashboard.inventory.outOfStock },
    { label: 'Stock In Today', value: dashboard.inventory.stockInToday },
    { label: 'Stock Out Today', value: dashboard.inventory.stockOutToday }
  ];

  el.dashboardStats.innerHTML = stats.map((card) => `
    <div class="stat-card">
      <span class="label">${card.label}</span>
      <div class="value">${card.value}</div>
    </div>
  `).join('');

  const lowArticles = dashboard.articleLowStock || [];
  el.lowStockTable.innerHTML = lowArticles.length ? lowArticles.map((p) => `<tr><td><strong>${escapeHtml(p.product_name)}</strong><small class="table-sub">${escapeHtml(p.name)} · ${escapeHtml(p.package_type||'')}</small></td><td>${Number(p.stock_qty||0).toFixed(3)}</td><td>${Number(p.min_stock||0).toFixed(3)}</td></tr>`).join('') : ((dashboard.lowStock || []).map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${p.current_stock}</td><td>${p.min_stock}</td></tr>`).join('') || '<tr><td colspan="3">No low stock</td></tr>');
  if (el.lowStockCount) el.lowStockCount.textContent = lowArticles.length || (dashboard.lowStock || []).length;
  const expiryArticles = dashboard.articleExpiring || [];
  if (el.expiryCount) el.expiryCount.textContent = expiryArticles.length || (dashboard.expiring || []).length;
  if (el.expiryTable) el.expiryTable.innerHTML = (expiryArticles.length ? expiryArticles.map(p => { const d=Math.ceil((new Date(p.expiry_date)-new Date())/86400000); return `<tr><td><strong>${escapeHtml(p.product_name)}</strong><small class="table-sub">${escapeHtml(p.name)}</small></td><td>${escapeHtml(p.expiry_date)}</td><td><span class="status-badge ${d<0?'danger':d<=7?'warning':'success'}">${d<0?'Expired':d+' days'}</span></td></tr>`; }).join('') : (dashboard.expiring || []).map(p => { const d=Math.ceil((new Date(p.expiry_date)-new Date())/86400000); return `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.expiry_date)}</td><td><span class="status-badge ${d<0?'danger':d<=7?'warning':'success'}">${d<0?'Expired':d+' days'}</span></td></tr>`; }).join('')) || '<tr><td colspan="3">No expiry alerts</td></tr>';
  if (el.lastSyncText) el.lastSyncText.textContent = `Last sync ${new Date().toLocaleTimeString()}`;

  el.recentSalesTable.innerHTML = (dashboard.recentSales || []).map((sale) => `
    <tr><td>${sale.invoice_number}</td><td>${sale.sale_type}</td><td>${formatMoney(sale.total_amount)}</td></tr>
  `).join('') || '<tr><td colspan="3">No recent sales</td></tr>';

  renderBars(el.dailySalesChart, dashboard.salesByDay || [], 'total');
  renderBars(el.monthlySalesChart, dashboard.monthlySales || [], 'total');
  renderBars(document.getElementById('profitChart'), dashboard.profitByDay || [], 'total');
  renderBars(document.getElementById('retailChart'), dashboard.retailByDay || [], 'total');
  renderBars(document.getElementById('wholesaleChart'), dashboard.wholesaleByDay || [], 'total');
  renderBars(document.getElementById('expensesChart'), dashboard.expensesByCategory || [], 'total');
  renderBars(document.getElementById('purchaseChart'), dashboard.purchaseTrend || [], 'total');
}

function renderBars(container, items, key) {
  if (!items.length) {
    container.innerHTML = '<span>No data</span>';
    return;
  }

  const max = Math.max(...items.map((item) => Number(item[key] || 0)), 1);
  container.innerHTML = items.map((item) => {
    const height = Math.max(18, (Number(item[key] || 0) / max) * 100);
    return `<div class="bar" style="height:${height}%" title="${item[key]}"></div>`;
  }).join('');
}

async function loadProducts() {
  const products = await apiRequest('/api/products');
  state.products = products;
  updatePosArticles();
  updateStockArticles();

  el.productSelect.innerHTML = products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} - ${Number(p.current_stock||0).toFixed(3)} ${escapeHtml(p.base_unit||p.unit||'units')}</option>`).join('');
  updatePosArticles();
  el.purchaseProductSelect.innerHTML = products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  updatePurchaseArticles();
  el.stockProductSelect.innerHTML = products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.stock_unit || p.unit || 'pcs')})</option>`).join('');
  updateStockArticles();
  if (el.adjustmentProductSelect) {
    el.adjustmentProductSelect.innerHTML = products.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.base_unit || p.unit || 'units')})</option>`).join('');
    updateAdjustmentArticles();
  }
  refreshConversionOptions();
  if (el.posCategoryFilter) {
    el.posCategoryFilter.innerHTML = '<option value="">All categories</option>' + [...new Set(products.map((product) => product.category).filter(Boolean))].sort().map((category) => `<option value="${category}">${category}</option>`).join('');
  }

  el.productsTableBody.innerHTML = products.map((p) => {
    const articleText = renderProductArticleEditors(p);
    const status = Number(p.current_stock||0) <= 0 ? '<span class="status-badge danger">Out</span>' : Number(p.current_stock||0) <= Number(p.min_stock||0) ? '<span class="status-badge warning">Low</span>' : '<span class="status-badge success">Healthy</span>';
    return `<tr><td><strong>${escapeHtml(p.name)}</strong><small class="table-sub">${escapeHtml(p.brand||'')}</small></td><td>${escapeHtml(p.category||'')}</td><td class="article-cell">${articleText}</td><td>${formatMoney(p.retail_price)}</td><td>${formatMoney(p.wholesale_price)}</td><td><strong>${Number(p.current_stock||0).toFixed(3)}</strong> ${escapeHtml(p.base_unit||p.unit||'')}</td><td>${status}</td><td><button class="small-btn" data-edit-product="${p.id}">Edit</button><button class="small-btn danger-btn" data-delete-product="${p.id}">Delete</button></td></tr>`;
  }).join('');

  document.querySelectorAll('[data-delete-product]').forEach((btn) => {
    btn.onclick = async () => {
      if (!window.confirm('Delete this product? Products used in sales or purchases cannot be deleted; use inactive status instead.')) return;
      try { await apiRequest(`/api/products/${btn.dataset.deleteProduct}`, { method: 'DELETE' }); await loadProducts(); showMessage('Product deleted'); } catch (error) { showMessage(error.message, 'error'); }
    };
  });
  document.querySelectorAll('[data-edit-product]').forEach((btn) => {
    btn.onclick = () => editProduct(btn.dataset.editProduct);
  });
  bindArticleEditorButtons();
  if (el.posProductSearch && el.posCategoryFilter) filterProductSelect(el.posProductSearch, el.productSelect);
}

function buildArticleBuilderRow(article = null, index = 1) {
  const row = document.createElement('div');
  row.className = 'article-builder-row';
  if (article?.id) row.dataset.articleId = article.id;
  const articleName = String(article?.name ?? '');
  const packageType = String(article?.package_type ?? 'Loose');
  const packageSize = Number(article?.package_size ?? article?.base_per_unit ?? 1) || 1;
  const purchasePrice = Number(article?.purchase_price ?? 0);
  const retailPrice = Number(article?.retail_price ?? 0);
  const wholesalePrice = Number(article?.wholesale_price ?? 0);
  const wholesaleLevel1 = Number(article?.wholesale_level_1 ?? 0);
  const wholesaleLevel2 = Number(article?.wholesale_level_2 ?? 0);
  const wholesaleLevel3 = Number(article?.wholesale_level_3 ?? 0);
  const barcode = String(article?.barcode ?? '');
  row.innerHTML = `
    <span class="package-level">L${index}</span>
    <input data-a-name value="${escapeHtml(articleName)}" placeholder="Article e.g. Blade Card / Dabba / Piece">
    <select data-a-type>
      ${['Carton','Card','Bag','Box','Dabba','Loose','Pack','Piece','Bottle','Pouch','Lari'].map((type) => `<option value="${type}" ${packageType === type ? 'selected' : ''}>${type}</option>`).join('')}
    </select>
    <input data-a-size type="number" min="0.001" step="0.001" value="${Number.isFinite(packageSize) ? packageSize : 1}" placeholder="Base units">
    <input data-a-cost type="number" min="0" step="0.01" value="${purchasePrice}" placeholder="Cost">
    <input data-a-retail type="number" min="0" step="0.01" value="${retailPrice}" placeholder="Retail">
    <input data-a-wholesale type="number" min="0" step="0.01" value="${wholesalePrice}" placeholder="Wholesale">
    <input data-a-wholesale1 type="number" min="0" step="0.01" value="${wholesaleLevel1}" placeholder="Wholesale L1" title="Wholesale Level 1 price (khali chhoren to upar wali Wholesale rate chalegi)">
    <input data-a-wholesale2 type="number" min="0" step="0.01" value="${wholesaleLevel2}" placeholder="Wholesale L2" title="Wholesale Level 2 price">
    <input data-a-wholesale3 type="number" min="0" step="0.01" value="${wholesaleLevel3}" placeholder="Wholesale L3" title="Wholesale Level 3 price">
    <input data-a-barcode value="${escapeHtml(barcode)}" placeholder="Barcode">
    <button type="button" class="small-btn danger-btn">Remove</button>
  `;
  row.querySelector('button').onclick = () => {
    row.remove();
    [...el.articleBuilderList.querySelectorAll('.article-builder-row')].forEach((item, itemIndex) => {
      const badge = item.querySelector('.package-level');
      if (badge) badge.textContent = `L${itemIndex + 1}`;
    });
  };
  return row;
}

function renderArticleBuilderRows(articles = []) {
  if (!el.articleBuilderList) return;
  el.articleBuilderList.innerHTML = '';
  const rows = Array.isArray(articles) && articles.length ? articles : [{ id: '', name: '', package_type: 'Loose', package_size: 1, base_per_unit: 1 }];
  rows.forEach((article, index) => {
    el.articleBuilderList.appendChild(buildArticleBuilderRow(article, index + 1));
  });
}

function editProduct(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  state.editingProductId = id;
  Object.entries(product).forEach(([key, value]) => {
    const input = el.productForm.elements[key];
    if (input && value !== null) input.value = value;
  });
  renderArticleBuilderRows(product.articles || []);
  const preview = document.getElementById('productImagePreview');
  if (product.image) { preview.src = product.image; preview.classList.remove('hidden'); }
  else { preview.src = ''; preview.classList.add('hidden'); }
  openProductModal(true);
  showMessage('Product loaded for editing');
}

async function loadPurchases() {
  const purchases = await apiRequest('/api/purchases');
  state.purchases = purchases;
  if (!el.purchasesTableBody) return;
  el.purchasesTableBody.innerHTML = purchases.map(p => `<tr><td>${p.invoice_number}</td><td>${p.date || p.created_at.slice(0,10)}</td><td>${escapeHtml(p.supplier_name || 'Supplier')}</td><td>${formatMoney(p.total_amount)}</td><td>${formatMoney(p.paid_amount)}</td><td>${formatMoney(p.remaining_amount)}</td><td><button class="small-btn" data-print-purchase="${p.id}">Print</button><button class="small-btn danger-btn" data-delete-purchase="${p.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="7">No purchases yet</td></tr>';
  document.querySelectorAll('[data-delete-purchase]').forEach(b=>b.onclick=()=>deletePurchase(b.dataset.deletePurchase));
  document.querySelectorAll('[data-print-purchase]').forEach(b=>b.onclick=()=>printPurchase(b.dataset.printPurchase));
}
async function deletePurchase(id){ if(!confirm('Delete purchase and reverse its stock/payable?')) return; try{await apiRequest('/api/purchases/'+id,{method:'DELETE'}); await Promise.all([loadPurchases(),loadProducts(),loadSuppliers(),loadDashboard()]); showMessage('Purchase deleted');}catch(e){showMessage(e.message,'error');}}
async function printPurchase(id){ const p=state.purchases.find(x=>x.id===id); if(!p) return; const w=document.createElement('iframe'); w.className='print-frame'; w.style.cssText='position:fixed;width:0;height:0;border:0;visibility:hidden'; document.body.appendChild(w); const d=w.contentDocument; d.open(); d.write(`<html><head><title>${escapeHtml(p.invoice_number)}</title><style>@page{size:80mm auto;margin:0}body{font:11px Arial;width:72mm;padding:4mm}h2{text-align:center}table{width:100%;border-collapse:collapse}td,th{padding:3px;border-bottom:1px dashed #aaa;text-align:left}td:last-child,th:last-child{text-align:right}</style></head><body><h2>Purchase ${escapeHtml(p.invoice_number)}</h2><p>Date: ${escapeHtml(p.date||'')}<br>Supplier: ${escapeHtml(p.supplier_name||'')}</p><table><tr><th>Total</th><th>${formatMoney(p.total_amount)}</th></tr><tr><td>Paid</td><td>${formatMoney(p.paid_amount)}</td></tr><tr><td>Balance</td><td>${formatMoney(p.remaining_amount)}</td></tr></table></body></html>`); d.close(); w.onload=()=>{setTimeout(()=>{w.contentWindow.focus();w.contentWindow.print();setTimeout(()=>w.remove(),1000)},80)}; }
async function loadPartnerSummary(id) {
  if (!el.partnerSummary || !id) return;
  try {
    const [summary, ledger] = await Promise.all([
      apiRequest(`/api/partners/${id}/summary`),
      apiRequest(`/api/partners/ledger/${id}`)
    ]);
    el.partnerSummary.innerHTML = [
      ['Net profit', formatMoney(summary.businessNetProfit)],
      ['Calculated share', formatMoney(summary.calculatedProfitShare)],
      ['Advance outstanding', formatMoney(summary.advanceOutstanding)],
      ['Withdrawable', formatMoney(summary.withdrawableProfit)]
    ].map(([label, value]) => `<div class="stat-card"><span class="label">${label}</span><div class="value">${value}</div></div>`).join('');
    el.partnerActivityTitle.textContent = `${ledger.partner.name} — full account activity`;
    el.partnerActivityBody.innerHTML = ledger.transactions.length ? ledger.transactions.map((transaction) => {
      const inflow = ['capital_contribution', 'advance_repayment'].includes(transaction.type) ||
        (transaction.type === 'capital_adjustment' && Number(transaction.amount) > 0);
      const label = transaction.type === 'capital_adjustment'
        ? `capital correction (${Number(transaction.amount) > 0 ? 'increase' : 'decrease'})`
        : transaction.type.replaceAll('_', ' ');
      const displayAmount = Math.abs(Number(transaction.amount || 0));
      return `<tr><td>${String(transaction.created_at || '').slice(0, 10)}</td><td>${escapeHtml(label)}</td><td>${escapeHtml(`${transaction.reason || ''} ${transaction.notes || ''}`.trim())}</td><td>${escapeHtml(transaction.payment_method || '')}</td><td>${inflow ? `Received ${formatMoney(displayAmount)}` : `Paid / allocated ${formatMoney(displayAmount)}`}</td><td>${formatMoney(transaction.partner_balance)}</td><td>${formatMoney(transaction.advance_balance)}</td></tr>`;
    }).join('') : '<tr><td colspan="7">No activity recorded yet.</td></tr>';
  } catch (error) { showMessage(error.message, 'error'); }
}
function showProfitDistribution(result) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const rows = result.results.map((partner) => `<tr>
    <td>${escapeHtml(partner.partner)}</td>
    <td>${Number(partner.ownership_pct)}%</td>
    <td>${formatMoney(partner.grossShare)}</td>
    <td>${formatMoney(partner.advanceOffset)}</td>
    <td>${formatMoney(partner.payable)}</td>
  </tr>`).join('');
  overlay.innerHTML = `<div class="modal-card" style="width:min(900px,94vw)">
    <h3 style="margin:0 0 8px">Profit distribution</h3>
    <p class="muted-copy">Net profit distributed: ${formatMoney(result.totalProfit)}</p>
    <div class="table-scroll"><table>
      <thead><tr><th>Partner</th><th>Share</th><th>Profit share</th><th>Advance adjusted</th><th>Added to balance</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="muted-copy">This records each partner's share in their account; it does not make a cash or bank payment.</p>
    <div class="modal-footer"><button type="button" class="primary-btn" data-act="close">Close</button></div>
  </div>`;
  overlay.addEventListener('click', (event) => {
    if (event.target.dataset.act === 'close' || event.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}
async function distributeProfit() {
  if (!state.partners.length) return showMessage('Add partners before distributing profit.', 'error');
  const amount = await uiPrompt('Net profit to distribute', state.dashboard ? state.dashboard.today.netProfit : '0');
  if (amount === null) return;
  const netProfit = Number(amount);
  if (!Number.isFinite(netProfit) || netProfit <= 0) return showMessage('Enter a profit amount greater than zero.', 'error');
  try {
    const result = await apiRequest('/api/profit-distribution', { method: 'POST', body: JSON.stringify({ net_profit: netProfit }) });
    await loadPartners();
    showProfitDistribution(result);
  } catch (error) { showMessage(error.message, 'error'); }
}
async function repayPartnerAdvance() {
  if (!state.partners.length) return showMessage('Add a partner first', 'error');
  const name = await uiPrompt(`Partner name:\n${state.partners.map((partner) => partner.name).join(', ')}`);
  if (name === null) return;
  const partner = state.partners.find((item) => item.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (!partner) return showMessage('Partner nahi mila', 'error');
  const payment = await uiPaymentPrompt(`Advance returned by ${partner.name}`, Number(partner.advances));
  if (!payment) return;
  try {
    await apiRequest('/api/partner-advance-repayment', { method: 'POST', body: JSON.stringify({ ...payment, partner_id: partner.id, amount: Number(payment.amount) }) });
    await Promise.all([loadPartners(), loadDashboard(), loadBank()]);
    showMessage('Advance repayment recorded');
  } catch (error) { showMessage(error.message, 'error'); }
}
function currentReportDateRange() {
  // Reuses the same date-range controls already on the Reports page (no prompt() dialogs)
  let selectedDate = el.reportDate.value;
  const range = el.reportRange.value;
  const today = new Date();
  let from, to;
  if (range === 'today') { from = to = today.toISOString().slice(0, 10); }
  else if (range === 'yesterday') { today.setDate(today.getDate() - 1); from = to = today.toISOString().slice(0, 10); }
  else if (range === 'week') { const start = new Date(); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); from = start.toISOString().slice(0, 10); to = new Date().toISOString().slice(0, 10); }
  else if (range === 'month') { const start = new Date(); start.setDate(1); from = start.toISOString().slice(0, 10); to = new Date().toISOString().slice(0, 10); }
  else if (range === 'custom' && selectedDate) { from = to = selectedDate; }
  else { from = '2020-01-01'; to = new Date().toISOString().slice(0, 10); }
  return { from, to };
}

function buildReportHtml(from, to, r) {
  const s = state.settings || {};
  const shopName = escapeHtml(s.shop_name || 'ShopFlow Pro');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Business Report</title><style>
    @page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#111;margin:0}
    h1{margin:0 0 2px;font-size:22px}.sub{color:#555;margin:0 0 18px;font-size:13px}
    h2{font-size:15px;margin:22px 0 6px;border-bottom:2px solid #111;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:12px}
    th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f3f4f6}
    .totalrow td{font-weight:700;background:#f9fafb}
  </style></head><body>
    <h1>${shopName} — Business Report</h1>
    <p class="sub">Period: ${from} to ${to}</p>
    <h2>Sales Summary</h2>
    <table><tr><th>Type</th><th>Sales</th><th>COGS</th><th>Profit</th><th>Paid</th><th>Receivable</th></tr>${r.sales.map(x => `<tr><td>${escapeHtml(x.sale_type)}</td><td>${formatMoney(x.sales)}</td><td>${formatMoney(x.cogs)}</td><td>${formatMoney(x.profit)}</td><td>${formatMoney(x.paid)}</td><td>${formatMoney(x.receivable)}</td></tr>`).join('')}</table>
    <h2>Expenses</h2>
    <table><tr><th>Category</th><th>Amount</th></tr>${r.expenses.map(x => `<tr><td>${escapeHtml(x.category)}</td><td>${formatMoney(x.amount)}</td></tr>`).join('') || '<tr><td colspan="2">No expenses recorded</td></tr>'}</table>
    <h2>Top Products</h2>
    <table><tr><th>Product</th><th>Revenue</th><th>Profit</th><th>Qty Sold</th></tr>${r.products.slice(0, 30).map(x => `<tr><td>${escapeHtml(x.product_name)}</td><td>${formatMoney(x.revenue)}</td><td>${formatMoney(x.profit)}</td><td>${x.qty}</td></tr>`).join('')}</table>
  </body></html>`;
}

function buildDailyReportHtml(date, report) {
  const shopName = escapeHtml(state.settings?.shop_name || 'ShopFlow Pro');
  const money = (value) => formatMoney(value);
  const table = (headers, rows, emptyText) => `<table><thead><tr>${headers.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr></thead><tbody>${rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}">${escapeHtml(emptyText)}</td></tr>`}</tbody></table>`;
  const s = report.summary;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Daily Business Report ${escapeHtml(date)}</title><style>
    @page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#111;margin:0}
    h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:20px 0 6px;border-bottom:2px solid #111;padding-bottom:4px}
    p{color:#555}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.card{padding:9px;border:1px solid #ddd;border-radius:6px}
    .card strong{display:block;margin-top:4px;font-size:14px}table{width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:10px}
    th,td{border:1px solid #ddd;padding:5px 6px;text-align:left}th{background:#f3f4f6}
    .print-action{position:fixed;right:18px;top:18px;padding:10px 14px}@media print{.print-action{display:none}}
  </style></head><body>
    <h1>${shopName} — Daily Business Report</h1><p>Date: ${escapeHtml(date)}</p>
    <div class="summary">
      <div class="card">Sales<strong>${money(s.salesTotal)}</strong></div><div class="card">Gross profit<strong>${money(s.grossProfit)}</strong></div>
      <div class="card">Expenses<strong>${money(s.expenses)}</strong></div><div class="card">Net profit<strong>${money(s.netProfit)}</strong></div>
      <div class="card">Purchases / Stock In<strong>${money(s.purchasesTotal)}</strong></div><div class="card">Customer receipts<strong>${money(s.customerReceipts)}</strong></div>
      <div class="card">Supplier payments<strong>${money(s.supplierPayments)}</strong></div><div class="card">Sales due<strong>${money(s.salesDue)}</strong></div>
      <div class="card">Cash in / out<strong>${money(s.cashIn)} / ${money(s.cashOut)}</strong></div><div class="card">Bank in / out<strong>${money(s.bankIn)} / ${money(s.bankOut)}</strong></div>
    </div>
    <h2>Sales — bills and customers</h2>${table(['Invoice','Customer','Type','Total','Cash','Bank','Due','Profit'],report.sales.map(x=>[x.reference,x.customer,x.type,money(x.total),money(x.cash),money(x.bank),money(x.due),money(x.profit)]),'No sales on this date.')}
    <h2>Products sold</h2>${table(['Invoice','Customer','Product / Article','Qty','Amount','Cost','Profit'],report.soldItems.map(x=>[x.reference,x.customer,x.product,`${x.quantity} ${x.article||''}`.trim(),money(x.amount),money(x.cost),money(x.profit)]),'No sale items on this date.')}
    <h2>Purchases and stock received</h2>${table(['Date','Reference','Supplier','Type','Total','Cash','Bank','Due'],report.purchases.map(x=>[x.date,x.reference,x.supplier,x.type,money(x.total),money(x.cash),money(x.bank),money(x.due)]),'No purchases or stock-in entries on this date.')}
    <h2>Goods purchased / received</h2>${table(['Reference','Supplier','Product','Article','Qty','Amount'],report.purchasedItems.map(x=>[x.reference,x.supplier,x.product,x.article,`${x.quantity} ${x.unit||''}`.trim(),money(x.amount)]),'No purchased goods on this date.')}
    <h2>Customer payments received</h2>${table(['Date','Customer','Method','Reference','Amount'],report.customerPayments.map(x=>[x.date,x.customer,x.method,x.reference,money(x.amount)]),'No separate customer payments on this date.')}
    <h2>Supplier payments made</h2>${table(['Date','Supplier','Method','Reference','Amount'],report.supplierPayments.map(x=>[x.date,x.supplier,x.method,x.reference,money(x.amount)]),'No separate supplier payments on this date.')}
    <h2>Expenses</h2>${table(['Date','Expense','Category','Method','Description','Amount'],report.expenses.map(x=>[x.date,x.name,x.category,x.method,x.description,money(x.amount)]),'No expenses on this date.')}
    <h2>Partner activity</h2>${table(['Date','Partner','Activity','Method','Reason','Amount'],report.partnerActivity.map(x=>[x.date,x.partner,x.type,x.method,x.reason,money(x.amount)]),'No partner activity on this date.')}
    <h2>Bank transactions</h2>${table(['Date','Account','Type','Reference / Note','In','Out'],report.bankTransactions.map(x=>[x.date,x.account,x.kind,x.reference,money(x.direction==='in'?x.amount:0),money(x.direction==='out'?x.amount:0)]),'No bank transactions on this date.')}
    <button class="print-action" onclick="window.print()">Print / Save as PDF</button>
  </body></html>`;
}

async function dailyBusinessReport() {
  const date = el.dailyReportDate.value || new Date().toISOString().slice(0, 10);
  el.dailyReportDate.value = date;
  try {
    const report = await apiRequest(`/api/reports/daily?date=${encodeURIComponent(date)}`);
    const html = buildDailyReportHtml(date, report);
    if (window.electronAPI?.isDesktop) {
      const result = await window.electronAPI.savePdf({ html, suggestedName: `Daily-Report-${date}.pdf` });
      if (result.saved) showMessage(`Daily report saved: ${result.filePath}`);
      return;
    }
    const win = window.open('', '_blank', 'width=1200,height=850');
    if (!win) return showMessage('Allow popups to view or print the daily report.', 'error');
    win.document.write(html);
    win.document.close();
  } catch (error) { showMessage(error.message, 'error'); }
}

async function exportListAsPdf(title, tableHtml, suggestedName) {
  const s = state.settings || {};
  const shopName = escapeHtml(s.shop_name || 'ShopFlow Pro');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;color:#111;margin:0}
    h1{font-size:18px;margin:0 0 2px}.sub{color:#555;font-size:12px;margin:0 0 14px}
    table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ddd;padding:5px 7px;text-align:left}th{background:#f3f4f6}
  </style></head><body><h1>${shopName} — ${escapeHtml(title)}</h1><p class="sub">${new Date().toLocaleString()}</p>${tableHtml}</body></html>`;
  if (window.electronAPI?.isDesktop) {
    try {
      const result = await window.electronAPI.savePdf({ html, suggestedName });
      if (result.saved) showMessage(`PDF saved: ${result.filePath}`);
    } catch (e) { showMessage(e.message, 'error'); }
    return;
  }
  const win = window.open('', '_blank', 'width=1000,height=700');
  if (!win) return showMessage('Allow popups to save PDF', 'error');
  win.document.write(html.replace('</body>', '<div style="margin-top:16px"><button onclick="window.print()">Print / Save as PDF</button></div></body>'));
  win.document.close();
}

async function exportProductsPdf() {
  const rows = state.products.map((p) => {
    const articles = Array.isArray(p.articles) ? p.articles : [];
    const articleText = articles.length ? articles.map(a => `${a.name}: ${Number(a.stock_qty || 0).toFixed(2)}`).join(', ') : 'Default';
    return `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category || '')}</td><td>${escapeHtml(articleText)}</td><td>${formatMoney(p.retail_price)}</td><td>${formatMoney(p.wholesale_price)}</td><td>${Number(p.current_stock || 0).toFixed(2)} ${escapeHtml(p.base_unit || p.unit || '')}</td></tr>`;
  }).join('');
  const tableHtml = `<table><tr><th>Product</th><th>Category</th><th>Articles (stock)</th><th>Retail</th><th>Wholesale</th><th>Base Stock</th></tr>${rows}</table>`;
  await exportListAsPdf('Products Report', tableHtml, 'Products-Report.pdf');
}

async function exportStockPdf() {
  const entries = await apiRequest('/api/stock');
  const rows = entries.map((e) => `<tr><td>${escapeHtml(e.entry_date)}</td><td>${escapeHtml(e.product_name)}</td><td>${escapeHtml(String(e.quantity))} ${escapeHtml(e.unit)}</td><td>${escapeHtml(String(e.base_quantity))}</td><td>${formatMoney(e.unit_cost)}</td><td>${escapeHtml(e.expiry_date || '-')}</td></tr>`).join('');
  const tableHtml = `<table><tr><th>Date</th><th>Product</th><th>Qty</th><th>Base Qty</th><th>Unit Cost</th><th>Expiry</th></tr>${rows}</table>`;
  await exportListAsPdf('Stock Report', tableHtml, 'Stock-Report.pdf');
}

async function comprehensiveReport(mode) {
  const { from, to } = currentReportDateRange();
  try {
    const r = await apiRequest(`/api/reports/comprehensive?from=${from}&to=${to}`);
    const html = buildReportHtml(from, to, r);
    if (mode === 'pdf' && window.electronAPI?.isDesktop) {
      const result = await window.electronAPI.savePdf({ html, suggestedName: `Business-Report-${from}-to-${to}.pdf` });
      if (result.saved) showMessage(`PDF saved: ${result.filePath}`);
      return;
    }
    const win = window.open('', '_blank', 'width=1000,height=700');
    if (!win) return showMessage('Allow popups to view/print the report', 'error');
    win.document.write(html.replace('</body>', '<div style="margin-top:20px"><button onclick="window.print()" style="padding:10px 18px;font-size:14px">Print / Save as PDF</button></div></body>'));
    win.document.close();
  } catch (e) { showMessage(e.message, 'error'); }
}

async function loadCustomers() {
  const customers = await apiRequest('/api/customers');
  state.customers = customers;

  el.customerSelect.innerHTML = '<option value="">Walk-in / Direct Bill</option>' + customers.map((c) => `<option value="${c.id}">${c.name} (${c.type})</option>`).join('');

  const term = (el.customerSearch.value || '').toLowerCase();
  el.customersTableBody.innerHTML = customers.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(term)).map((c) => `
    <tr><td>${c.name}</td><td>${c.phone}</td><td>${c.type}</td><td class="${c.remaining_balance > 0 ? 'balance-due' : ''}">${formatMoney(c.remaining_balance)}</td><td><button class="small-btn" data-customer-ledger="${c.id}">Khata</button><button class="small-btn" data-customer-payment="${c.id}">Payment</button><button class="small-btn" data-customer-reminder="${c.id}">WhatsApp</button><button class="small-btn" data-edit-customer="${c.id}">Edit</button><button class="small-btn danger-btn" data-delete-customer="${c.id}">Delete</button></td></tr>
  `).join('') || '<tr><td colspan="5" class="empty-state">No customers found. Add the first customer above.</td></tr>';
  document.querySelectorAll('[data-customer-ledger]').forEach((button) => { button.onclick = () => showCustomerLedger(button.dataset.customerLedger); });
  document.querySelectorAll('[data-customer-payment]').forEach((button) => { button.onclick = () => addCustomerPayment(button.dataset.customerPayment); });
  document.querySelectorAll('[data-customer-reminder]').forEach((button) => { button.onclick = () => sendCustomerReminder(button.dataset.customerReminder); });
  document.querySelectorAll('[data-edit-customer]').forEach((button) => { button.onclick = () => editCustomer(button.dataset.editCustomer); });
  document.querySelectorAll('[data-delete-customer]').forEach((button) => { button.onclick = () => deleteCustomer(button.dataset.deleteCustomer); });
}

async function sendCustomerReminder(id) {
  const customer = state.customers.find((item) => item.id === id);
  if (!customer || !customer.phone) return showMessage('Customer phone is required', 'error');
  const template = state.settings?.whatsapp_template || 'Assalam o Alaikum {name}, aapka account balance {balance} hai. Meharbani karke payment update kar dein. Shukriya.';
  const defaultMessage = template.replace(/\{name\}/g, customer.name).replace(/\{balance\}/g, formatMoney(customer.remaining_balance));
  const message = await uiPrompt('WhatsApp reminder message (editable)', defaultMessage);
  if (message === null) return;
  let phone = customer.phone.replace(/\D/g, '');
  if (phone.startsWith('0')) phone = '92' + phone.slice(1); // Pakistani local -> country code
  else if (!phone.startsWith('92') && phone.length === 10) phone = '92' + phone;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

async function loadSuppliers() {
  const suppliers = await apiRequest('/api/suppliers');
  state.suppliers = suppliers;

  el.purchaseSupplierSelect.innerHTML = suppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
  el.stockSupplierSelect.innerHTML = `<option value="">No supplier</option>${suppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}`;
  if (el.hisabSupplierFilter) {
    const selectedSupplier = el.hisabSupplierFilter.value;
    el.hisabSupplierFilter.innerHTML = `<option value="">All suppliers</option>${suppliers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}`;
    if (suppliers.some((s) => s.id === selectedSupplier)) el.hisabSupplierFilter.value = selectedSupplier;
  }

  const term = (el.supplierSearch.value || '').toLowerCase();
  el.suppliersTableBody.innerHTML = suppliers.filter((s) => `${s.name} ${s.phone}`.toLowerCase().includes(term)).map((s) => `
    <tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.phone)}</td><td class="${s.remaining_payable > 0 ? 'balance-due' : ''}">${formatMoney(s.remaining_payable)}</td><td><button class="small-btn" data-supplier-ledger="${s.id}">Khata</button><button class="small-btn" data-supplier-payment="${s.id}">Payment</button><button class="small-btn" data-supplier-items="${s.id}">Goods</button><button class="small-btn" data-edit-supplier="${s.id}">Edit</button><button class="small-btn danger-btn" data-delete-supplier="${s.id}">Delete</button></td></tr>
  `).join('') || '<tr><td colspan="4" class="empty-state">No suppliers found. Add the first supplier above.</td></tr>';
  document.querySelectorAll('[data-supplier-ledger]').forEach((button) => { button.onclick = () => showSupplierLedger(button.dataset.supplierLedger); });
  document.querySelectorAll('[data-supplier-payment]').forEach((button) => { button.onclick = () => addSupplierPayment(button.dataset.supplierPayment); });
  document.querySelectorAll('[data-supplier-items]').forEach((button) => { button.onclick = () => {
    el.hisabSupplierFilter.value = button.dataset.supplierItems;
    hisabTab = 'supplierItems';
    setSection('hisab');
  }; });
  document.querySelectorAll('[data-edit-supplier]').forEach((button) => { button.onclick = () => editSupplier(button.dataset.editSupplier); });
  document.querySelectorAll('[data-delete-supplier]').forEach((button) => { button.onclick = () => deleteSupplier(button.dataset.deleteSupplier); });
}

async function loadPartners() {
  const partners = await apiRequest('/api/partners');
  state.partners = partners;

  if (el.partnerActivitySelect) {
    const selected = el.partnerActivitySelect.value;
    el.partnerActivitySelect.innerHTML = partners.map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${p.ownership_pct}%)</option>`).join('');
    if (partners.some((p) => p.id === selected)) el.partnerActivitySelect.value = selected;
  }
  el.partnersTableBody.innerHTML = partners.map((p) => `<tr><td><button class="invoice-link" data-partner-summary="${p.id}">${escapeHtml(p.name)}</button></td><td>${formatMoney(p.capital)}</td><td>${p.ownership_pct}%</td><td>${formatMoney(p.profit_share)}</td><td>${formatMoney(p.advances)}</td><td>${formatMoney(p.withdrawals)}</td><td>${formatMoney(p.current_balance)}</td><td><button class="small-btn" data-edit-partner="${p.id}">Edit</button><button class="small-btn danger-btn" data-delete-partner="${p.id}">Delete</button></td></tr>`).join('');
  document.querySelectorAll('[data-partner-summary]').forEach(b=>b.onclick=()=>loadPartnerSummary(b.dataset.partnerSummary));
  document.querySelectorAll('[data-edit-partner]').forEach((button) => { button.onclick = () => editPartner(button.dataset.editPartner); });
  document.querySelectorAll('[data-delete-partner]').forEach((button) => { button.onclick = () => deletePartner(button.dataset.deletePartner); });
}

async function loadExpenses() {
  const expenses = await apiRequest('/api/expenses');
  state.expenses = expenses;

  el.expensesTableBody.innerHTML = expenses.map((e) => `
    <tr><td>${e.name}</td><td>${e.category}</td><td>${formatMoney(e.amount)}</td><td>${e.date}</td></tr>
  `).join('');
}

async function loadReports() {
  let selectedDate = el.reportDate.value;
  const range = el.reportRange.value;
  const today = new Date();
  if (range === 'today') selectedDate = today.toISOString().slice(0, 10);
  if (range === 'yesterday') { today.setDate(today.getDate() - 1); selectedDate = today.toISOString().slice(0, 10); }
  const params = new URLSearchParams();
  if (selectedDate && range !== 'week' && range !== 'month') params.set('date', selectedDate);
  if (range === 'week' || range === 'month') {
    const start = new Date();
    if (range === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    if (range === 'month') start.setDate(1);
    params.set('from', start.toISOString().slice(0, 10));
    params.set('to', new Date().toISOString().slice(0, 10));
  }
  if (el.reportSearch.value.trim()) params.set('search', el.reportSearch.value.trim());
  const query = params.toString() ? `?${params.toString()}` : '';
  const reports = await apiRequest(`/api/reports${query}`);
  const totalSales = reports.sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  const totalProfit = reports.sales.reduce((sum, s) => sum + Number(s.profit_total || 0), 0);

  el.reportSummary.innerHTML = [
    { label: 'Total Sales', value: formatMoney(totalSales) },
    { label: 'Total Profit', value: formatMoney(totalProfit) },
    { label: 'Expenses', value: formatMoney((reports.expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0)) },
    { label: 'Entries', value: reports.sales.length }
  ].map((card) => `
    <div class="stat-card"><span class="label">${card.label}</span><div class="value">${card.value}</div></div>
  `).join('');

  el.salesReportsBody.innerHTML = (reports.sales || []).slice(0, 12).map((sale) => `
    <tr><td><button class="invoice-link" data-open-sale="${sale.id}">${sale.invoice_number}</button></td><td>${sale.sale_date || sale.created_at.slice(0, 10)}</td><td>${sale.customer_name}</td><td>${sale.sale_type}</td><td>${formatMoney(sale.total_amount)}</td><td>${formatMoney(sale.profit_total)}</td><td><button class="small-btn print-btn" data-print-sale="${sale.id}">Print</button><button class="small-btn" data-edit-sale="${sale.id}">Edit</button><button class="small-btn danger-btn" data-delete-sale="${sale.id}">Delete</button></td></tr>
  `).join('');
  document.querySelectorAll('[data-open-sale]').forEach((button) => { button.onclick = () => showInvoiceDetail(button.dataset.openSale); });
  document.querySelectorAll('[data-print-sale]').forEach((button) => { button.onclick = () => printInvoice(button.dataset.printSale); });
  document.querySelectorAll('[data-edit-sale]').forEach((button) => { button.onclick = () => editSale(button.dataset.editSale); });
  document.querySelectorAll('[data-delete-sale]').forEach((button) => { button.onclick = () => deleteSale(button.dataset.deleteSale); });
}

async function showInvoiceDetail(id) {
  const sale = await apiRequest(`/api/sales/${id}`); el.invoiceDetail.classList.remove('hidden');
  el.invoiceDetail.innerHTML=`<div class="invoice-full-card"><div class="section-head"><div><span class="eyebrow">COMPLETE INVOICE</span><h3>${escapeHtml(sale.invoice_number)}</h3><p class="muted-copy">${escapeHtml(sale.customer_name||'Walk-in Customer')} · ${escapeHtml(sale.sale_date||sale.created_at.slice(0,10))} · ${escapeHtml(sale.payment_method||'Cash')}</p></div><div><button class="small-btn" data-print-detail>Print</button><button class="ghost-btn" data-close-invoice>Close</button></div></div><table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Cost</th><th>Discount</th><th>Line Total</th><th>Profit</th></tr></thead><tbody>${sale.items.map(item=>`<tr><td><strong>${escapeHtml(item.product_name)}</strong></td><td>${Number(item.quantity).toFixed(3).replace(/0+$/,'').replace(/\.$/,'')}</td><td>${formatMoney(item.selling_price)}</td><td>${formatMoney(item.cost_price)}</td><td>${formatMoney(item.discount_amount)}</td><td>${formatMoney(item.subtotal-item.discount_amount)}</td><td>${formatMoney(item.total_profit)}</td></tr>`).join('')}</tbody></table><div class="invoice-totals"><span>Gross Profit <strong>${formatMoney(sale.profit_total)}</strong></span><span>Paid <strong>${formatMoney(sale.paid_amount)}</strong></span><span>Balance <strong class="balance-due">${formatMoney(sale.remaining_amount)}</strong></span><span>Grand Total <strong>${formatMoney(sale.total_amount)}</strong></span></div></div>`;
  el.invoiceDetail.querySelector('[data-close-invoice]').onclick=()=>el.invoiceDetail.classList.add('hidden'); el.invoiceDetail.querySelector('[data-print-detail]').onclick=()=>printInvoice(id); el.invoiceDetail.scrollIntoView({behavior:'smooth',block:'center'});
}

async function showCustomerLedger(id) {
  const result = await apiRequest(`/api/customers/${id}/ledger`);
  el.customerProfile.classList.remove('hidden');
  el.customerProfile.innerHTML = `<div class="section-head"><div><span class="eyebrow">CUSTOMER KHATA</span><h3>${escapeHtml(result.customer.name)}</h3><p class="muted-copy">${escapeHtml(result.customer.phone || 'No phone')} ${result.customer.address ? `| ${escapeHtml(result.customer.address)}` : ''}</p></div><div><button class="success-btn" data-profile-payment>Receive payment</button><button class="ghost-btn" data-close-profile>Close</button></div></div><div class="stats-grid small"><div class="stat-card"><span class="label">Outstanding</span><div class="value balance-due">${formatMoney(result.customer.remaining_balance)}</div></div><div class="stat-card"><span class="label">Total purchases</span><div class="value">${formatMoney(result.customer.total_purchases)}</div></div><div class="stat-card"><span class="label">Total paid</span><div class="value">${formatMoney(result.customer.total_paid)}</div></div></div><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Running Balance</th><th>Reference</th><th>Notes</th></tr></thead><tbody>${result.transactions.map((item) => `<tr><td>${item.created_at.slice(0, 10)}</td><td>${escapeHtml(item.type)}</td><td>${formatMoney(item.amount)}</td><td>${formatMoney(item.running_balance)}</td><td>${escapeHtml(item.reference || '')}</td><td>${escapeHtml(item.notes || '')}</td></tr>`).join('') || '<tr><td colspan="6">No transactions yet</td></tr>'}</tbody></table>`;
  el.customerProfile.querySelector('[data-close-profile]').onclick = () => el.customerProfile.classList.add('hidden');
  el.customerProfile.querySelector('[data-profile-payment]').onclick = () => addCustomerPayment(id);
  el.customerProfile.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function showSupplierLedger(id) {
  const result = await apiRequest(`/api/suppliers/${id}/ledger`);
  el.supplierProfile.classList.remove('hidden');
  el.supplierProfile.innerHTML = `<div class="section-head"><div><span class="eyebrow">SUPPLIER KHATA</span><h3>${escapeHtml(result.supplier.name)}</h3><p class="muted-copy">${escapeHtml(result.supplier.phone || 'No phone')} ${result.supplier.address ? `| ${escapeHtml(result.supplier.address)}` : ''}</p></div><div><button class="success-btn" data-supplier-profile-payment>Record Payment</button><button class="ghost-btn" data-close-supplier-profile>Close</button></div></div><div class="stats-grid small"><div class="stat-card"><span class="label">Payable</span><div class="value balance-due">${formatMoney(result.supplier.remaining_payable)}</div></div><div class="stat-card"><span class="label">Total purchases</span><div class="value">${formatMoney(result.supplier.total_purchases)}</div></div><div class="stat-card"><span class="label">Total paid</span><div class="value">${formatMoney(result.supplier.total_paid)}</div></div></div><div class="table-scroll"><table><thead><tr><th>Date</th><th>Type</th><th>Source</th><th>Amount</th><th>Remaining Payable</th><th>Reference</th><th>Notes</th></tr></thead><tbody>${result.transactions.map((item) => `<tr><td>${String(item.created_at || '').slice(0, 10)}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.payment_method || '')}</td><td>${formatMoney(item.amount)}</td><td>${formatMoney(item.running_balance)}</td><td>${escapeHtml(item.reference || '')}</td><td>${escapeHtml(item.notes || '')}</td></tr>`).join('') || '<tr><td colspan="7">No transactions yet</td></tr>'}</tbody></table></div>`;
  el.supplierProfile.querySelector('[data-close-supplier-profile]').onclick = () => el.supplierProfile.classList.add('hidden');
  el.supplierProfile.querySelector('[data-supplier-profile-payment]').onclick = () => addSupplierPayment(id);
  el.supplierProfile.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function addCustomerPayment(id) {
  const payment = await uiPaymentPrompt('Customer se received payment');
  if (!payment) return;
  try {
    await apiRequest('/api/customer-payments', { method: 'POST', body: JSON.stringify({ ...payment, customer_id: id, amount: Number(payment.amount) }) });
    await Promise.all([loadCustomers(), loadDashboard(), loadBank()]);
    if (!el.customerProfile.classList.contains('hidden')) await showCustomerLedger(id);
    showMessage(`Payment received via ${payment.payment_method}`);
  } catch (error) { showMessage(error.message, 'error'); }
}

async function addSupplierPayment(id) {
  const supplier = state.suppliers.find((entry) => entry.id === id);
  if (!supplier) return;
  const payable = Number(supplier.remaining_payable);
  if (payable <= 0) return showMessage('Is supplier ka payable balance nahi hai', 'error');
  const payment = await uiPaymentPrompt(`Supplier ko payment (payable ${formatMoney(payable)})`, payable);
  if (!payment) return;
  try {
    await apiRequest('/api/supplier-payments', { method: 'POST', body: JSON.stringify({ ...payment, supplier_id: id, amount: Number(payment.amount) }) });
    await Promise.all([loadSuppliers(), loadDashboard(), loadBank()]);
    if (!el.supplierProfile.classList.contains('hidden')) await showSupplierLedger(id);
    showMessage(`Supplier payment recorded via ${payment.payment_method}`);
  } catch (error) { showMessage(error.message, 'error'); }
}

async function loadStock() {
  const entries = await apiRequest('/api/stock');
  el.stockTableBody.innerHTML = entries.map((entry) => `<tr><td>${escapeHtml(entry.entry_date || '')}</td><td>${escapeHtml(entry.supplier_name || '—')}</td><td>${escapeHtml(entry.product_name)}${entry.article_name ? `<small class="table-sub">${escapeHtml(entry.article_name)}</small>` : ''}</td><td>${Number(entry.quantity)} ${escapeHtml(entry.unit)}</td><td>${Number(entry.base_quantity)}</td><td>${formatMoney(entry.unit_cost)}</td><td>${formatMoney(entry.total_cost)}</td><td>${formatMoney(entry.cash_paid)}</td><td>${formatMoney(entry.bank_paid)}</td><td>${formatMoney(Math.max(0, Number(entry.total_cost || 0) - Number(entry.paid_amount || 0)))}</td><td>${escapeHtml(entry.expiry_date || '-')}</td><td>${entry.update_rate ? 'Updated' : 'Kept'}</td><td><button class="small-btn" data-edit-stock="${entry.id}">Edit</button><button class="small-btn danger-btn" data-delete-stock="${entry.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="13">No stock entries yet</td></tr>';
  document.querySelectorAll('[data-edit-stock]').forEach((button) => { button.onclick = () => editStock(button.dataset.editStock); });
  document.querySelectorAll('[data-delete-stock]').forEach((button) => { button.onclick = () => deleteStock(button.dataset.deleteStock); });
}

async function saveStock(event) {
  event.preventDefault();
  try {
    const payload = Object.fromEntries(new FormData(event.target).entries());
    await apiRequest('/api/stock', { method: 'POST', body: JSON.stringify(payload) });
    event.target.reset();
    event.target.querySelector('[name="entry_date"]').value = new Date().toISOString().slice(0, 10);
    showMessage('Stock added successfully');
    await Promise.all([loadStock(), loadProducts(), loadSuppliers(), loadDashboard(), loadBank()]);
  } catch (error) { showMessage(error.message, 'error'); }
}

async function saveStockAdjustment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = Object.fromEntries(new FormData(form).entries());
  const adjustment = {
    product_id: fields.product_id,
    article_id: fields.article_id || null,
    direction: fields.direction,
    quantity: Number(fields.quantity),
    reason: fields.reason
  };
  try {
    await apiRequest('/api/stock/adjustment', { method: 'POST', body: JSON.stringify(adjustment) });
    form.reset();
    await Promise.all([loadStock(), loadProducts(), loadDashboard()]);
    showMessage('Stock adjustment saved');
  } catch (error) { showMessage(error.message, 'error'); }
}

function updateAdjustmentArticles() {
  if (!el.adjustmentProductSelect || !el.adjustmentArticleSelect) return;
  const product = state.products.find((item) => item.id === el.adjustmentProductSelect.value);
  const articles = product?.articles || [];
  el.adjustmentArticleSelect.innerHTML = `<option value="">Base unit (${escapeHtml(product?.base_unit || product?.unit || 'units')})</option>` +
    articles.map((article) => `<option value="${article.id}">${escapeHtml(article.name)} — ${Number(article.stock_qty || 0).toFixed(3)}</option>`).join('');
}

function updateStockCalculation() {
  const product = state.products.find((item) => item.id === el.stockProductSelect.value);
  if (!product || !el.stockCalculation) return;
  const quantity = Number(el.stockForm.elements.quantity.value || 0);
  const factor = Number(el.stockForm.elements.conversion_factor.value || product.unit_factor || 1);
  const added = quantity * factor;
  el.stockCalculation.innerHTML = `<strong>${quantity || 0} ${el.stockForm.elements.unit.value || product.purchase_unit || 'packs'}</strong> &times; <strong>${factor} ${product.base_unit || product.unit || 'units'}</strong> = <strong>${added} ${product.base_unit || product.unit || 'units'}</strong><span> Previous: ${product.current_stock} &nbsp; New: ${Number(product.current_stock || 0) + added}</span>`;
}

async function loadAccounts() {
  const date = el.accountsDate.value || new Date().toISOString().slice(0, 10);
  el.accountsDate.value = date;
  const accounts = await apiRequest(`/api/accounts/daily?date=${date}`);
  const cards = [
    ['Sales', formatMoney(accounts.sales.total)], ['Cash In', formatMoney(accounts.cashIn)], ['Cash Out', formatMoney(accounts.cashOut)],
    ['Purchases', formatMoney(Number(accounts.purchases.total) + Number(accounts.stockIn.total))],
    ['Expenses', formatMoney(accounts.expenses.total)], ['Net Profit', formatMoney(accounts.netProfit)], ['Cash Movement', formatMoney(accounts.cash)]
  ];
  el.accountsSummary.innerHTML = cards.map(([label, value]) => `<div class="stat-card"><span class="label">${label}</span><div class="value">${value}</div></div>`).join('');
  el.accountsBreakdown.innerHTML = `<div class="account-line"><span>Invoices</span><strong>${accounts.sales.count}</strong></div><div class="account-line"><span>Purchase entries</span><strong>${accounts.purchases.count}</strong></div><div class="account-line"><span>Stock-in cost</span><strong>${formatMoney(accounts.stockIn.total)}</strong></div><div class="account-line"><span>Stock base quantity</span><strong>${accounts.stockIn.quantity}</strong></div>`;
}

async function loadUsers() {
  if (el.userPartnerSelect) el.userPartnerSelect.innerHTML='<option value="">Partner account (optional)</option>'+state.partners.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  state.users = await apiRequest('/api/users');
  el.usersTableBody.innerHTML = state.users.map((user) => `<tr><td>${user.name}</td><td>${user.username}</td><td><span class="role-tag">${user.role}</span></td><td><button class="small-btn" data-change-password="${user.id}">Change</button></td><td><button class="small-btn danger-btn" data-delete-user="${user.id}">Delete</button></td></tr>`).join('');
  document.querySelectorAll('[data-change-password]').forEach((button) => { button.onclick = () => changePassword(button.dataset.changePassword); });
  document.querySelectorAll('[data-delete-user]').forEach((button) => { button.onclick = () => deleteUser(button.dataset.deleteUser); });
}

async function saveUser(event) {
  event.preventDefault();
  try { await apiRequest('/api/users', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target).entries())) }); event.target.reset(); await loadUsers(); showMessage('User created'); } catch (error) { showMessage(error.message, 'error'); }
}

async function changePassword(id) {
  const password = await uiPrompt('New password');
  if (!password) return;
  try { await apiRequest(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify({ password }) }); showMessage('Password changed'); } catch (error) { showMessage(error.message, 'error'); }
}

async function deleteUser(id) {
  if (!window.confirm('Delete this user?')) return;
  try { await apiRequest(`/api/users/${id}`, { method: 'DELETE' }); await loadUsers(); showMessage('User deleted'); } catch (error) { showMessage(error.message, 'error'); }
}

async function deleteSale(id) {
  if (!window.confirm('Delete this invoice and restore its stock?')) return;
  try { await apiRequest(`/api/sales/${id}`, { method: 'DELETE' }); await Promise.all([loadReports(), loadProducts(), loadDashboard(), loadCustomers()]); showMessage('Invoice deleted'); } catch (error) { showMessage(error.message, 'error'); }
}

async function editStock(id) {
  const entries = await apiRequest('/api/stock');
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  const quantity = await uiPrompt('Quantity', entry.quantity);
  if (quantity === null) return;
  const unitCost = await uiPrompt('Cost per base unit', entry.unit_cost);
  if (unitCost === null) return;
  const expiryDate = await uiPrompt('Expiry date (YYYY-MM-DD, blank for none)', entry.expiry_date || '');
  if (expiryDate === null) return;
  try {
    await apiRequest(`/api/stock/${id}`, { method: 'PUT', body: JSON.stringify({ ...entry, quantity: Number(quantity), unit_cost: Number(unitCost), expiry_date: expiryDate, update_rate: entry.update_rate }) });
    await Promise.all([loadStock(), loadProducts(), loadDashboard()]);
    showMessage('Stock entry updated');
  } catch (error) { showMessage(error.message, 'error'); }
}

async function deleteStock(id) {
  if (!window.confirm('Delete this stock entry and restore the previous quantity?')) return;
  try {
    await apiRequest(`/api/stock/${id}`, { method: 'DELETE' });
    await Promise.all([loadStock(), loadProducts(), loadDashboard()]);
    showMessage('Stock entry deleted');
  } catch (error) { showMessage(error.message, 'error'); }
}

async function editSale(id) {
  try {
    const sale = await apiRequest(`/api/sales/${id}`);
    const root = document.getElementById('modalRoot');
    const productOptions = state.products.map(p=>`<option value="${p.id}">${escapeHtml(p.name)} — ${escapeHtml(p.category||'')}</option>`).join('');
    root.innerHTML=`<div class="modal-overlay"><div class="modal-card invoice-editor wide-editor"><div class="modal-head"><div><span class="eyebrow">FULL INVOICE EDITOR</span><h2>${escapeHtml(sale.invoice_number)}</h2><p class="muted-copy">Edit the complete invoice exactly like a new bill.</p></div><button class="icon-btn" data-close-modal>×</button></div>
      <div class="editor-grid"><div><label>Customer</label><select id="editCustomer"><option value="">Walk-in / Direct Bill</option>${state.customers.map(c=>`<option value="${c.id}" ${c.id===sale.customer_id?'selected':''}>${escapeHtml(c.name)} — Due ${formatMoney(c.remaining_balance)}</option>`).join('')}</select></div><div><label>Payment</label><select id="editPayment"><option ${sale.payment_method==='Cash'?'selected':''}>Cash</option><option ${sale.payment_method==='Bank'?'selected':''}>Bank</option><option ${sale.payment_method==='Online'?'selected':''}>Online</option><option ${sale.payment_method==='Credit'?'selected':''}>Credit</option></select></div><div><label>Paid Amount</label><input id="editPaid" type="number" min="0" step="0.01" value="${sale.paid_amount}"></div><div><label>Bill Date</label><input id="editDate" type="date" value="${sale.sale_date||sale.created_at.slice(0,10)}"></div></div>
      <div class="invoice-edit-toolbar"><button class="ghost-btn" id="editAddLine">+ Add Item</button><span class="muted-copy">Change product, package/article, quantity, rate and discount.</span></div>
      <div class="invoice-edit-lines"><table><thead><tr><th>Product</th><th>Article / Pack</th><th>Qty</th><th>Rate</th><th>Cost</th><th>Discount</th><th>Total</th><th></th></tr></thead><tbody id="editLines"></tbody></table></div>
      <div class="modal-footer"><div class="editor-total">New total <strong id="editGrandTotal">${formatMoney(sale.total_amount)}</strong></div><button class="ghost-btn" data-close-modal>Cancel</button><button class="success-btn" id="saveInvoiceEdit">Save Complete Invoice</button></div></div></div>`;
    const close=()=>root.innerHTML=''; root.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=close);
    const lines=sale.items.map(it=>({product_id:it.product_id,article_id:it.article_id||'',quantity:it.quantity,price:it.selling_price,cost:it.cost_price,discount:it.discount_amount||0}));
    const addRow=(line={product_id:'',article_id:'',quantity:1,price:0,cost:0,discount:0})=>{
      const tr=document.createElement('tr'); tr.className='edit-line';
      tr.innerHTML=`<td><select class="edit-product">${'<option value="">Select product</option>'+productOptions}</select></td><td><select class="edit-article"><option value="">Default/base</option></select></td><td><input class="edit-qty" type="number" min="0.001" step="0.001" value="${line.quantity}"></td><td><input class="edit-rate" type="number" min="0" step="0.01" value="${line.price}"></td><td class="edit-cost mono">${formatMoney(line.cost)}</td><td><input class="edit-disc" type="number" min="0" step="0.01" value="${line.discount}"></td><td class="edit-line-total">0</td><td><button class="small-btn danger-btn edit-remove" type="button">Remove</button></td>`;
      const ps=tr.querySelector('.edit-product'), as=tr.querySelector('.edit-article'); ps.value=line.product_id;
      const refreshArticle=()=>{ const p=state.products.find(x=>x.id===ps.value); const arts=p?.articles||[]; as.innerHTML='<option value="">Default/base</option>'+arts.map(a=>`<option value="${a.id}">${escapeHtml(a.name)} — ${Number(a.stock_qty||0).toFixed(3)}</option>`).join(''); if(line.article_id) as.value=line.article_id; const art=arts.find(a=>a.id===as.value); if(art){tr.querySelector('.edit-rate').value=line.price||art.retail_price; tr.querySelector('.edit-cost').textContent=formatMoney(art.purchase_price||0);} else if(p){tr.querySelector('.edit-rate').value=line.price||p.retail_price; tr.querySelector('.edit-cost').textContent=formatMoney(p.purchase_price||0);} recalc(); };
      ps.onchange=()=>{line.article_id='';refreshArticle();}; as.onchange=()=>{line.article_id=as.value; const p=state.products.find(x=>x.id===ps.value); const a=(p?.articles||[]).find(x=>x.id===as.value); if(a){tr.querySelector('.edit-rate').value=a.retail_price;tr.querySelector('.edit-cost').textContent=formatMoney(a.purchase_price);} recalc();};
      [tr.querySelector('.edit-qty'),tr.querySelector('.edit-rate'),tr.querySelector('.edit-disc')].forEach(i=>i.oninput=recalc);
      tr.querySelector('.edit-remove').onclick=()=>{tr.remove();recalc();}; root.querySelector('#editLines').appendChild(tr); refreshArticle();
    };
    sale.items.forEach(it=>addRow({product_id:it.product_id,article_id:it.article_id||'',quantity:it.quantity,price:it.selling_price,cost:it.cost_price,discount:it.discount_amount||0}));
    root.querySelector('#editAddLine').onclick=()=>addRow();
    function recalc(){ let total=0; root.querySelectorAll('.edit-line').forEach(tr=>{const q=Number(tr.querySelector('.edit-qty').value||0),r=Number(tr.querySelector('.edit-rate').value||0),d=Math.min(q*r,Math.max(0,Number(tr.querySelector('.edit-disc').value||0))); const t=q*r-d; tr.querySelector('.edit-line-total').textContent=formatMoney(t); total+=t;}); root.querySelector('#editGrandTotal').textContent=formatMoney(total); }
    recalc();
    root.querySelector('#saveInvoiceEdit').onclick=async()=>{ const items=[...root.querySelectorAll('.edit-line')].map(tr=>{const p=tr.querySelector('.edit-product').value; const a=tr.querySelector('.edit-article').value||null; const product=state.products.find(x=>x.id===p); const art=(product?.articles||[]).find(x=>x.id===a); const factor=Number(art?.base_per_unit||product?.unit_factor||1); return {product_id:p,article_id:a,quantity:Number(tr.querySelector('.edit-qty').value||0),conversion_factor:factor,price:Number(tr.querySelector('.edit-rate').value||0),cost:Number(art?.purchase_price||product?.purchase_price||0),discount:Number(tr.querySelector('.edit-disc').value||0),discount_percent:0}; }).filter(x=>x.product_id&&x.quantity>0); if(!items.length)return showMessage('Add at least one valid item','error'); try{await apiRequest(`/api/sales/${id}`,{method:'PUT',body:JSON.stringify({items,customer_id:root.querySelector('#editCustomer').value||null,sale_type:sale.sale_type,paid_amount:Number(root.querySelector('#editPaid').value||0),payment_method:root.querySelector('#editPayment').value,sale_date:root.querySelector('#editDate').value,notes:sale.notes||''})});close();await Promise.all([loadReports(),loadDashboard(),loadProducts(),loadCustomers(),loadStock()]);showMessage('Complete invoice updated');}catch(e){showMessage(e.message,'error');}};
  } catch(e){showMessage(e.message,'error');}
}

function buildReceiptHtml(title, sale, rows) {
  const s = state.settings || {};
  const shopName = escapeHtml(s.shop_name || title || 'ShopFlow Pro');
  const contactLine = [s.shop_phone, s.shop_address].filter(Boolean).map(escapeHtml).join(' &nbsp;•&nbsp; ');
  const footer = escapeHtml(s.receipt_footer || 'Thank you for shopping with us!');
  const dateStr = escapeHtml(sale.sale_date || sale.created_at?.slice(0, 10) || '');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(sale.invoice_number)}</title><style>
    @page{size:80mm auto;margin:0}html,body{margin:0;padding:0;background:#fff;color:#000}
    body{font-family:'Segoe UI',Arial,sans-serif;width:72mm;padding:4mm 4mm 10mm;font-size:11.5px;box-sizing:border-box}
    .shop-name{text-align:center;font-size:18px;font-weight:800;letter-spacing:.3px;margin:0}
    .contact{text-align:center;font-size:9.5px;color:#333;margin:2px 0 6px}
    .rule{border-top:1px dashed #000;margin:6px 0}
    .rule.solid{border-top:2px solid #000}
    .meta{font-size:10.5px;margin:4px 0;display:flex;justify-content:space-between}
    .meta span:last-child{text-align:right}
    table{width:100%;border-collapse:collapse;margin-top:4px}
    th{font-size:9.5px;text-transform:uppercase;border-bottom:1px solid #000;padding:3px 0;text-align:left}
    td{padding:3px 0;border-bottom:1px dotted #bbb;text-align:left;font-size:11px;vertical-align:top}
    th:nth-child(2),td:nth-child(2){text-align:center}
    th:last-child,td:last-child,th:nth-child(3),td:nth-child(3),th:nth-child(4),td:nth-child(4){text-align:right}
    .totals{margin-top:6px;font-size:11.5px}
    .totals div{display:flex;justify-content:space-between;padding:1.5px 0}
    .grand{font-size:16px;font-weight:800;border-top:2px solid #000;border-bottom:2px solid #000;padding:4px 0;margin:4px 0}
    .center{text-align:center}
    .footer-note{margin-top:10px;font-size:10.5px}
    .thanks{font-weight:700;font-size:12.5px;margin-top:4px}
  </style></head><body>
    <p class="shop-name">${shopName}</p>
    ${contactLine ? `<p class="contact">${contactLine}</p>` : ''}
    <div class="rule solid"></div>
    <div class="meta"><span>Invoice: <strong>${escapeHtml(sale.invoice_number)}</strong></span><span>${dateStr}</span></div>
    <div class="meta"><span>Customer: ${escapeHtml(sale.customer_name || 'Walk-in Customer')}</span><span></span></div>
    <div class="rule"></div>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Disc</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals">
      <div class="grand"><span>TOTAL</span><span>${formatMoney(sale.total_amount)}</span></div>
      <div><span>Paid</span><span>${formatMoney(sale.paid_amount)}</span></div>
      ${sale.remaining_amount > 0 ? `<div><span>Balance Due</span><span>${formatMoney(sale.remaining_amount)}</span></div>` : ''}
    </div>
    <div class="rule"></div>
    <div class="center footer-note">${footer}<div class="thanks center">Shukriya!</div></div>
  </body></html>`;
}

async function loadSettings() {
  try {
    const r = await apiRequest('/api/settings');
    state.settings = r.settings;
    if (el.settingsForm) {
      for (const [key, val] of Object.entries(r.settings)) {
        if (el.settingsForm.elements[key]) el.settingsForm.elements[key].value = val || '';
      }
    }
    await refreshPrinterList();
  } catch (e) { /* settings are optional on first boot */ }
}

async function refreshPrinterList() {
  const select = document.getElementById('printerSelect');
  const hint = document.getElementById('printerHint');
  if (!select) return;
  if (!window.electronAPI?.isDesktop) {
    if (hint) hint.textContent = 'Printer list sirf desktop app (Electron) mein milti hai, browser mein nahi.';
    return;
  }
  try {
    const printers = await window.electronAPI.getPrinters();
    const current = state.settings?.printer_name || '';
    select.innerHTML = '<option value="">System default printer</option>' + printers.map(p => `<option value="${escapeHtml(p.name)}" ${p.name === current ? 'selected' : ''}>${escapeHtml(p.name)}${p.isDefault ? ' (Windows default)' : ''}</option>`).join('');
    if (hint) hint.textContent = printers.length ? '' : 'Koi printer install nahi mila. Windows mein pehle printer install/connect karein.';
  } catch (e) { if (hint) hint.textContent = e.message; }
}

async function loadAuditLog() {
  const body = document.getElementById('auditLogTableBody');
  if (!body) return;
  try {
    const r = await apiRequest('/api/audit-logs');
    body.innerHTML = r.logs.map(l => `<tr><td>${escapeHtml(String(l.created_at))}</td><td>${escapeHtml(l.user_name)}</td><td>${escapeHtml(l.action)}</td><td>${escapeHtml(l.entity)}</td></tr>`).join('') || '<tr><td colspan="4">Koi activity record nahi hai</td></tr>';
  } catch (e) { body.innerHTML = `<tr><td colspan="4">${escapeHtml(e.message)}</td></tr>`; }
}
document.getElementById('refreshAuditBtn')?.addEventListener('click', loadAuditLog);

async function saveSettings(ev) {
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(el.settingsForm).entries());
  try {
    const r = await apiRequest('/api/settings', { method: 'PUT', body: JSON.stringify(data) });
    state.settings = r.settings;
    showMessage('Settings saved');
  } catch (e) { showMessage(e.message, 'error'); }
}

async function directPrintHtml(html) {
  if (window.electronAPI?.isDesktop) {
    try {
      const result = await window.electronAPI.directPrint({ html, printerName: state.settings?.printer_name || '' });
      showMessage(`Printed to ${result.printer}`);
      return true;
    } catch (error) {
      showMessage(`Printing failed: ${error.message}`, 'error');
      return false;
    }
  }
  // Browser fallback: use the current tab with a hidden iframe and invoke the
  // normal OS print dialog. No invoice preview/new browser window is opened.
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.className = 'print-frame';
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open(); doc.write(html); doc.close();
  await new Promise(resolve => {
    frame.onload = () => { setTimeout(() => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => { frame.remove(); resolve(); }, 1000); }, 80); };
  });
  return true;
}

async function printInvoice(id) {
  try {
    const sale = await apiRequest(`/api/sales/${id}`);
    const printable = sale.items.filter((item) => !item.no_receipt);
    const hiddenCount = sale.items.length - printable.length;
    if (!printable.length) return showMessage('Is bill ke saare items "No Receipt" hain, kuch print nahi kiya gaya', 'error');
    const rows = printable.map((item) => `<tr><td>${escapeHtml(item.product_name)}</td><td>${item.quantity}</td><td>${formatMoney(item.selling_price)}</td><td>${item.discount_percent ? `${item.discount_percent}%` : formatMoney(item.discount_amount)}</td><td>${formatMoney(item.subtotal - item.discount_amount)}</td></tr>`).join('');
    const printedTotal = printable.reduce((sum, item) => sum + (item.subtotal - item.discount_amount), 0);
    const receiptSale = hiddenCount ? { ...sale, total_amount: printedTotal, paid_amount: Math.min(sale.paid_amount, printedTotal), remaining_amount: Math.max(0, printedTotal - sale.paid_amount) } : sale;
    await directPrintHtml(buildReceiptHtml('ShopFlow Pro', receiptSale, rows));
    if (hiddenCount) showMessage(`${hiddenCount} item bill mein print nahi kiya gaya (No Receipt)`);
  } catch (error) { showMessage(error.message, 'error'); }
}

async function printPurchase(id) {
  try {
    const p = state.purchases.find(x => x.id === id);
    if (!p) return;
    const rows = `<tr><td colspan="4">Purchase Total</td><td>${formatMoney(p.total_amount)}</td></tr>`;
    const html = buildReceiptHtml(`Purchase ${p.invoice_number}`, {
      invoice_number: p.invoice_number,
      sale_date: p.date || '',
      created_at: p.date || '',
      customer_name: p.supplier_name || 'Supplier',
      total_amount: p.total_amount,
      paid_amount: p.paid_amount,
      remaining_amount: p.remaining_amount
    }, rows);
    await directPrintHtml(html);
  } catch (error) { showMessage(error.message, 'error'); }
}

function updatePosSummary() {
  const items = state.posItems;
  let total = 0;
  let totalCost = 0;
  let totalDiscount = 0;

  items.forEach((item) => {
    const subtotal = Number(item.quantity) * Number(item.price);
    const discount = Math.min(subtotal, Number(item.discount || (subtotal * Number(item.discount_percent || 0) / 100)));
    const cost = Number(item.quantity) * Number(item.conversion_factor || 1) * Number(item.cost || item.price);
    total += subtotal - discount;
    totalCost += cost;
    totalDiscount += discount;
  });

  const grossProfit = total - totalCost;
  const margin = total > 0 ? (grossProfit / total) * 100 : 0;

  el.totalSaleValue.textContent = formatMoney(total);
  el.totalCostValue.textContent = formatMoney(totalCost);
  el.grossProfitValue.textContent = formatMoney(grossProfit);
  el.profitMarginValue.textContent = `${margin.toFixed(2)}%`;
}

function renderPosItems() {
  el.posItemsBody.innerHTML = state.posItems.map((item, index) => {
    const subtotal = Number(item.quantity) * Number(item.price);
    const discount = Math.min(subtotal, Number(item.discount || (subtotal * Number(item.discount_percent || 0) / 100)));
    const lineTotal = subtotal - discount;
    return `
      <tr>
        <td>${item.name}</td>
        <td><input data-pos-qty="${index}" type="number" value="${Number(item.quantity).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}" min="0.001" step="0.001" /></td>
        <td><select data-pos-unit="${index}"><option value="1" ${item.conversion_factor === 1 ? 'selected' : ''}>Base</option><option value="${item.pack_factor}" ${item.conversion_factor === item.pack_factor && item.pack_factor !== 1 ? 'selected' : ''}>1 ${item.stock_unit} (${item.pack_factor})</option></select></td>
        <td><input data-pos-price="${index}" type="number" step="0.01" value="${item.price}" /></td>
        <td class="mono">${formatMoney(item.cost)}</td>
        <td class="profit-cell">${formatMoney(lineTotal - Number(item.quantity) * Number(item.conversion_factor || 1) * Number(item.cost || 0))}</td>
        <td><input data-pos-discount-percent="${index}" type="number" step="0.01" min="0" max="100" value="${item.discount_percent || 0}" placeholder="%" /></td>
        <td><input data-pos-discount="${index}" type="number" step="0.01" min="0" value="${item.discount || 0}" placeholder="Rs" /></td>
        <td><label class="pos-no-receipt" title="Sale mein shamil hoga, magar bill/receipt par print nahi hoga"><input type="checkbox" data-pos-no-receipt="${index}" ${item.no_receipt ? 'checked' : ''}/> No Receipt</label></td>
        <td>${formatMoney(lineTotal)}</td>
        <td><button class="small-btn" data-remove-pos-item="${index}">Remove</button></td>
      </tr>
    `;
  }).join('');

  el.posItemsBody.querySelectorAll('input[data-pos-no-receipt]').forEach((input) => {
    input.onchange = () => {
      const idx = Number(input.dataset.posNoReceipt);
      state.posItems[idx].no_receipt = input.checked;
    };
  });

  el.posItemsBody.querySelectorAll('input[data-pos-qty]').forEach((input) => {
    input.oninput = () => {
      const idx = Number(input.dataset.posQty);
      state.posItems[idx].quantity = Number(input.value || 0);
      updatePosSummary();
    };
  });

  el.posItemsBody.querySelectorAll('input[data-pos-price]').forEach((input) => {
    input.oninput = () => {
      const idx = Number(input.dataset.posPrice);
      state.posItems[idx].price = Number(input.value || 0);
      updatePosSummary();
    };
  });

  el.posItemsBody.querySelectorAll('select[data-pos-unit]').forEach((select) => {
    select.onchange = () => {
      const idx = Number(select.dataset.posUnit);
      state.posItems[idx].conversion_factor = Number(select.value || 1);
      renderPosItems();
    };
  });

  el.posItemsBody.querySelectorAll('input[data-pos-discount]').forEach((input) => {
    input.oninput = () => {
      const idx = Number(input.dataset.posDiscount);
      state.posItems[idx].discount = Number(input.value || 0);
      updatePosSummary();
    };
  });

  el.posItemsBody.querySelectorAll('input[data-pos-discount-percent]').forEach((input) => {
    input.oninput = () => {
      const idx = Number(input.dataset.posDiscountPercent);
      state.posItems[idx].discount_percent = Number(input.value || 0);
      state.posItems[idx].discount = 0;
      updatePosSummary();
    };
  });

  el.posItemsBody.querySelectorAll('[data-remove-pos-item]').forEach((btn) => {
    btn.onclick = () => {
      state.posItems.splice(Number(btn.dataset.removePosItem), 1);
      renderPosItems();
      updatePosSummary();
    };
  });

  updatePosSummary();
}

function updatePosArticles(){
  if(!el.posArticleSelect) return;
  const p=state.products.find(x=>x.id===el.productSelect.value); const articles=p?.articles||[];
  el.posArticleSelect.innerHTML='<option value="">Default / base item</option>'+articles.map(a=>`<option value="${a.id}">${escapeHtml(a.name)} — Stock ${Number(a.stock_qty||0).toFixed(3)} ${escapeHtml(a.package_type||'')} — ${formatMoney(a.retail_price)}/${escapeHtml(a.package_type||'unit')}</option>`).join('');
}
function updateStockArticles(){
  if(!el.stockArticleSelect) return;
  const p=state.products.find(x=>x.id===el.stockProductSelect.value); const articles=p?.articles||[];
  el.stockArticleSelect.innerHTML='<option value="">Default article</option>'+articles.map(a=>`<option value="${a.id}">${escapeHtml(a.name)} — ${Number(a.stock_qty||0).toFixed(3)}</option>`).join(''); if(articles[0]) el.stockArticleSelect.value=articles[0].id;
}
function addPosItem() {
  const productId = el.productSelect.value; const product = state.products.find((p) => p.id === productId); if (!product) return;
  const articleId=el.posArticleSelect?.value||null; const article=(product.articles||[]).find(a=>a.id===articleId);
  const requestedQty = Number(el.posQty.value || 1); const saleType = el.saleTypeSelect.value;
  const level = Number(el.wholesaleLevelSelect?.value || 0);
  function wholesalePriceFor(src) {
    if (level === 1 && Number(src.wholesale_level_1) > 0) return Number(src.wholesale_level_1);
    if (level === 2 && Number(src.wholesale_level_2) > 0) return Number(src.wholesale_level_2);
    if (level === 3 && Number(src.wholesale_level_3) > 0) return Number(src.wholesale_level_3);
    return Number(src.wholesale_price || src.retail_price);
  }
  const price = article ? Number(saleType==='wholesale' ? wholesalePriceFor(article) : article.retail_price) : Number(saleType === 'wholesale' ? wholesalePriceFor(product) : product.retail_price);
  const amount = Number(el.posAmount.value || 0); if(el.posSaleMode.value==='amount' && amount<=0)return showMessage('Enter a valid sale amount','error'); if(price<=0)return showMessage('Set a selling price first','error');
  const qty=el.posSaleMode.value==='amount'?amount/price:requestedQty; const factor=article?Number(article.base_per_unit||1):Number(product.unit_factor||1);
  const existing=state.posItems.find(i=>i.product_id===productId && (i.article_id||null)===(articleId||null));
  if(existing) existing.quantity+=qty; else state.posItems.push({product_id:product.id,article_id:articleId,name:article?article.name:product.name,quantity:qty,price,cost:Number(article?.purchase_price||product.purchase_price||0),discount:0,discount_percent:0,conversion_factor:factor,stock_unit:article?.package_type||product.stock_unit||product.unit||'pcs',pack_factor:factor});
  renderPosItems();
}

async function saveSale() {
  const payload = {
    sale_type: el.saleTypeSelect.value,
    customer_id: el.customerSelect.value,
    payment_method: el.paymentMethodSelect.value,
    paid_amount: Number(el.paidAmountInput.value || 0),
    items: state.posItems.map((item) => ({
      product_id: item.product_id,
      article_id: item.article_id || null,
      quantity: item.quantity,
      price: item.price,
      cost: item.cost,
      discount: item.discount || 0,
      discount_percent: item.discount_percent || 0,
      conversion_factor: item.conversion_factor || 1,
      no_receipt: !!item.no_receipt
    }))
  };

  try {
    const result = await apiRequest('/api/sales', { method: 'POST', body: JSON.stringify(payload) });
    showMessage(`Invoice saved: ${result.invoiceNumber}`);
    if (getAutoPrintEnabled()) await printInvoice(result.saleId);
    state.posItems = [];
    renderPosItems();
    loadDashboard();
    loadProducts();
    loadCustomers();
    loadReports();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

function getAutoPrintEnabled() {
  return localStorage.getItem('shopflow-auto-print') === 'true';
}

function updateAutoPrintToggle() {
  const button = document.getElementById('autoPrintToggle');
  if (!button) return;
  const enabled = getAutoPrintEnabled();
  button.textContent = `Auto Print: ${enabled ? 'On' : 'Off'}`;
  button.setAttribute('aria-pressed', String(enabled));
}

document.getElementById('autoPrintToggle')?.addEventListener('click', () => {
  const enabled = !getAutoPrintEnabled();
  localStorage.setItem('shopflow-auto-print', String(enabled));
  updateAutoPrintToggle();
  showMessage(`Automatic receipt printing ${enabled ? 'enabled' : 'disabled'}`);
});
updateAutoPrintToggle();

function renderPurchaseItems() {
  el.purchaseItemsBody.innerHTML = state.purchaseItems.map((item, index) => `
    <tr>
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>${item.conversion_factor}x</td>
      <td>${formatMoney(item.unit_cost)}</td>
      <td>${formatMoney(item.quantity * item.conversion_factor * item.unit_cost)}</td>
      <td><button class="small-btn" data-remove-purchase-item="${index}">Remove</button></td>
    </tr>
  `).join('');

  el.purchaseItemsBody.querySelectorAll('[data-remove-purchase-item]').forEach((btn) => {
    btn.onclick = () => {
      state.purchaseItems.splice(Number(btn.dataset.removePurchaseItem), 1);
      renderPurchaseItems();
    };
  });
}

function updatePurchaseArticles(){ if(!el.purchaseArticleSelect)return; const p=state.products.find(x=>x.id===el.purchaseProductSelect.value); const articles=p?.articles||[]; el.purchaseArticleSelect.innerHTML='<option value="">Default article</option>'+articles.map(a=>`<option value="${a.id}">${escapeHtml(a.name)} — ${Number(a.stock_qty||0).toFixed(3)}</option>`).join(''); if(articles[0]) el.purchaseArticleSelect.value=articles[0].id; }

function addPurchaseItem() {
  const productId = el.purchaseProductSelect.value;
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;

  state.purchaseItems.push({
    product_id: product.id,
    article_id: el.purchaseArticleSelect?.value || null,
    name: (product.articles||[]).find(a=>a.id===el.purchaseArticleSelect?.value)?.name || product.name,
    quantity: Number(el.purchaseQty.value || 1),
    unit_cost: Number(el.purchaseUnitCost.value || 0),
    conversion_factor: Number(el.purchaseConversionFactor.value || product.unit_factor || 1)
  });

  renderPurchaseItems();
}

async function savePurchase(event) {
  event.preventDefault();
  const supplierId = el.purchaseSupplierSelect.value;
  const supplier = state.suppliers.find((s) => s.id === supplierId) || {};
  const payload = {
    supplier_id: supplierId,
    supplier_name: supplier.name || 'Supplier',
    cash_paid: Number(event.target.querySelector('[name="cash_paid"]').value || 0),
    bank_paid: Number(event.target.querySelector('[name="bank_paid"]').value || 0),
    items: state.purchaseItems
  };

  try {
    await apiRequest('/api/purchases', { method: 'POST', body: JSON.stringify(payload) });
    showMessage('Purchase saved successfully');
    state.purchaseItems = [];
    event.target.reset();
    renderPurchaseItems();
    await Promise.all([loadPurchases(), loadDashboard(), loadProducts(), loadSuppliers(), loadBank()]);
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function login(event) {
  event.preventDefault();
  const submitButton = el.loginForm.querySelector('.login-submit');
  submitButton.classList.add('loading');
  submitButton.disabled = true;
  try {
    const result = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username: el.username.value, password: el.password.value, remember_me: document.getElementById('rememberMe').checked })
    });
    await startWorkspace(result.user);
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    submitButton.classList.remove('loading');
    submitButton.disabled = false;
  }
}

async function restoreSession() {
  try {
    const setupStatus = await apiRequest('/api/setup/status');
    if (setupStatus.setupRequired) {
      showInitialSetupForm();
      return;
    }
    showSignInForm();
    const result = await apiRequest('/api/session');
    if (!result.ok) return resetSessionView();
    await startWorkspace(result.user);
  } catch (error) {
    resetSessionView();
    showMessage(error.message, 'error');
  }
}

async function createInitialAdmin(event) {
  event.preventDefault();
  const submitButton = el.setupForm.querySelector('.login-submit');
  submitButton.classList.add('loading');
  submitButton.disabled = true;
  try {
    const result = await apiRequest('/api/setup', {
      method: 'POST',
      body: JSON.stringify({
        name: el.setupName.value,
        username: el.setupUsername.value,
        password: el.setupPassword.value
      })
    });
    showSignInForm();
    el.username.value = el.setupUsername.value.trim();
    el.password.value = '';
    el.setupForm.reset();
    showMessage(result.message);
    el.password.focus();
  } catch (error) {
    if (error.status === 409) showSignInForm();
    showMessage(error.message, 'error');
  } finally {
    submitButton.classList.remove('loading');
    submitButton.disabled = false;
  }
}

function initLoginParticles() {
  const canvas = document.getElementById('loginParticles');
  if (!canvas || loginParticlesRunning) return;
  if (loginParticlesResizeHandler) window.removeEventListener('resize', loginParticlesResizeHandler);
  loginParticlesCanvas = canvas;
  loginParticlesRunning = true;
  const context = canvas.getContext('2d');
  const particles = [];
  const resize = () => {
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
    context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  };
  const seed = () => {
    particles.length = 0;
    const count = Math.min(52, Math.max(24, Math.floor(canvas.clientWidth / 22)));
    for (let index = 0; index < count; index += 1) {
      particles.push({ x: Math.random() * canvas.clientWidth, y: Math.random() * canvas.clientHeight, vx: (Math.random() - .5) * .18, vy: (Math.random() - .5) * .18, size: Math.random() * 1.8 + .6 });
    }
  };
  const draw = () => {
    if (!loginParticlesRunning) return;
    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      if (particle.x < 0 || particle.x > canvas.clientWidth) particle.vx *= -1;
      if (particle.y < 0 || particle.y > canvas.clientHeight) particle.vy *= -1;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fillStyle = 'rgba(114,168,255,.55)';
      context.fill();
    });
    for (let first = 0; first < particles.length; first += 1) {
      for (let second = first + 1; second < particles.length; second += 1) {
        const dx = particles[first].x - particles[second].x;
        const dy = particles[first].y - particles[second].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 120) {
          context.beginPath();
          context.moveTo(particles[first].x, particles[first].y);
          context.lineTo(particles[second].x, particles[second].y);
          context.strokeStyle = `rgba(79,142,247,${(1 - distance / 120) * .18})`;
          context.stroke();
        }
      }
    }
    loginParticlesFrame = requestAnimationFrame(draw);
  };
  resize();
  seed();
  loginParticlesResizeHandler = () => { resize(); seed(); };
  window.addEventListener('resize', loginParticlesResizeHandler);
  draw();
}

function stopLoginParticles() {
  loginParticlesRunning = false;
  if (loginParticlesFrame !== null) cancelAnimationFrame(loginParticlesFrame);
  loginParticlesFrame = null;
  if (loginParticlesCanvas) {
    const context = loginParticlesCanvas.getContext('2d');
    context?.clearRect(0, 0, loginParticlesCanvas.clientWidth, loginParticlesCanvas.clientHeight);
  }
}


function downloadProductsCsv() {
  const headers = ['barcode','name','category','subcategory','brand','unit','base_unit','purchase_unit','sale_unit','purchase_factor','purchase_price','retail_price','wholesale_price','wholesale_level_1','wholesale_level_2','wholesale_level_3','min_stock','current_stock','expiry_date','batch_no','status'];
  const csv = [headers.join(','), ...state.products.map(p => headers.map(h => `"${String(p[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href=url; link.download=`products-${new Date().toISOString().slice(0,10)}.csv`; link.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line) {
  const out=[]; let cur='', quoted=false;
  for(let i=0;i<line.length;i++){ const c=line[i];
    if(c === '"'){ if(quoted && line[i+1] === '"'){cur+='"';i++;} else quoted=!quoted; }
    else if(c === ',' && !quoted){out.push(cur.trim());cur='';} else cur+=c;
  }
  out.push(cur.trim()); return out;
}

async function importProductsCsv(file) {
  if (!file) return;
  const text = await file.text();
  const lines = text.replace(/^\\uFEFF/, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return showMessage('CSV must contain a header and at least one product', 'error');
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/^"|"$/g,''));
  const products = lines.slice(1).map(line => {
    const values=parseCsvLine(line); return Object.fromEntries(headers.map((h,i)=>[h,values[i] ?? '']));
  });
  try {
    const result=await apiRequest('/api/products/bulk',{method:'POST',body:JSON.stringify({products})});
    await Promise.all([loadProducts(),loadDashboard()]);
    showMessage(`Import complete: ${result.created} added, ${result.updated} updated${result.errors?.length ? `, ${result.errors.length} skipped` : ''}`);
  } catch(error){ showMessage(error.message,'error'); }
}

async function saveProduct(event) {
  event.preventDefault();
  const form = new FormData(event.target); const payload = Object.fromEntries(form.entries());
  try {
    const editingId = state.editingProductId;
    const productBeforeSave = editingId ? state.products.find((item) => item.id === editingId) : null;
    const result = await apiRequest(editingId ? `/api/products/${editingId}` : '/api/products', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    const productId = editingId || result.product?.id;
    const rows=[...document.querySelectorAll('.article-builder-row')];
    if(productId){
      const existingArticles = productBeforeSave?.articles || [];
      const keepArticleIds = new Set();
      const articlePromises = [];
      let parentArticleId = null;
      let levelNo = 1;
      for(const row of rows){
        const name=row.querySelector('[data-a-name]')?.value?.trim();
        if(!name) continue;
        const articlePayload = {
          name,
          package_type:row.querySelector('[data-a-type]').value,
          package_size:Number(row.querySelector('[data-a-size]').value||1),
          base_per_unit:Number(row.querySelector('[data-a-size]').value||1),
          base_unit:payload.unit||'pcs',
          barcode:row.querySelector('[data-a-barcode]').value.trim(),
          purchase_price:Number(row.querySelector('[data-a-cost]').value||payload.purchase_price||0),
          retail_price:Number(row.querySelector('[data-a-retail]').value||payload.retail_price||0),
          wholesale_price:Number(row.querySelector('[data-a-wholesale]').value||payload.wholesale_price||0),
          wholesale_level_1:Number(row.querySelector('[data-a-wholesale1]')?.value||0),
          wholesale_level_2:Number(row.querySelector('[data-a-wholesale2]')?.value||0),
          wholesale_level_3:Number(row.querySelector('[data-a-wholesale3]')?.value||0),
          parent_article_id:parentArticleId,
          level_no:levelNo
        };
        const articleId = row.dataset.articleId || null;
        if (articleId) keepArticleIds.add(articleId);
        if (editingId && articleId) {
          articlePromises.push(apiRequest(`/api/products/${productId}/articles/${articleId}`, { method: 'PUT', body: JSON.stringify(articlePayload) }));
        } else {
          articlePromises.push(apiRequest(`/api/products/${productId}/articles`, { method: 'POST', body: JSON.stringify(articlePayload) }));
        }
        parentArticleId = editingId && articleId ? articleId : parentArticleId;
        levelNo++;
      }
      if (editingId) {
        for (const article of existingArticles) {
          if (!keepArticleIds.has(article.id)) {
            articlePromises.push(apiRequest(`/api/products/${productId}/articles/${article.id}`, { method: 'DELETE' }));
          }
        }
      }
      if (articlePromises.length) await Promise.all(articlePromises);
    }
    closeProductModal(); await loadProducts(); showMessage(editingId ? 'Product updated' : 'Product and packaging saved');
  } catch (error) { showMessage(error.message, 'error'); }
}

async function saveCustomer(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = Object.fromEntries(form.entries());
  try {
    await apiRequest('/api/customers', { method: 'POST', body: JSON.stringify(payload) });
    event.target.reset();
    showMessage('Customer saved');
    loadCustomers();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function editCustomer(id) {
  const customer = state.customers.find((item) => item.id === id);
  if (!customer) return;
  const name = await uiPrompt('Customer name', customer.name);
  if (name === null) return;
  const phone = await uiPrompt('Phone', customer.phone || '');
  if (phone === null) return;
  try { await apiRequest(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify({ name, phone, address: customer.address, type: customer.type, credit_limit: customer.credit_limit }) }); await loadCustomers(); showMessage('Customer updated'); } catch (error) { showMessage(error.message, 'error'); }
}

async function deleteCustomer(id) {
  if (!window.confirm('Delete this customer?')) return;
  try { await apiRequest(`/api/customers/${id}`, { method: 'DELETE' }); await loadCustomers(); showMessage('Customer deleted'); } catch (error) { showMessage(error.message, 'error'); }
}

async function saveSupplier(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = Object.fromEntries(form.entries());
  try {
    await apiRequest('/api/suppliers', { method: 'POST', body: JSON.stringify(payload) });
    event.target.reset();
    showMessage('Supplier saved');
    loadSuppliers();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function editSupplier(id) {
  const supplier = state.suppliers.find((item) => item.id === id);
  if (!supplier) return;
  const name = await uiPrompt('Supplier name', supplier.name);
  if (name === null) return;
  const phone = await uiPrompt('Phone', supplier.phone || '');
  if (phone === null) return;
  try { await apiRequest(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify({ name, phone, address: supplier.address }) }); await loadSuppliers(); showMessage('Supplier updated'); } catch (error) { showMessage(error.message, 'error'); }
}

async function deleteSupplier(id) {
  if (!window.confirm('Delete this supplier?')) return;
  try { await apiRequest(`/api/suppliers/${id}`, { method: 'DELETE' }); await loadSuppliers(); showMessage('Supplier deleted'); } catch (error) { showMessage(error.message, 'error'); }
}

async function savePartner(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = Object.fromEntries(form.entries());
  try {
    await apiRequest('/api/partners', { method: 'POST', body: JSON.stringify(payload) });
    event.target.reset();
    const defaults = [12.5, 12.5, 37.5, 37.5];
    event.target.elements.ownership_pct.value = defaults[state.partners.length] ?? 0;
    await Promise.all([loadPartners(), loadDashboard(), loadBank()]);
    showMessage('Partner saved; initial capital is in the partner activity ledger');
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function savePartnerActivity(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const result = await apiRequest('/api/partner-transactions', { method: 'POST', body: JSON.stringify({ ...payload, amount: Number(payload.amount) }) });
    form.reset();
    await Promise.all([loadPartners(), loadPartnerSummary(payload.partner_id), loadDashboard(), loadBank()]);
    showMessage('Partner activity saved');
  } catch (error) { showMessage(error.message, 'error'); }
}

async function editPartner(id) {
  const partner = state.partners.find((item) => item.id === id);
  if (!partner) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<form class="modal-card" style="width:min(620px,94vw)">
    <h3>Edit partner</h3>
    <div class="form-grid">
      <div><label>Name</label><input name="name" required /></div>
      <div><label>Ownership %</label><input name="ownership_pct" type="number" min="0" max="100" step="0.01" required /></div>
      <div><label>Capital amount</label><input name="capital" type="number" min="0" step="0.01" required /></div>
      <div><label>Source for capital change</label><select name="payment_method"><option>Cash</option><option>Bank</option></select></div>
      <div><label>Adjustment date</label><input name="date" type="date" required /></div>
    </div>
    <p class="muted-copy">Changing capital records the difference in the partner ledger and updates Cash/Bank when applicable. Previous activity is kept.</p>
    <div class="modal-footer"><button type="button" class="ghost-btn" data-act="cancel">Cancel</button><button type="submit" class="primary-btn">Save Changes</button></div>
  </form>`;
  const form = overlay.querySelector('form');
  form.elements.name.value = partner.name;
  form.elements.ownership_pct.value = Number(partner.ownership_pct);
  form.elements.capital.value = Number(partner.capital);
  form.elements.date.value = new Date().toISOString().slice(0, 10);
  overlay.addEventListener('click', (event) => {
    if (event.target.dataset.act === 'cancel' || event.target === overlay) overlay.remove();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await apiRequest(`/api/partners/${id}`, { method: 'PUT', body: JSON.stringify({
        ...payload,
        capital: Number(payload.capital),
        ownership_pct: Number(payload.ownership_pct)
      }) });
      overlay.remove();
      await Promise.all([loadPartners(), loadBank(), loadDashboard()]);
      showMessage('Partner and capital updated; capital correction is recorded in the ledger.');
    } catch (error) { showMessage(error.message, 'error'); }
  });
  document.body.appendChild(overlay);
  form.elements.name.focus();
}

async function deletePartner(id) {
  if (!window.confirm('Delete only if this partner has no ledger history or balance? Existing partner activity must be preserved.')) return;
  try { await apiRequest(`/api/partners/${id}`, { method: 'DELETE' }); await loadPartners(); showMessage('Partner deleted'); } catch (error) { showMessage(error.message, 'error'); }
}

async function saveExpense(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = Object.fromEntries(form.entries());
  try {
    await apiRequest('/api/expenses', { method: 'POST', body: JSON.stringify(payload) });
    event.target.reset();
    showMessage('Expense saved');
    loadExpenses();
    loadDashboard();
    loadReports();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

el.loginForm.addEventListener('submit', login);
el.setupForm.addEventListener('submit', createInitialAdmin);


const importStockInput = document.getElementById('importStockInput');
const importStockBtn = document.getElementById('importStockBtn');
const downloadStockTemplateBtn = document.getElementById('downloadStockTemplateBtn');
function parseCsvText(text){
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<text.length;i++){ const ch=text[i], nx=text[i+1]; if(ch==='"'){ if(quoted&&nx==='"'){cell+='"';i++;} else quoted=!quoted; } else if(ch===','&&!quoted){row.push(cell);cell='';} else if((ch==='\n'||ch==='\r')&&!quoted){ if(ch==='\r'&&nx==='\n') i++; row.push(cell);cell=''; if(row.some(v=>String(v).trim()!=='')) rows.push(row); row=[]; } else cell+=ch; }
  if(cell!==''||row.length){row.push(cell);rows.push(row);} return rows;
}
function csvToObjects(text){ const rows=parseCsvText(text); if(!rows.length)return []; const headers=rows.shift().map(h=>String(h).trim().toLowerCase().replace(/\s+/g,'_')); return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,String(r[i]??'').trim()]))); }
function downloadStockTemplate(){ const headers=['barcode','product_id','article_id','quantity','unit_cost','conversion_factor','unit','expiry_date','supplier_id','reference','entry_date','update_rate']; const sample=['','', '', '10','0','1','pcs','','','','', '1']; const csv=headers.join(',')+'\n'+sample.join(',')+'\n'; const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='opening-stock-template.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); }
async function importOpeningStockCsv(file){ if(!file)return; try{ const text=await file.text(); const rows=csvToObjects(text); const result=await apiRequest('/api/stock/bulk',{method:'POST',body:JSON.stringify({rows})}); await Promise.all([loadProducts(),loadStock(),loadDashboard()]); showMessage(`Opening stock imported: ${result.imported}, skipped: ${result.skipped}` + (result.errors?.length ? ` (${result.errors.length} errors)` : '')); if(result.errors?.length) console.warn('Bulk stock errors',result.errors); }catch(e){showMessage(e.message,'error');} }
if(importStockBtn&&importStockInput){ importStockBtn.onclick=()=>importStockInput.click(); importStockInput.onchange=()=>{importOpeningStockCsv(importStockInput.files[0]);importStockInput.value='';}; }
if(downloadStockTemplateBtn) downloadStockTemplateBtn.onclick=downloadStockTemplate;

const importPackagingInput=document.getElementById('importPackagingInput');
const importPackagingBtn=document.getElementById('importPackagingBtn');
function downloadPackagingTemplate(){ const headers=['product_barcode','article_barcode','article_name','package_type','base_unit','base_per_unit','purchase_price','retail_price','wholesale_price','min_stock','level_no','parent_article_barcode','expiry_date','batch_no']; const csv=headers.join(',')+'\n,123456,Aata 50 KG Bag,Bag,kg,50,5000,5500,5400,1,1,,,'+'\n'; const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='packaging-template.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500); }
async function importPackagingCsv(file){ if(!file)return; try{const text=await file.text();const rows=csvToObjects(text);const result=await apiRequest('/api/articles/bulk',{method:'POST',body:JSON.stringify({rows})});await Promise.all([loadProducts(),loadDashboard()]);showMessage(`Packaging import: ${result.created} added, ${result.updated} updated, ${result.skipped} skipped`);if(result.errors?.length)console.warn('Packaging import errors',result.errors);}catch(e){showMessage(e.message,'error');}}
if(importPackagingBtn&&importPackagingInput){importPackagingBtn.onclick=()=>importPackagingInput.click();importPackagingInput.onchange=()=>{importPackagingCsv(importPackagingInput.files[0]);importPackagingInput.value='';};}

const importProductsInput = document.getElementById('importProductsInput');
const importProductsBtn = document.getElementById('importProductsBtn');
const exportProductsBtn = document.getElementById('exportProductsBtn');
if (importProductsBtn && importProductsInput) {
  importProductsBtn.addEventListener('click', () => importProductsInput.click());
  importProductsInput.addEventListener('change', () => { importProductsCsv(importProductsInput.files[0]); importProductsInput.value=''; });
}
if (exportProductsBtn) exportProductsBtn.addEventListener('click', downloadProductsCsv);

el.sidebarToggle.addEventListener('click', () => {
  el.sidebar.classList.toggle('collapsed');
});

el.backButton.addEventListener('click', () => setSection('dashboard'));

el.themeToggle.addEventListener('click', () => {
  const current = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(current);
});

el.globalSearch.addEventListener('input', handleGlobalSearch);
el.customerSearch.addEventListener('input', loadCustomers);
el.supplierSearch.addEventListener('input', loadSuppliers);
el.posProductSearch.addEventListener('input', () => filterProductSelect(el.posProductSearch, el.productSelect));
el.posCategoryFilter.addEventListener('change', () => filterProductSelect(el.posProductSearch, el.productSelect));
el.purchaseProductSearch.addEventListener('input', () => filterProductSelect(el.purchaseProductSearch, el.purchaseProductSelect));
if (el.purchaseProductSelect) el.purchaseProductSelect.addEventListener('change', updatePurchaseArticles);

document.querySelectorAll('.nav-btn[data-section]').forEach((button) => {
  button.addEventListener('click', () => setSection(button.dataset.section));
});

el.productForm.addEventListener('submit', saveProduct);

document.getElementById('productImageInput')?.addEventListener('change', (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  if (file.size > 1.5 * 1024 * 1024) { showMessage('Photo 1.5 MB se chhoti honi chahiye', 'error'); ev.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('productImageHidden').value = reader.result;
    const preview = document.getElementById('productImagePreview');
    preview.src = reader.result;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});
document.getElementById('removeProductImageBtn')?.addEventListener('click', () => {
  document.getElementById('productImageHidden').value = '';
  document.getElementById('productImageInput').value = '';
  const preview = document.getElementById('productImagePreview');
  preview.src = ''; preview.classList.add('hidden');
});

function openProductModal(isEdit) {
  document.getElementById('productModalTitle').textContent = isEdit ? 'Edit Product' : 'Add Product';
  document.getElementById('productModal').classList.remove('hidden');
}
function resetProductImagePreview() {
  const preview = document.getElementById('productImagePreview');
  if (preview) { preview.src = ''; preview.classList.add('hidden'); }
  const fileInput = document.getElementById('productImageInput');
  if (fileInput) fileInput.value = '';
}
function closeProductModal() {
  document.getElementById('productModal').classList.add('hidden');
  el.productForm.reset();
  state.editingProductId = null;
  if (el.articleBuilderList) el.articleBuilderList.innerHTML = '';
  resetProductImagePreview();
}
document.querySelector('.openAddProductBtn')?.addEventListener('click', () => {
  el.productForm.reset();
  state.editingProductId = null;
  if (el.articleBuilderList) el.articleBuilderList.innerHTML = '';
  resetProductImagePreview();
  openProductModal(false);
});
document.getElementById('closeProductModalBtn')?.addEventListener('click', closeProductModal);
document.getElementById('cancelProductModalBtn')?.addEventListener('click', closeProductModal);
document.getElementById('productModal')?.addEventListener('click', (ev) => { if (ev.target.id === 'productModal') closeProductModal(); });
el.customerForm.addEventListener('submit', saveCustomer);
el.supplierForm.addEventListener('submit', saveSupplier);
el.partnerForm.addEventListener('submit', savePartner);
el.partnerActivityForm?.addEventListener('submit', savePartnerActivity);
el.expenseForm.addEventListener('submit', saveExpense);
el.purchaseForm.addEventListener('submit', savePurchase);
el.stockForm.addEventListener('submit', saveStock);
el.stockAdjustmentForm?.addEventListener('submit', saveStockAdjustment);
el.userForm.addEventListener('submit', saveUser);
el.settingsForm.addEventListener('submit', saveSettings);
document.getElementById('testPrintBtn')?.addEventListener('click', async () => {
  const sampleRows = '<tr><td>Test Item</td><td>1</td><td>10</td><td>0</td><td>10</td></tr>';
  await directPrintHtml(buildReceiptHtml('Test', { invoice_number: 'TEST-0001', total_amount: 10, paid_amount: 10, remaining_amount: 0, customer_name: 'Test Print' }, sampleRows));
});
el.reportDate.addEventListener('change', loadReports);
el.reportSearch.addEventListener('input', loadReports);
el.reportRange.addEventListener('change', () => {
  if (el.reportRange.value !== 'custom') el.reportDate.value = '';
  loadReports();
});
el.clearReportDate.addEventListener('click', () => { el.reportDate.value = ''; el.reportRange.value = 'all'; loadReports(); });
el.accountsDate.addEventListener('change', loadAccounts);
if (el.dailyReportDate) el.dailyReportDate.value = new Date().toISOString().slice(0, 10);
el.dailyReportBtn?.addEventListener('click', dailyBusinessReport);

el.addPosItemBtn = document.getElementById('addPosItemBtn');
el.saveSaleBtn = document.getElementById('saveSaleBtn');
el.addPurchaseItemBtn = document.getElementById('addPurchaseItemBtn');

el.addPosItemBtn.addEventListener('click', addPosItem);
el.saveSaleBtn.addEventListener('click', saveSale);
el.addPurchaseItemBtn.addEventListener('click', addPurchaseItem);

el.stockProductSelect.addEventListener('change', () => {
  const product = state.products.find((item) => item.id === el.stockProductSelect.value);
  if (!product) return;
  const unitInput = el.stockForm.elements.unit;
  const factorInput = el.stockForm.elements.conversion_factor;
  if (unitInput) unitInput.value = product.stock_unit || product.unit || 'pcs';
  if (factorInput) factorInput.value = product.unit_factor || 1;
  updateStockCalculation();
});
el.adjustmentProductSelect?.addEventListener('change', updateAdjustmentArticles);
if (el.stockArticleSelect) el.stockArticleSelect.addEventListener('change', ()=>{const p=state.products.find(x=>x.id===el.stockProductSelect.value);const a=(p?.articles||[]).find(x=>x.id===el.stockArticleSelect.value);if(a){el.stockForm.elements.unit.value=a.package_type||p.stock_unit||p.unit||'pcs';el.stockForm.elements.conversion_factor.value=a.base_per_unit||1;el.stockForm.elements.unit_cost.value=a.purchase_price||p.purchase_price||0;}updateStockCalculation();});
el.stockForm.elements.quantity.addEventListener('input', updateStockCalculation);
el.stockForm.elements.unit.addEventListener('change', updateStockCalculation);
el.stockForm.elements.conversion_factor.addEventListener('input', updateStockCalculation);
function wholesalePriceForLevel(src, level) {
  if (level === 1 && Number(src.wholesale_level_1) > 0) return Number(src.wholesale_level_1);
  if (level === 2 && Number(src.wholesale_level_2) > 0) return Number(src.wholesale_level_2);
  if (level === 3 && Number(src.wholesale_level_3) > 0) return Number(src.wholesale_level_3);
  return Number(src.wholesale_price || src.retail_price);
}

function reapplyPosPricing() {
  const saleType = el.saleTypeSelect.value;
  const level = Number(el.wholesaleLevelSelect?.value || 0);
  state.posItems = state.posItems.map((item) => {
    const product = state.products.find((p) => p.id === item.product_id);
    if (!product) return item;
    const article = (product.articles || []).find((a) => a.id === item.article_id);
    const src = article || product;
    const price = saleType === 'wholesale' ? wholesalePriceForLevel(src, level) : Number(src.retail_price);
    return { ...item, price };
  });
  renderPosItems();
}

el.saleTypeSelect.addEventListener('change', () => {
  if (el.wholesaleLevelWrap) el.wholesaleLevelWrap.classList.toggle('hidden', el.saleTypeSelect.value !== 'wholesale');
  reapplyPosPricing();
});
el.wholesaleLevelSelect?.addEventListener('change', reapplyPosPricing);

el.paidAmountInput.addEventListener('input', updatePosSummary);
el.posSaleMode.addEventListener('change', () => {
  el.posQty.classList.toggle('hidden', el.posSaleMode.value === 'amount');
  el.posAmount.classList.toggle('hidden', el.posSaleMode.value !== 'amount');
});
el.posAmount.classList.add('hidden');

if (el.backupBtn) el.backupBtn.onclick=()=>{window.location.href='/api/backup';};
if (el.partnerDistributionBtn) el.partnerDistributionBtn.onclick=distributeProfit;
if (el.partnerRepaymentBtn) el.partnerRepaymentBtn.onclick=repayPartnerAdvance;
if (el.comprehensiveReportBtn) el.comprehensiveReportBtn.onclick = () => comprehensiveReport('view');
document.getElementById('savePdfReportBtn')?.addEventListener('click', () => comprehensiveReport('pdf'));
document.getElementById('exportProductsPdfBtn')?.addEventListener('click', exportProductsPdf);
document.getElementById('exportStockPdfBtn')?.addEventListener('click', exportStockPdf);
document.getElementById('exportProductsExcelBtn')?.addEventListener('click', () => { window.location.href = '/api/products/export-excel'; });
document.getElementById('exportStockExcelBtn')?.addEventListener('click', () => { window.location.href = '/api/stock/export-excel'; });
document.getElementById('exportReportExcelBtn')?.addEventListener('click', () => {
  const { from, to } = currentReportDateRange();
  window.location.href = `/api/reports/export-excel?from=${from}&to=${to}`;
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { await apiRequest('/api/logout', { method: 'POST' }); } catch (error) { /* local reset still clears the workspace */ }
  resetSessionView();
});

document.addEventListener('keydown', (event) => {
  const target = event.target;
  const typing = target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  if (!typing && event.key === 'F2') {
    event.preventDefault();
    setSection('pos');
    el.posProductSearch.focus();
  }
  if (!typing && event.ctrlKey && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    el.globalSearch.focus();
  }
  if (!typing && event.key === 'F4') {
    event.preventDefault();
    setSection('pos');
    el.customerSelect.focus();
  }
  if (!typing && event.key === 'F8') {
    event.preventDefault();
    el.paidAmountInput.focus();
  }
  if (event.ctrlKey && event.key === 'Enter' && state.currentSection === 'pos') {
    event.preventDefault();
    saveSale();
  }
  if (event.key === 'Escape') {
    el.invoiceDetail.classList.add('hidden');
    el.customerProfile.classList.add('hidden');
  }
});

setSection('dashboard');
applyTheme();
initLoginParticles();
restoreSession();


function refreshConversionOptions(){const p=state.products.find(x=>x.id===el.stockProductSelect?.value);const a=p?.articles||[];if(!el.conversionFrom||!el.conversionTo)return;const opts=a.map(x=>`<option value="${x.id}">${escapeHtml(x.name)} — ${Number(x.stock_qty||0).toFixed(3)}</option>`).join('');el.conversionFrom.innerHTML=opts;el.conversionTo.innerHTML=opts;if(a[1])el.conversionTo.value=a[1].id;}

// Premium live controls and article-aware UI
if (el.productSelect) el.productSelect.addEventListener('change', updatePosArticles);
if (el.stockProductSelect) el.stockProductSelect.addEventListener('change', ()=>{updateStockArticles();refreshConversionOptions();});
if (el.customerSelect) el.customerSelect.addEventListener('change', ()=>{const c=state.customers.find(x=>x.id===el.customerSelect.value); if(el.customerDuePreview) el.customerDuePreview.textContent=c?`Current due: ${formatMoney(c.remaining_balance)} | Limit: ${c.credit_limit?formatMoney(c.credit_limit):'No limit'}`:'Walk-in / No credit';});
if (el.posBarcode) el.posBarcode.addEventListener('keydown', e=>{if(e.key==='Enter'){e.preventDefault();const code=el.posBarcode.value.trim();const p=state.products.find(x=>String(x.barcode||'')===code)||state.products.find(x=>(x.articles||[]).some(a=>String(a.barcode||'')===code));if(!p)return showMessage('Barcode not found','error');el.productSelect.value=p.id;updatePosArticles();const a=(p.articles||[]).find(x=>String(x.barcode||'')===code);if(a&&el.posArticleSelect)el.posArticleSelect.value=a.id;addPosItem();el.posBarcode.value='';el.posBarcode.focus();}});

if (el.stockBarcode) el.stockBarcode.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const code = el.stockBarcode.value.trim();
  const p = state.products.find(x => String(x.barcode || '') === code) || state.products.find(x => (x.articles || []).some(a => String(a.barcode || '') === code));
  if (!p) { showMessage('Barcode not found', 'error'); return; }
  el.stockProductSelect.value = p.id;
  el.stockProductSelect.dispatchEvent(new Event('change'));
  const a = (p.articles || []).find(x => String(x.barcode || '') === code);
  if (a && el.stockArticleSelect) { el.stockArticleSelect.value = a.id; el.stockArticleSelect.dispatchEvent(new Event('change')); }
  el.stockBarcode.value = '';
  showMessage(`${p.name}${a ? ' — ' + a.name : ''} select ho gaya, ab quantity daal dein`);
  el.stockForm.elements.quantity.focus();
  el.stockForm.elements.quantity.select();
});
if (el.saveConversion) el.saveConversion.onclick=async()=>{try{await apiRequest('/api/stock/conversion',{method:'POST',body:JSON.stringify({from_article_id:el.conversionFrom.value,to_article_id:el.conversionTo.value,from_qty:Number(el.conversionQty.value||0),type:'BREAK'})});await loadProducts();refreshConversionOptions();showMessage('Stock converted successfully');}catch(e){showMessage(e.message,'error');}};
if (el.addArticleBtn) el.addArticleBtn.addEventListener('click', ()=>{
  if(!el.articleBuilderList)return;
  const level=el.articleBuilderList.querySelectorAll('.article-builder-row').length+1;
  const row=document.createElement('div'); row.className='article-builder-row';
  row.innerHTML=`<span class="package-level">L${level}</span><input data-a-name placeholder="Article e.g. Blade Card / Dabba / Piece"><select data-a-type><option>Carton</option><option>Card</option><option>Bag</option><option>Box</option><option>Dabba</option><option>Loose</option><option>Pack</option><option>Piece</option><option>Bottle</option><option>Pouch</option><option>Lari</option></select><input data-a-size type="number" min="0.001" step="0.001" value="1" placeholder="Base units"><input data-a-cost type="number" min="0" step="0.01" placeholder="Cost"><input data-a-retail type="number" min="0" step="0.01" placeholder="Retail"><input data-a-wholesale type="number" min="0" step="0.01" placeholder="Wholesale"><input data-a-wholesale1 type="number" min="0" step="0.01" placeholder="Wholesale L1" title="Wholesale Level 1 price (khali chhoren to upar wali Wholesale rate chalegi)"><input data-a-wholesale2 type="number" min="0" step="0.01" placeholder="Wholesale L2" title="Wholesale Level 2 price"><input data-a-wholesale3 type="number" min="0" step="0.01" placeholder="Wholesale L3" title="Wholesale Level 3 price"><input data-a-barcode placeholder="Barcode"><button type="button" class="small-btn danger-btn">Remove</button>`;
  row.querySelector('button').onclick=()=>{row.remove();[...el.articleBuilderList.querySelectorAll('.article-builder-row')].forEach((r,i)=>{const badge=r.querySelector('.package-level');if(badge)badge.textContent='L'+(i+1);});};
  el.articleBuilderList.appendChild(row);
});

setInterval(()=>{if(state.currentUser){loadDashboard().catch(()=>{});}},5000);

/* ===== Barcode labels (Code128-B, works offline) ===== */
const C128=['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'];
function code128Svg(text,h=44){
  const codes=[104];
  for(const ch of String(text)){const c=ch.charCodeAt(0)-32;codes.push(c>=0&&c<=95?c:0);}
  let sum=codes[0];for(let i=1;i<codes.length;i++)sum+=codes[i]*i;
  codes.push(sum%103,106);
  let x=10,bars='';
  for(const c of codes){const p=C128[c];for(let i=0;i<p.length;i++){const w=+p[i];if(i%2===0)bars+=`<rect x="${x}" y="0" width="${w}" height="${h}"/>`;x+=w;}}
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x+10} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px">${bars}</svg>`;
}
async function generateMissingBarcodes(){
  try{const r=await apiRequest('/api/barcodes/generate-missing',{method:'POST'});await loadProducts();showMessage(r.generated?`${r.generated} article(s) ko barcode mil gaya`:'Sab articles ke barcode pehle se maujood hain');}
  catch(e){showMessage(e.message,'error');}
}
function printBarcodeLabels(){
  const items=[];
  for(const p of state.products){for(const a of (p.articles||[])){if(!a.barcode)continue;items.push({name:p.name,art:a.name,code:a.barcode,price:a.retail_price});}}
  if(!items.length)return showMessage('Koi barcode nahi mila. Pehle "Generate Missing Barcodes" dabayein.','error');
  const labels=items.map(i=>`<div class="l"><div class="n">${escapeHtml(i.name)}</div><div class="a">${escapeHtml(i.art)}</div>${code128Svg(i.code)}<div class="c">${escapeHtml(i.code)}</div><div class="p">Rs ${Number(i.price||0).toLocaleString()}</div></div>`).join('');
  const w=window.open('','_blank');
  if(!w)return showMessage('Popup block ho gaya, allow karein','error');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Barcode Labels</title><style>
  body{margin:8px;font-family:Arial,sans-serif;color:#000;background:#fff}
  .g{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
  .l{border:1px dashed #999;padding:6px;text-align:center;break-inside:avoid;background:#fff;color:#000}
  .n{font-weight:700;font-size:12px}.a{font-size:11px}.c{font-size:11px;letter-spacing:1px}.p{font-weight:700;font-size:13px}
  @media print{.g{gap:2px}}</style></head><body><div class="g">${labels}</div><script>setTimeout(()=>window.print(),400)<\/script></body></html>`);
  w.document.close();
}
document.getElementById('genBarcodesBtn')?.addEventListener('click',generateMissingBarcodes);
document.getElementById('printLabelsBtn')?.addEventListener('click',printBarcodeLabels);


// ===== Cash in Bank =====
async function loadBank() {
  try {
    const data = await apiRequest('/api/bank');
    const sel = document.getElementById('bankAccountSelect');
    const prev = sel.value;
    sel.innerHTML = data.accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    if (prev) sel.value = prev;
    document.getElementById('bankTotals').innerHTML =
      `<div class="total-row profit"><span>Total Cash in Bank</span><strong>${formatMoney(data.total)}</strong></div>` +
      data.accounts.map(a => `<div class="total-row"><span>${escapeHtml(a.name)}${a.account_no ? ' (' + escapeHtml(a.account_no) + ')' : ''}</span><strong>${formatMoney(a.balance)}</strong></div>`).join('');
    document.getElementById('bankTxnBody').innerHTML = data.transactions.length
      ? data.transactions.map(t => `<tr>
          <td>${escapeHtml(t.txn_date || '')}</td>
          <td>${escapeHtml(t.account_name)}</td>
          <td>${escapeHtml(t.notes || t.reference || t.kind)}</td>
          <td>${t.direction === 'in' ? formatMoney(t.amount) : ''}</td>
          <td>${t.direction === 'out' ? formatMoney(t.amount) : ''}</td>
          <td>${['deposit', 'withdraw'].includes(t.kind) ? `<button class="danger-btn" data-bank-del="${t.id}">Delete</button>` : '<span class="table-sub">auto</span>'}</td>
        </tr>`).join('')
      : '<tr><td colspan="6">Abhi koi bank transaction nahi</td></tr>';
  } catch (err) { showMessage(err.message, 'error'); }
}

document.getElementById('bankTxnForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  try {
    await apiRequest('/api/bank/transactions', { method: 'POST', body: JSON.stringify(body) });
    e.target.reset(); showMessage('Bank transaction save ho gayi'); loadBank();
  } catch (err) { showMessage(err.message, 'error'); }
});

document.getElementById('bankAccountForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  try {
    await apiRequest('/api/bank/accounts', { method: 'POST', body: JSON.stringify(body) });
    e.target.reset(); showMessage('Account add ho gaya'); loadBank();
  } catch (err) { showMessage(err.message, 'error'); }
});

document.getElementById('bankTxnBody')?.addEventListener('click', async (e) => {
  const id = e.target.dataset?.bankDel;
  if (!id || !confirm('Ye entry delete karni hai?')) return;
  try { await apiRequest('/api/bank/transactions/' + id, { method: 'DELETE' }); loadBank(); }
  catch (err) { showMessage(err.message, 'error'); }
});

document.getElementById('posDetailToggle')?.addEventListener('click', (e) => {
  const sec = document.getElementById('posSection');
  const simple = sec.classList.toggle('pos-simple');
  e.target.textContent = simple ? 'Detail dikhao' : 'Simple bill';
});


// ===== Hisab Kitab reports =====
let hisabTab = 'stock';
const money = (v) => formatMoney(v || 0);
const num = (v) => Number(Math.round(Number(v || 0) * 1000) / 1000);

async function loadHisab() {
  const from = document.getElementById('hisabFrom').value, to = document.getElementById('hisabTo').value;
  const qs = `?${from ? 'from=' + from + '&' : ''}${to ? 'to=' + to : ''}`;
  const head = document.getElementById('hisabHead'), body = document.getElementById('hisabBody'), sum = document.getElementById('hisabSummary');
  const th = (cols) => '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
  const row = (cells) => '<tr>' + cells.map(c => `<td>${c ?? ''}</td>`).join('') + '</tr>';
  const empty = (n) => `<tr><td colspan="${n}">Koi record nahi</td></tr>`;
  try {
    if (hisabTab === 'stock') {
      const d = await apiRequest('/api/reports/stock');
      sum.innerHTML = `<div class="total-row"><span>Stock ki qeemat (kharid rate)</span><strong>${money(d.totals.value)}</strong></div>
        <div class="total-row"><span>Stock ki qeemat (bechne ka rate)</span><strong>${money(d.totals.saleValue)}</strong></div>
        <div class="total-row"><span>Kam stock wale items</span><strong>${d.totals.low}</strong></div>`;
      head.innerHTML = th(['Product', 'Category', 'Stock', 'Unit', 'Kharid rate', 'Qeemat', 'Status']);
      body.innerHTML = d.rows.length ? d.rows.map(r => row([escapeHtml(r.name), escapeHtml(r.category), num(r.current_stock), r.base_unit, money(r.purchase_price), money(r.stock_value),
        r.current_stock <= 0 ? '<span class="status-badge danger">Khatam</span>' : r.current_stock <= r.min_stock ? '<span class="status-badge warning">Kam</span>' : '<span class="status-badge success">Theek</span>'])).join('') : empty(7);
    } else if (hisabTab === 'products') {
      const d = await apiRequest('/api/reports/products' + qs);
      sum.innerHTML = `<div class="total-row"><span>Total bikri</span><strong>${money(d.rows.reduce((t, r) => t + r.revenue, 0))}</strong></div>
        <div class="total-row profit"><span>Total munafa</span><strong>${money(d.rows.reduce((t, r) => t + r.profit, 0))}</strong></div>`;
      head.innerHTML = th(['Product', 'Bika (qty)', 'Bikri', 'Cost', 'Munafa']);
      body.innerHTML = d.rows.length ? d.rows.map(r => row([escapeHtml(r.product_name), num(r.qty), money(r.revenue), money(r.cost), money(r.profit)])).join('') : empty(5);
    } else if (hisabTab === 'expenses') {
      const d = await apiRequest('/api/reports/expenses' + qs);
      sum.innerHTML = `<div class="total-row profit"><span>Total kharcha</span><strong>${money(d.total)}</strong></div>` +
        d.byCategory.map(c => `<div class="total-row"><span>${escapeHtml(c.category || 'Other')}</span><strong>${money(c.amount)}</strong></div>`).join('');
      head.innerHTML = th(['Date', 'Naam', 'Category', 'Amount', 'Payment']);
      body.innerHTML = d.rows.length ? d.rows.map(r => row([r.date, escapeHtml(r.name), escapeHtml(r.category), money(r.amount), escapeHtml(r.payment_method)])).join('') : empty(5);
    } else if (hisabTab === 'dueCustomers') {
      const d = await apiRequest('/api/reports/due-customers');
      sum.innerHTML = `<div class="total-row profit"><span>Total customer due</span><strong>${money(d.total)}</strong></div>`;
      head.innerHTML = th(['Customer', 'Phone', 'Total Purchases', 'Paid', 'Balance Due']);
      body.innerHTML = d.rows.length ? d.rows.map(r => row([escapeHtml(r.name), escapeHtml(r.phone || ''), money(r.total_purchases), money(r.total_paid), money(r.remaining_balance)])).join('') : empty(5);
    } else if (hisabTab === 'dueSuppliers') {
      const d = await apiRequest('/api/reports/due-suppliers');
      sum.innerHTML = `<div class="total-row profit"><span>Total supplier payable</span><strong>${money(d.total)}</strong></div>`;
      head.innerHTML = th(['Supplier', 'Phone', 'Purchases', 'Paid', 'Payable']);
      body.innerHTML = d.rows.length ? d.rows.map(r => row([escapeHtml(r.name), escapeHtml(r.phone || ''), money(r.total_purchases), money(r.total_paid), money(r.remaining_payable)])).join('') : empty(5);
    } else if (hisabTab === 'purchases') {
      const d = await apiRequest('/api/reports/purchases' + qs);
      sum.innerHTML = `<div class="total-row"><span>Total purchase / stock-in</span><strong>${money(d.total)}</strong></div><div class="total-row"><span>Paid</span><strong>${money(d.paid)}</strong></div><div class="total-row profit"><span>Due</span><strong>${money(d.due)}</strong></div>`;
      head.innerHTML = th(['Date', 'Type', 'Reference', 'Supplier', 'Total', 'Paid', 'Due']);
      body.innerHTML = d.rows.length ? d.rows.map(r => row([r.date, escapeHtml(r.type), escapeHtml(r.reference || ''), escapeHtml(r.party || ''), money(r.total), money(r.paid), money(r.due)])).join('') : empty(7);
    } else if (hisabTab === 'supplierItems') {
      const supplierId = el.hisabSupplierFilter?.value || '';
      const supplierQuery = supplierId ? `${qs}${qs ? '&' : '?'}supplier_id=${encodeURIComponent(supplierId)}` : qs;
      const d = await apiRequest('/api/reports/supplier-items' + supplierQuery);
      sum.innerHTML = `<div class="total-row profit"><span>Total supplier goods received</span><strong>${money(d.total)}</strong></div>`;
      head.innerHTML = th(['Date', 'Source', 'Reference', 'Supplier', 'Product', 'Article / Unit', 'Qty', 'Cost / Base Unit', 'Amount']);
      body.innerHTML = d.rows.length ? d.rows.map(r => row([r.date, escapeHtml(r.source), escapeHtml(r.reference || ''), escapeHtml(r.supplier), escapeHtml(r.product), escapeHtml(r.article || ''), `${num(r.quantity)} × ${num(r.conversion_factor)}`, money(r.unit_cost), money(r.amount)])).join('') : empty(9);
    } else if (hisabTab === 'cash') {
      const d = await apiRequest('/api/reports/cash' + qs);
      sum.innerHTML = `<div class="total-row"><span>Cash received</span><strong>${money(d.totals.in)}</strong></div><div class="total-row"><span>Cash paid</span><strong>${money(d.totals.out)}</strong></div><div class="total-row profit"><span>Net cash movement</span><strong>${money(d.balance)}</strong></div>`;
      head.innerHTML = th(['Date', 'Type', 'Reference', 'Party', 'In', 'Out']);
      body.innerHTML = d.rows.length ? d.rows.map(r => row([String(r.date || '').slice(0, 10), escapeHtml(r.type), escapeHtml(r.reference || ''), escapeHtml(r.party || ''), r.direction === 'in' ? money(r.amount) : '', r.direction === 'out' ? money(r.amount) : ''])).join('') : empty(6);
    } else if (hisabTab === 'bank') {
      const d = await apiRequest('/api/reports/bank' + qs);
      sum.innerHTML = `<div class="total-row"><span>Deposits (selected dates)</span><strong>${money(d.totals.in)}</strong></div><div class="total-row"><span>Withdrawals (selected dates)</span><strong>${money(d.totals.out)}</strong></div>` +
        d.accounts.map(a => `<div class="total-row profit"><span>${escapeHtml(a.name)} current balance</span><strong>${money(a.balance)}</strong></div>`).join('');
      head.innerHTML = th(['Date', 'Account', 'Type', 'Reference', 'Note', 'In', 'Out']);
      body.innerHTML = d.transactions.length ? d.transactions.map(r => row([r.txn_date, escapeHtml(r.account_name), escapeHtml(r.kind), escapeHtml(r.reference), escapeHtml(r.notes), r.direction === 'in' ? money(r.amount) : '', r.direction === 'out' ? money(r.amount) : ''])).join('') : empty(7);
    } else if (hisabTab === 'partners') {
      const d = await apiRequest('/api/reports/partners' + qs);
      sum.innerHTML = d.summary.map(p => `<div class="total-row"><span>${escapeHtml(p.name)} - nikale: ${money(p.withdrawals)} | advance: ${money(p.advances)}</span><strong>${money(p.profit_share)} share</strong></div>`).join('');
      head.innerHTML = th(['Date', 'Partner', 'Type', 'Amount', 'Payment', 'Wajah']);
      body.innerHTML = d.rows.length ? d.rows.map(r => row([String(r.created_at || '').slice(0, 10), escapeHtml(r.partner_name), escapeHtml(r.type), money(r.amount), escapeHtml(r.payment_method), escapeHtml(r.reason || r.notes || '')])).join('') : empty(6);
    }
  } catch (err) { showMessage(err.message, 'error'); }
}

document.querySelectorAll('.hisab-tab').forEach((b) => b.addEventListener('click', () => {
  hisabTab = b.dataset.rep;
  document.querySelectorAll('.hisab-tab').forEach((x) => { x.classList.toggle('primary-btn', x === b); x.classList.toggle('ghost-btn', x !== b); });
  loadHisab();
}));
document.getElementById('hisabRefresh')?.addEventListener('click', loadHisab);
document.getElementById('hisabSupplierFilter')?.addEventListener('change', () => {
  if (hisabTab === 'supplierItems') loadHisab();
});

document.getElementById('seedShopProductsBtn')?.addEventListener('click', async () => {
  try {
    const r = await apiRequest('/api/setup/shop-products', { method: 'POST', body: '{}' });
    showMessage(r.message);
    if (typeof loadProducts === 'function') await loadProducts();
  } catch (err) { showMessage(err.message, 'error'); }
});
