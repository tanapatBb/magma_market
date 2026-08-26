// ==========================================
// SYSTEM INITIALIZATION & THEME LOGIC
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  cleanOldData();
  renderInventory();
  updateDashboard();
});

// สลับธีม Dark / Light
function initTheme() {
  const currentTheme = localStorage.getItem('app-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeButtonText(currentTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('app-theme', newTheme);
  updateThemeButtonText(newTheme);
}

function updateThemeButtonText(theme) {
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.innerText = theme === 'dark' ? '☀️ โหมดสีสว่าง' : '🌙 โหมดสีเข้ม';
  }
}

// กรองตัวอย่าง SmartHeart ออกถาวร ไม่ให้ลูปกลับขึ้นมาอีก
function cleanOldData() {
  let products = JSON.parse(localStorage.getItem('products_db')) || [];
  products = products.filter(p => 
    !p.name?.toLowerCase().includes('smartheart') && 
    !p.name?.includes('สมาร์ทฮาร์ท')
  );
  localStorage.setItem('products_db', JSON.stringify(products));
}

// ==========================================
// TABS & INVENTORY MANAGEMENT
// ==========================================
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

  document.getElementById(`tab-${tabName}`).style.display = 'block';
  event.target.classList.add('active');

  if (tabName === 'inventory') renderInventory();
  if (tabName === 'dashboard') updateDashboard();
}

function getProducts() {
  return JSON.parse(localStorage.getItem('products_db')) || [];
}

function saveProduct(event) {
  event.preventDefault();
  const sku = document.getElementById('p-sku').value.trim();
  const name = document.getElementById('p-name').value.trim();
  const qty = parseInt(document.getElementById('p-qty').value);
  const price = parseFloat(document.getElementById('p-price').value);

  let products = getProducts();
  
  // เช็ค SKU ซ้ำ
  const existingIndex = products.findIndex(p => p.sku === sku);
  if (existingIndex > -1) {
    products[existingIndex] = { sku, name, qty, price };
  } else {
    products.push({ sku, name, qty, price });
  }

  localStorage.setItem('products_db', JSON.stringify(products));
  document.getElementById('product-form').reset();
  alert('บันทึกข้อมูลเรียบร้อยแล้ว!');
  switchTab('inventory');
}

function renderInventory(items = null) {
  const products = items || getProducts();
  const tbody = document.getElementById('inventory-table-body');
  tbody.innerHTML = '';

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-muted);">ไม่มีรายการสินค้าในระบบ</td></tr>`;
    return;
  }

  products.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.sku}</strong></td>
      <td>${p.name}</td>
      <td>${p.qty} ชิ้น</td>
      <td>฿${p.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
      <td><span class="stock-badge">${p.qty > 0 ? 'พร้อมส่ง' : 'สินค้าหมด'}</span></td>
      <td>
        <button class="btn-action btn-print" onclick="openBarcodeModal('${p.sku}', '${p.name}', ${p.price})">🖨️ บาร์โค้ด</button>
        <button class="btn-action btn-delete" onclick="deleteProduct('${p.sku}')">ลบ</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function deleteProduct(sku) {
  if (confirm(`คุณต้องการลบสินค้ารหัส ${sku} ใช่หรือไม่?`)) {
    let products = getProducts().filter(p => p.sku !== sku);
    localStorage.setItem('products_db', JSON.stringify(products));
    renderInventory();
    updateDashboard();
  }
}

function filterProducts() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const products = getProducts();
  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(query) || 
    p.sku.toLowerCase().includes(query)
  );
  renderInventory(filtered);
}

// ==========================================
// DASHBOARD & BARCODE MODAL
// ==========================================
function updateDashboard() {
  const products = getProducts();
  const totalItems = products.length;
  const totalQty = products.reduce((sum, p) => sum + p.qty, 0);
  const totalValue = products.reduce((sum, p) => sum + (p.qty * p.price), 0);

  document.getElementById('stat-total-items').innerText = totalItems;
  document.getElementById('stat-total-qty').innerText = totalQty;
  document.getElementById('stat-total-value').innerText = `฿${totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
}

function openBarcodeModal(sku, name, price) {
  document.getElementById('modal-product-name').innerText = name;
  document.getElementById('modal-product-price').innerText = `ราคา ฿${price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
  
  // เจนเนอเรต บาร์โค้ด
  JsBarcode("#barcode-svg", sku, {
    format: "CODE128",
    width: 2,
    height: 60,
    displayValue: true
  });

  document.getElementById('barcode-modal').style.display = 'flex';
}

function closeBarcodeModal() {
  document.getElementById('barcode-modal').style.display = 'none';
}