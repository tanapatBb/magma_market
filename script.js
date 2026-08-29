const API_URL = 'https://magma-market-api.onrender.com/api';
let html5QrCode = null;
let currentImageData = '';
let lastSavedProduct = null;
let productsCache = [];
let myChart = null;
let rawHistoryCache = []; // ตัวแปรเก็บประวัติสำหรับสร้าง Dropdown

// Helper Function ดึงค่า Key แบบยืดหยุ่น
function getValue(obj, ...keys) {
  if (!obj) return null;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '' && obj[key] !== 'null') {
      return obj[key];
    }
  }
  return null;
}

// ==========================================
// 1. ระบบเริ่มต้นทำงาน & Auto Polling
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  fetchProducts();
  fetchDatabaseTable();
  fetchFilteredHistory();
  
  const today = new Date().toISOString().split('T')[0];
  const importInput = document.getElementById('importDate');
  if (importInput) importInput.value = today;

  // Auto Polling ดึงข้อมูลใหม่ทุกๆ 15 วินาที
  setInterval(() => {
    fetchProducts();
    fetchFilteredHistory();
  }, 15000);
});

// ==========================================
// 2. จัดการธีม & แท็บ
// ==========================================
function initTheme() {
  const currentTheme = localStorage.getItem('app-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) themeBtn.innerText = currentTheme === 'dark' ? '☀️ โหมดสว่าง' : '🌙 โหมดเข้ม';
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('app-theme', newTheme);
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) themeBtn.innerText = newTheme === 'dark' ? '☀️ โหมดสว่าง' : '🌙 โหมดเข้ม';
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.style.display = 'block';
  
  const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => {
    const onclickAttr = btn.getAttribute('onclick');
    return onclickAttr && onclickAttr.includes(tabId);
  });
  if (activeBtn) activeBtn.classList.add('active');

  if (tabId === 'database-tab') fetchDatabaseTable();
  if (tabId === 'dashboard-tab') renderDashboard();
  if (tabId === 'history-tab') fetchFilteredHistory();
}

function toggleAddForm() {
  const form = document.getElementById('addProductFormCard');
  if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function previewImage(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      currentImageData = e.target.result;
      const imgPreview = document.getElementById('imagePreview');
      const container = document.getElementById('imagePreviewContainer');
      if (imgPreview) imgPreview.src = currentImageData;
      if (container) container.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

// ==========================================
// 3. ระบบคำนวณราคา & วันหมดอายุ
// ==========================================
function handleProfitMarginChange(isEdit = false) {
  const selectId = isEdit ? 'editProfitMargin' : 'profitMargin';
  const customInputId = isEdit ? 'editCustomProfitMargin' : 'customProfitMargin';
  
  const selectEl = document.getElementById(selectId);
  const customInputEl = document.getElementById(customInputId);

  if (selectEl && customInputEl) {
    if (selectEl.value === 'custom') {
      customInputEl.style.display = 'block';
      customInputEl.focus();
    } else {
      customInputEl.style.display = 'none';
      customInputEl.value = '';
    }
  }

  calculateSellingPrice(isEdit);
}

function calculateSellingPrice(isEdit = false) {
  const costId = isEdit ? 'editCostPrice' : 'costPrice';
  const selectId = isEdit ? 'editProfitMargin' : 'profitMargin';
  const customInputId = isEdit ? 'editCustomProfitMargin' : 'customProfitMargin';
  const sellingId = isEdit ? 'editSellingPrice' : 'sellingPrice';

  const costEl = document.getElementById(costId);
  const selectEl = document.getElementById(selectId);
  const customInputEl = document.getElementById(customInputId);
  const sellingEl = document.getElementById(sellingId);

  if (!costEl || !sellingEl) return;

  const cost = parseFloat(costEl.value) || 0;
  const selectVal = selectEl ? selectEl.value : '60';
  let margin = 0;

  if (selectVal === 'none') {
    margin = 0;
  } else if (selectVal === 'custom') {
    margin = parseFloat(customInputEl ? customInputEl.value : 0) || 0;
  } else {
    margin = parseFloat(selectVal) || 0;
  }

  if (cost > 0) {
    const sellingPrice = cost + (cost * (margin / 100));
    sellingEl.value = sellingPrice.toFixed(2);
  } else {
    sellingEl.value = '';
  }
}

function getSelectedProfitMargin(isEdit = false) {
  const selectId = isEdit ? 'editProfitMargin' : 'profitMargin';
  const customInputId = isEdit ? 'editCustomProfitMargin' : 'customProfitMargin';

  const selectEl = document.getElementById(selectId);
  const customInputEl = document.getElementById(customInputId);

  if (!selectEl) return 0;
  const val = selectEl.value;

  if (val === 'none') return 0;
  if (val === 'custom') return parseFloat(customInputEl ? customInputEl.value : 0) || 0;
  return parseFloat(val) || 0;
}

function addMonthsToExpiry(months, isEdit = false) {
  const importInputId = isEdit ? 'editImportDate' : 'importDate';
  const expiryInputId = isEdit ? 'editExpiryDate' : 'expiryDate';
  
  const importInput = document.getElementById(importInputId);
  const expiryInput = document.getElementById(expiryInputId);

  if (!expiryInput) return;

  const importVal = importInput ? importInput.value : '';
  const baseDate = importVal ? new Date(importVal) : new Date();

  baseDate.setMonth(baseDate.getMonth() + months);
  expiryInput.value = baseDate.toISOString().split('T')[0];
}

function getExpiryStatus(expiryDateString) {
  if (!expiryDateString || expiryDateString === '-') return { text: 'ไม่ระบุ', color: '#7f8c8d' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiryDateString);
  expiryDate.setHours(0, 0, 0, 0);

  const diffTime = expiryDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (isNaN(diffDays)) return { text: 'ไม่ระบุ', color: '#7f8c8d' };

  if (diffDays < 0) {
    return { text: `หมดอายุ (${Math.abs(diffDays)} วัน)`, color: '#e74c3c' };
  } else if (diffDays <= 30) {
    return { text: `ใกล้หมดอายุ (${diffDays} วัน)`, color: '#e67e22' };
  } else {
    return { text: `เหลือ ${diffDays} วัน`, color: '#27ae60' };
  }
}

// ==========================================
// 4. ดึงและแสดงรายการสินค้า (Products API)
// ==========================================
async function fetchProducts() {
  try {
    const res = await fetch(`${API_URL}/products`);
    let data = await res.json();
    
    productsCache = data.filter(p => 
      !p.name?.toLowerCase().includes('smartheart') && 
      !p.name?.includes('สมาร์ทฮาร์ท')
    );
    
    populateSuggestions(productsCache);
    filterProducts();
  } catch (err) {
    console.error('Error fetching products:', err);
  }
}

function populateSuggestions(products) {
  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];
  const brandDatalist = document.getElementById('brandSuggestions');
  if (brandDatalist) {
    brandDatalist.innerHTML = brands.map(b => `<option value="${b}">`).join('');
  }

  const select = document.getElementById('filterBrandSelect');
  if (select) {
    const currentVal = select.value;
    select.innerHTML = `<option value="">ทั้งหมด (All Brands)</option>` + 
      brands.map(b => `<option value="${b}" ${b === currentVal ? 'selected' : ''}>${b}</option>`).join('');
  }

  const names = [...new Set(products.map(p => p.name).filter(Boolean))];
  const nameDatalist = document.getElementById('nameSuggestions');
  if (nameDatalist) {
    nameDatalist.innerHTML = names.map(n => `<option value="${n}">`).join('');
  }
}

function filterProducts() {
  const searchInput = document.getElementById('searchKeyword');
  const brandSelect = document.getElementById('filterBrandSelect');

  const keyword = searchInput ? searchInput.value.toLowerCase() : '';
  const selectedBrand = brandSelect ? brandSelect.value : '';

  const filtered = productsCache.filter(item => {
    const matchName = (item.name || '').toLowerCase().includes(keyword) || (item.brand || '').toLowerCase().includes(keyword);
    const matchBrand = selectedBrand ? item.brand === selectedBrand : true;
    return matchName && matchBrand;
  });

  renderGroupedProducts(filtered);
}

function renderGroupedProducts(products) {
  const container = document.getElementById('productList');
  if (!container) return;

  const activeProducts = products.filter(item => Number(item.stock || 0) > 0);

  if (!activeProducts || activeProducts.length === 0) {
    container.innerHTML = '<div class="empty-state">ไม่มีรายการสินค้าคงเหลือ (หมดสต็อก)</div>';
    return;
  }

  const groups = {};
  activeProducts.forEach(item => {
    const key = `${(item.brand || 'ไม่ระบุ').trim()}_${(item.name || 'ไม่ระบุ').trim()}`;
    if (!groups[key]) {
      groups[key] = {
        brand: item.brand,
        name: item.name,
        size: item.size || (item.volumeValue ? `${item.volumeValue} ${item.volumeUnit || ''}` : ''),
        image: getValue(item, 'image', 'img', 'photo', 'picture') || '',
        totalStock: 0,
        lots: []
      };
    }
    groups[key].totalStock += Number(item.stock || 0);
    groups[key].lots.push(item);
  });

  container.innerHTML = Object.values(groups).map(group => {
    return `
      <div class="product-card">
        ${group.image ? `<img src="${group.image}" class="product-img" alt="Product">` : ''}
        <div class="product-info">
          <h3>${group.brand || 'ไม่ระบุยี่ห้อ'}</h3>
          <p style="font-size: 1rem; font-weight: bold; margin-bottom: 4px;">${group.name}</p>
          <p style="font-size: 0.85rem; color: var(--text-muted);"><strong>ขนาด:</strong> ${group.size || 'ไม่ระบุ'}</p>
          <p style="margin-top: 4px; font-size: 0.9rem;"><strong>สต็อกรวม:</strong> <b style="color: #27ae60;">${group.totalStock}</b> ชิ้น</p>

          <div class="lots-wrapper">
            <h4 style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px;">📦 ล็อตที่มีสินค้า (${group.lots.length} ล็อต):</h4>
            ${group.lots.map(lot => {
              const cost = getValue(lot, 'costPrice', 'cost_price', 'cost', 'costprice');
              const selling = getValue(lot, 'sellingPrice', 'selling_price', 'price', 'sellingprice');
              const margin = getValue(lot, 'profitMargin', 'profit_margin', 'profit');
              const expDate = getValue(lot, 'expiryDate', 'expiry_date', 'exp', 'expiry') || '-';
              const importDate = getValue(lot, 'importDate', 'import_date', 'import') || '-';
              const lotNo = getValue(lot, 'lotNo', 'lot_no', 'lot') || 'ไม่ระบุล็อต';

              const expStatus = getExpiryStatus(expDate);

              return `
                <div class="lot-item">
                  <div class="lot-header">
                    <span>🏷️ <b>${lotNo}</b> (<code>${lot.barcode}</code>)</span>
                    <span class="stock-badge">คงเหลือ ${lot.stock}</span>
                  </div>
                  
                  <div class="lot-details">
                    <p>💰 ทุน: <b>${cost ? cost + ' ฿' : '-'}</b> | ขาย: <b style="color:#27ae60">${selling ? selling + ' ฿' : '-'}</b> (${margin !== null && margin !== undefined ? margin + '%' : '-'})</p>
                    <p>📅 รับเข้า: ${importDate} | EXP: ${expDate} <span style="color:${expStatus.color}; font-weight:bold;">(${expStatus.text})</span></p>
                  </div>

                  <div class="lot-actions">
                    <button class="btn-action btn-edit" onclick="openEditModal('${lot.id}')">✏️ แก้ไข</button>
                    <button class="btn-action btn-print" onclick="printBarcode('${lot.brand}', '${lot.name}', '${lot.barcode}', '${lotNo}')">🖨️ พิมพ์</button>
                    <button class="btn-action btn-stock" onclick="reduceStock('${lot.id}', ${lot.stock})">➖ ตัดสต็อก</button>
                    <button class="btn-action btn-delete" onclick="deleteProduct('${lot.id}')">🗑️ ลบ</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 5. Dashboard & Database Table
// ==========================================
function renderDashboard() {
  let totalCost = 0;
  let totalSelling = 0;
  const summaryMap = {};

  productsCache.forEach(item => {
    const cost = Number(getValue(item, 'costPrice', 'cost_price', 'cost', 'costprice') || 0);
    const selling = Number(getValue(item, 'sellingPrice', 'selling_price', 'price', 'sellingprice') || 0);
    const stock = Number(item.stock || 0);

    totalCost += cost * stock;
    totalSelling += selling * stock;

    const key = `${item.brand || ''} ${item.name || ''}`.trim();
    if (!summaryMap[key]) {
      summaryMap[key] = { stock: 0, costTotal: 0, sellingTotal: 0 };
    }
    summaryMap[key].stock += stock;
    summaryMap[key].costTotal += cost * stock;
    summaryMap[key].sellingTotal += selling * stock;
  });

  const profit = totalSelling - totalCost;

  const costValEl = document.getElementById('totalCostVal');
  const sellingValEl = document.getElementById('totalSellingVal');
  const profitValEl = document.getElementById('totalProfitVal');

  if (costValEl) costValEl.innerText = `${totalCost.toLocaleString('th-TH')} ฿`;
  if (sellingValEl) sellingValEl.innerText = `${totalSelling.toLocaleString('th-TH')} ฿`;
  if (profitValEl) profitValEl.innerText = `${profit.toLocaleString('th-TH')} ฿`;

  const chartCanvas = document.getElementById('financialChart');
  if (chartCanvas && typeof Chart !== 'undefined') {
    const ctx = chartCanvas.getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['ราคาทุนรวม', 'กำไรคาดการณ์'],
        datasets: [{
          data: [totalCost, profit > 0 ? profit : 0],
          backgroundColor: ['#3498db', '#2ecc71']
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  const tbody = document.getElementById('dashboardTableBody');
  if (tbody) {
    tbody.innerHTML = Object.keys(summaryMap).map(key => `
      <tr>
        <td><b>${key}</b></td>
        <td style="text-align:center;">${summaryMap[key].stock}</td>
        <td>${summaryMap[key].costTotal.toLocaleString()} ฿</td>
        <td style="color:#27ae60; font-weight:bold;">${summaryMap[key].sellingTotal.toLocaleString()} ฿</td>
      </tr>
    `).join('');
  }
}

async function fetchDatabaseTable() {
  try {
    const res = await fetch(`${API_URL}/products`);
    let products = await res.json();
    productsCache = products.filter(p => !p.name?.toLowerCase().includes('smartheart') && !p.name?.includes('สมาร์ทฮาร์ท'));

    const header = document.getElementById('dbTableHeader');
    const body = document.getElementById('dbTableBody');

    if (!header || !body) return;

    const headers = [
      'ID', 'Barcode', 'Lot No', 'Brand', 'Name', 
      'Cost Price', 'Profit (%)', 'Selling Price', 
      'Import Date', 'Expiry Date', 'Size', 'Stock', 'จัดการ'
    ];
    header.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

    if (!productsCache || productsCache.length === 0) {
      body.innerHTML = `<tr><td colspan="${headers.length}" style="text-align: center;">ไม่มีข้อมูล</td></tr>`;
      return;
    }

    body.innerHTML = productsCache.map(row => {
      const id = row.id ?? '-';
      const barcode = row.barcode ?? '-';
      const lotNo = getValue(row, 'lotNo', 'lot_no', 'lot') || '-';
      const brand = row.brand ?? '-';
      const name = row.name ?? '-';

      const costPrice = getValue(row, 'costPrice', 'cost_price', 'cost', 'costprice');
      const profitMargin = getValue(row, 'profitMargin', 'profit_margin', 'profit');
      const sellingPrice = getValue(row, 'sellingPrice', 'selling_price', 'price', 'sellingprice');
      const importDate = getValue(row, 'importDate', 'import_date', 'import') || '-';
      const expiryDate = getValue(row, 'expiryDate', 'expiry_date', 'exp', 'expiry') || '-';
      const size = row.size || (row.volumeValue ? `${row.volumeValue} ${row.volumeUnit || ''}` : '-');
      const stock = row.stock ?? 0;

      return `
        <tr>
          <td>${id}</td>
          <td><code>${barcode}</code></td>
          <td>${lotNo}</td>
          <td><b>${brand}</b></td>
          <td>${name}</td>
          <td>${costPrice ? costPrice + ' ฿' : '-'}</td>
          <td>${profitMargin !== null && profitMargin !== undefined ? profitMargin + '%' : '-'}</td>
          <td style="color:#27ae60; font-weight:bold;">${sellingPrice ? sellingPrice + ' ฿' : '-'}</td>
          <td>${importDate}</td>
          <td>${expiryDate}</td>
          <td>${size}</td>
          <td><b>${stock}</b></td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn-action btn-edit" onclick="openEditModal('${row.id}')">✏️</button>
              <button class="btn-action btn-delete" onclick="deleteProduct('${row.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error fetching database table:', err);
  }
}

// ==========================================
// 6. เพิ่ม / แก้ไข / ลบ สินค้า
// ==========================================
function openEditModal(id) {
  const item = productsCache.find(p => String(p.id) === String(id));
  if (!item) return;

  document.getElementById('editId').value = item.id;
  document.getElementById('editBrand').value = item.brand || '';
  document.getElementById('editName').value = item.name || '';
  document.getElementById('editCostPrice').value = getValue(item, 'costPrice', 'cost_price', 'cost', 'costprice') || '';
  
  const margin = getValue(item, 'profitMargin', 'profit_margin', 'profit');
  const editMarginSelect = document.getElementById('editProfitMargin');
  const editCustomInput = document.getElementById('editCustomProfitMargin');

  if (editMarginSelect) {
    if (margin === 0 || margin === '0') {
      editMarginSelect.value = 'none';
      if (editCustomInput) editCustomInput.style.display = 'none';
    } else if (['40', '50', '60', '70', '80', '90', '100'].includes(String(margin))) {
      editMarginSelect.value = String(margin);
      if (editCustomInput) editCustomInput.style.display = 'none';
    } else if (margin !== null && margin !== undefined) {
      editMarginSelect.value = 'custom';
      if (editCustomInput) {
        editCustomInput.style.display = 'block';
        editCustomInput.value = margin;
      }
    } else {
      editMarginSelect.value = '60';
      if (editCustomInput) editCustomInput.style.display = 'none';
    }
  }

  document.getElementById('editSellingPrice').value = getValue(item, 'sellingPrice', 'selling_price', 'price', 'sellingprice') || '';
  document.getElementById('editLotNo').value = getValue(item, 'lotNo', 'lot_no', 'lot') || '';
  document.getElementById('editStock').value = item.stock ?? 0;
  document.getElementById('editImportDate').value = getValue(item, 'importDate', 'import_date', 'import') || '';
  document.getElementById('editExpiryDate').value = getValue(item, 'expiryDate', 'expiry_date', 'exp', 'expiry') || '';
  document.getElementById('editSize').value = item.size || (item.volumeValue ? `${item.volumeValue} ${item.volumeUnit || ''}` : '');

  document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) modal.style.display = 'none';
}

async function handleUpdateProduct(event) {
  event.preventDefault();
  const id = document.getElementById('editId').value;

  const updateData = {
    brand: document.getElementById('editBrand').value,
    name: document.getElementById('editName').value,
    costPrice: Number(document.getElementById('editCostPrice').value),
    profitMargin: getSelectedProfitMargin(true),
    sellingPrice: Number(document.getElementById('editSellingPrice').value),
    lotNo: document.getElementById('editLotNo').value,
    stock: Number(document.getElementById('editStock').value),
    importDate: document.getElementById('editImportDate').value,
    expiryDate: document.getElementById('editExpiryDate').value,
    size: document.getElementById('editSize').value
  };

  try {
    const res = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    const result = await res.json();
    if (result.status === 'success') {
      closeEditModal();
      fetchProducts();
      fetchDatabaseTable();
    }
  } catch (err) {
    alert('ไม่สามารถอัปเดตข้อมูลได้');
  }
}

async function handleAddProduct(event) {
  event.preventDefault();

  const barcode = Math.floor(100000 + Math.random() * 900000).toString();
  const productData = {
    barcode: barcode,
    lotNo: document.getElementById('lotNo').value,
    brand: document.getElementById('brand').value,
    name: document.getElementById('name').value,
    costPrice: Number(document.getElementById('costPrice').value),
    profitMargin: getSelectedProfitMargin(false),
    sellingPrice: Number(document.getElementById('sellingPrice').value),
    volumeValue: document.getElementById('volumeValue').value,
    volumeUnit: document.getElementById('volumeUnit').value,
    stock: Number(document.getElementById('stock').value),
    importDate: document.getElementById('importDate').value,
    expiryDate: document.getElementById('expiryDate').value,
    image: currentImageData
  };

  try {
    const res = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });

    const result = await res.json();
    if (result.status === 'success') {
      lastSavedProduct = result.data;
      document.getElementById('productForm').reset();
      
      const today = new Date().toISOString().split('T')[0];
      const importDateInput = document.getElementById('importDate');
      if (importDateInput) importDateInput.value = today;

      const imgContainer = document.getElementById('imagePreviewContainer');
      if (imgContainer) imgContainer.style.display = 'none';
      currentImageData = '';
      toggleAddForm();

      fetchProducts();
      fetchDatabaseTable();

      openBarcodeModal(lastSavedProduct);
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
}

async function deleteProduct(id) {
  if (!confirm('ยืนยันการลบรายการล็อตนี้?')) return;
  try {
    const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.status === 'success') {
      fetchProducts();
      fetchDatabaseTable();
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาด');
  }
}

// ==========================================
// 7. ตัดสต็อก & บันทึกประวัติลง Database (Audit Log)
// ==========================================
async function saveHistoryLog(item, qtyCut, remainingStock) {
  if (!item) return;
  try {
    await fetch(`${API_URL}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: item.id,
        brand: item.brand,
        name: item.name,
        lotNo: getValue(item, 'lotNo', 'lot_no', 'lot'),
        barcode: item.barcode,
        sellingPrice: getValue(item, 'sellingPrice', 'selling_price', 'price', 'sellingprice') || 0,
        qtyCut: qtyCut,
        remainingStock: remainingStock
      })
    });
  } catch (err) {
    console.error('Error saving history log:', err);
  }
}

async function reduceStock(id, currentStock) {
  if (currentStock <= 0) return alert('⚠️ สินค้าล็อตนี้หมดสต็อกแล้ว!');

  const item = productsCache.find(p => String(p.id) === String(id));
  const productName = item ? `${item.brand || ''} ${item.name || ''}`.trim() : 'สินค้า';
  const lotNo = getValue(item, 'lotNo', 'lot_no', 'lot');
  const lotText = lotNo ? ` (Lot: ${lotNo})` : '';

  const confirmCut = confirm(`❓ ยืนยันการตัดสต็อก (-1)\n\nสินค้า: ${productName}${lotText}\nคงเหลือปัจจุบัน: ${currentStock} ชิ้น`);
  if (!confirmCut) return;

  try {
    const newStock = currentStock - 1;
    const res = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: newStock })
    });
    const result = await res.json();
    if (result.status === 'success') {
      await saveHistoryLog(item, 1, newStock); // บันทึกประวัติเข้า stock_history
      fetchProducts();
      fetchDatabaseTable();
      fetchFilteredHistory();
    }
  } catch (err) {
    alert('ไม่สามารถตัดสต็อกได้');
  }
}

async function reduceStockDirect(id, currentStock) {
  const item = productsCache.find(p => String(p.id) === String(id));
  const newStock = currentStock - 1;

  const res = await fetch(`${API_URL}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stock: newStock })
  });
  const result = await res.json();
  if (result.status === 'success') {
    await saveHistoryLog(item, 1, newStock); // บันทึกประวัติเข้า stock_history
    fetchProducts();
    fetchDatabaseTable();
    fetchFilteredHistory();
  }
}

// ==========================================
// 8. สแกนบาร์โค้ด & พิมพ์บาร์โค้ด Modal
// ==========================================
function openBarcodeModal(product) {
  const barcodeText = document.getElementById('modalBarcodeText');
  const printBrand = document.getElementById('printBrand');
  const printName = document.getElementById('printName');
  const printLot = document.getElementById('printLot');
  const modal = document.getElementById('barcodeModal');

  const lotNo = getValue(product, 'lotNo', 'lot_no', 'lot') || '-';

  if (barcodeText) barcodeText.innerText = product.barcode;
  if (printBrand) printBrand.innerText = product.brand || 'Magma Market';
  if (printName) printName.innerText = product.name || 'สินค้า';
  if (printLot) printLot.innerText = `LOT: ${lotNo}`;

  JsBarcode("#modalBarcodeCanvas", product.barcode, {
    format: "CODE128",
    width: 2,
    height: 50,
    displayValue: true
  });

  if (modal) modal.style.display = 'flex';
}

function closeModal() {
  const modal = document.getElementById('barcodeModal');
  if (modal) modal.style.display = 'none';
}

function triggerPrintFromModal() {
  window.print();
}

function printBarcode(brand, name, barcodeCode, lotNo) {
  openBarcodeModal({ brand, name, barcode: barcodeCode, lotNo });
}

async function toggleScanner() {
  const container = document.getElementById('reader-container');
  if (!container) return;

  if (container.style.display === 'none') {
    container.style.display = 'block';
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");

    const config = {
      fps: 20,
      qrbox: (w, h) => ({ width: Math.min(w * 0.8, 250), height: 120 }),
      aspectRatio: 1.333333
    };

    try {
      await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
    } catch (err) {
      alert("❌ ไม่สามารถเปิดกล้องได้");
      stopScanner();
    }
  } else {
    stopScanner();
  }
}

async function stopScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    await html5QrCode.stop();
  }
  const container = document.getElementById('reader-container');
  if (container) container.style.display = 'none';
}

async function onScanSuccess(decodedText) {
  stopScanner();
  try {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    const item = products.find(p => String(p.barcode) === String(decodedText));

    if (item) {
      if (item.stock > 0) {
        const productName = `${item.brand || ''} ${item.name || ''}`.trim();
        const lotNo = getValue(item, 'lotNo', 'lot_no', 'lot');
        const lotText = lotNo ? ` (Lot: ${lotNo})` : '';

        const confirmCut = confirm(`🎯 สแกนพบสินค้า!\n\nตัดสต็อก (-1) ของ:\n${productName}${lotText}\n\nคงเหลือปัจจุบัน: ${item.stock} ชิ้น หรือไม่?`);
        if (confirmCut) {
          await reduceStockDirect(item.id, item.stock);
          alert(`✅ ตัดสต็อกเรียบร้อย: ${productName}`);
        }
      } else {
        alert(`⚠️ สินค้าล็อตนี้หมดสต็อกแล้ว! (${item.name})`);
      }
    } else {
      alert(`❌ ไม่พบรหัสบาร์โค้ด: ${decodedText}`);
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการสแกน');
  }
}

// ==========================================
// 9. ระบบประวัติการตัดสต็อก & ตัวกรอง Dropdown/Date (Audit Log)
// ==========================================
async function fetchFilteredHistory() {
  const nameSelect = document.getElementById('filterHistoryName');
  const lotSelect = document.getElementById('filterHistoryLot');
  const startDateInput = document.getElementById('filterStartDate');
  const endDateInput = document.getElementById('filterEndDate');

  const selectedName = nameSelect ? nameSelect.value : '';
  const selectedLot = lotSelect ? lotSelect.value : '';
  const startDate = startDateInput ? startDateInput.value : '';
  const endDate = endDateInput ? endDateInput.value : '';

  let url = `${API_URL}/history?`;
  if (selectedName) url += `name=${encodeURIComponent(selectedName)}&`;
  if (selectedLot) url += `lotNo=${encodeURIComponent(selectedLot)}&`;
  if (startDate) url += `startDate=${encodeURIComponent(startDate)}&`;
  if (endDate) url += `endDate=${encodeURIComponent(endDate)}&`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network response was not ok');
    const historyData = await res.json();
    
    // บันทึกและสร้างตัวเลือกใน Dropdown เมื่อโหลดข้อมูลทั้งหมด
    if (!selectedName && !selectedLot && !startDate && !endDate) {
      rawHistoryCache = historyData;
      populateHistoryDropdowns(historyData);
    } else if (rawHistoryCache.length === 0) {
      fetchRawHistoryForDropdowns();
    }

    renderHistoryTable(historyData);
  } catch (err) {
    console.error('Error fetching history:', err);
  }
}

// สร้าง Dropdown ตัวเลือกเฉพาะที่มีข้อมูลบันทึกอยู่จริง
function populateHistoryDropdowns(data) {
  const nameSelect = document.getElementById('filterHistoryName');
  const lotSelect = document.getElementById('filterHistoryLot');
  if (!nameSelect || !lotSelect) return;

  const currentName = nameSelect.value;
  const currentLot = lotSelect.value;

  const names = [...new Set(data.map(item => item.name).filter(Boolean))];
  const lots = [...new Set(data.map(item => item.lot_no).filter(Boolean))];

  nameSelect.innerHTML = `<option value="">ทั้งหมด (All Products)</option>` + 
    names.map(n => `<option value="${n}" ${n === currentName ? 'selected' : ''}>${n}</option>`).join('');

  lotSelect.innerHTML = `<option value="">ทั้งหมด (All Lots)</option>` + 
    lots.map(l => `<option value="${l}" ${l === currentLot ? 'selected' : ''}>${l}</option>`).join('');
}

async function fetchRawHistoryForDropdowns() {
  try {
    const res = await fetch(`${API_URL}/history`);
    const data = await res.json();
    rawHistoryCache = data;
    populateHistoryDropdowns(data);
  } catch (e) {
    console.error(e);
  }
}

function resetHistoryFilters() {
  const nameSelect = document.getElementById('filterHistoryName');
  const lotSelect = document.getElementById('filterHistoryLot');
  const startDateInput = document.getElementById('filterStartDate');
  const endDateInput = document.getElementById('filterEndDate');

  if (nameSelect) nameSelect.value = '';
  if (lotSelect) lotSelect.value = '';
  if (startDateInput) startDateInput.value = '';
  if (endDateInput) endDateInput.value = '';

  fetchFilteredHistory();
}

function renderHistoryTable(data) {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  let totalQty = 0;
  let totalPrice = 0;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 15px;">ไม่พบประวัติการตัดสต็อกตามเงื่อนไขที่เลือก</td></tr>';
    const totalQtyEl = document.getElementById('totalCutQty');
    const totalValEl = document.getElementById('totalCutValue');
    if (totalQtyEl) totalQtyEl.innerText = '0 ชิ้น';
    if (totalValEl) totalValEl.innerText = '฿0';
    return;
  }

  data.forEach(item => {
    const qty = Number(item.qty_cut) || 0;
    const price = Number(item.selling_price) || 0;
    totalQty += qty;
    totalPrice += price * qty;

    const dateStr = item.created_at ? new Date(item.created_at).toLocaleString('th-TH') : '-';
    
    tbody.innerHTML += `
      <tr>
        <td>${dateStr}</td>
        <td><strong>${item.name || '-'}</strong> ${item.brand ? `(${item.brand})` : ''}</td>
        <td>${item.lot_no || '-'}</td>
        <td style="color: #e53e3e; font-weight: bold; text-align: center;">-${qty}</td>
        <td>฿${price.toLocaleString()}</td>
        <td>฿${(price * qty).toLocaleString()}</td>
      </tr>
    `;
  });

  const totalQtyEl = document.getElementById('totalCutQty');
  const totalValEl = document.getElementById('totalCutValue');
  if (totalQtyEl) totalQtyEl.innerText = `${totalQty} ชิ้น`;
  if (totalValEl) totalValEl.innerText = `฿${totalPrice.toLocaleString()}`;
}