const API_URL = 'https://magma-market-api.onrender.com/api';
let html5QrCode = null;
let currentImageData = '';
let lastSavedProduct = null;
let productsCache = [];
let myChart = null;

// Helper Function ดึงค่า Key แบบยืดหยุ่นสูงสุด ดักจับทุกรูปแบบชื่อฟิลด์
function getValue(obj, ...keys) {
  if (!obj) return null;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '' && obj[key] !== 'null') {
      return obj[key];
    }
  }
  return null;
}

document.addEventListener('DOMContentLoaded', () => {
  fetchProducts();
  fetchDatabaseTable();
  
  const today = new Date().toISOString().split('T')[0];
  const importInput = document.getElementById('importDate');
  if (importInput) importInput.value = today;
});

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  
  const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => {
    const onclickAttr = btn.getAttribute('onclick');
    return onclickAttr && onclickAttr.includes(tabId);
  });
  if (activeBtn) activeBtn.classList.add('active');

  if (tabId === 'database-tab') fetchDatabaseTable();
  if (tabId === 'dashboard-tab') renderDashboard();
}

function toggleAddForm() {
  const form = document.getElementById('addProductFormCard');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function previewImage(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      currentImageData = e.target.result;
      document.getElementById('imagePreview').src = currentImageData;
      document.getElementById('imagePreviewContainer').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

function calculateSellingPrice(isEdit = false) {
  const costId = isEdit ? 'editCostPrice' : 'costPrice';
  const marginId = isEdit ? 'editProfitMargin' : 'profitMargin';
  const sellingId = isEdit ? 'editSellingPrice' : 'sellingPrice';

  const cost = parseFloat(document.getElementById(costId).value) || 0;
  const margin = parseFloat(document.getElementById(marginId).value) || 0;

  if (cost > 0) {
    const sellingPrice = cost + (cost * (margin / 100));
    document.getElementById(sellingId).value = sellingPrice.toFixed(2);
  } else {
    document.getElementById(sellingId).value = '';
  }
}

function addMonthsToExpiry(months, isEdit = false) {
  const importInputId = isEdit ? 'editImportDate' : 'importDate';
  const expiryInputId = isEdit ? 'editExpiryDate' : 'expiryDate';
  
  const importVal = document.getElementById(importInputId).value;
  const baseDate = importVal ? new Date(importVal) : new Date();

  baseDate.setMonth(baseDate.getMonth() + months);
  document.getElementById(expiryInputId).value = baseDate.toISOString().split('T')[0];
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

async function fetchProducts() {
  try {
    const res = await fetch(`${API_URL}/products`);
    productsCache = await res.json();
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
  const keyword = document.getElementById('searchKeyword').value.toLowerCase();
  const selectedBrand = document.getElementById('filterBrandSelect').value;

  const filtered = productsCache.filter(item => {
    const matchName = (item.name || '').toLowerCase().includes(keyword) || (item.brand || '').toLowerCase().includes(keyword);
    const matchBrand = selectedBrand ? item.brand === selectedBrand : true;
    return matchName && matchBrand;
  });

  renderGroupedProducts(filtered);
}

// แสดงผล Card สินค้า (กรองสินค้าสต็อก 0 ออก)
function renderGroupedProducts(products) {
  const container = document.getElementById('productList');
  if (!container) return;

  // กรองเฉพาะรายการที่สต็อกมากกว่า 0 เท่านั้น
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
          <p style="font-size: 1rem; color: #2c3e50; font-weight: bold;">${group.name}</p>
          <p><strong>ขนาด:</strong> ${group.size || 'ไม่ระบุ'}</p>
          <p style="margin-top: 5px;"><strong>สต็อกรวม:</strong> <b style="color: #27ae60; font-size: 1.1rem;">${group.totalStock}</b> ชิ้น</p>

          <div class="lots-wrapper">
            <h4 style="font-size: 0.85rem; color: #7f8c8d; margin-bottom: 6px;">📦 ล็อตที่มีสินค้า (${group.lots.length} ล็อต):</h4>
            ${group.lots.map(lot => {
              const cost = getValue(lot, 'costPrice', 'cost_price', 'cost', 'costprice');
              const selling = getValue(lot, 'sellingPrice', 'selling_price', 'price', 'sellingprice');
              const margin = getValue(lot, 'profitMargin', 'profit_margin', 'profit') || 60;
              const expDate = getValue(lot, 'expiryDate', 'expiry_date', 'exp', 'expiry') || '-';
              const importDate = getValue(lot, 'importDate', 'import_date', 'import') || '-';
              const lotNo = getValue(lot, 'lotNo', 'lot_no', 'lot') || 'ไม่ระบุล็อต';

              const expStatus = getExpiryStatus(expDate);

              return `
                <div class="lot-item">
                  <div class="lot-header">
                    <span>🏷️ <b>${lotNo}</b> (บาร์โค้ด: <code>${lot.barcode}</code>)</span>
                    <span class="stock-badge">คงเหลือ ${lot.stock}</span>
                  </div>
                  
                  <div class="lot-details">
                    <p>💰 ทุน: <b>${cost ? cost + ' ฿' : '-'}</b> | ขาย: <b style="color:#27ae60">${selling ? selling + ' ฿' : '-'}</b> (${margin}%)</p>
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

  document.getElementById('totalCostVal').innerText = `${totalCost.toLocaleString('th-TH')} ฿`;
  document.getElementById('totalSellingVal').innerText = `${totalSelling.toLocaleString('th-TH')} ฿`;
  document.getElementById('totalProfitVal').innerText = `${profit.toLocaleString('th-TH')} ฿`;

  const ctx = document.getElementById('financialChart').getContext('2d');
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
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });

  const tbody = document.getElementById('dashboardTableBody');
  tbody.innerHTML = Object.keys(summaryMap).map(key => `
    <tr>
      <td><b>${key}</b></td>
      <td style="text-align:center;">${summaryMap[key].stock}</td>
      <td>${summaryMap[key].costTotal.toLocaleString()} ฿</td>
      <td style="color:#27ae60; font-weight:bold;">${summaryMap[key].sellingTotal.toLocaleString()} ฿</td>
    </tr>
  `).join('');
}

// ตาราง Database ดึงค่าแบบ Fallback ลึกที่สุด
async function fetchDatabaseTable() {
  try {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    const header = document.getElementById('dbTableHeader');
    const body = document.getElementById('dbTableBody');

    const headers = [
      'ID', 'Barcode', 'Lot No', 'Brand', 'Name', 
      'Cost Price', 'Profit (%)', 'Selling Price', 
      'Import Date', 'Expiry Date', 'Size', 'Stock', 'จัดการ'
    ];
    header.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

    if (!products || products.length === 0) {
      body.innerHTML = `<tr><td colspan="${headers.length}" style="text-align: center;">ไม่มีข้อมูล</td></tr>`;
      return;
    }

    body.innerHTML = products.map(row => {
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
          <td>${profitMargin ? profitMargin + '%' : '-'}</td>
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

function openEditModal(id) {
  const item = productsCache.find(p => String(p.id) === String(id));
  if (!item) return;

  document.getElementById('editId').value = item.id;
  document.getElementById('editBrand').value = item.brand || '';
  document.getElementById('editName').value = item.name || '';
  document.getElementById('editCostPrice').value = getValue(item, 'costPrice', 'cost_price', 'cost', 'costprice') || '';
  document.getElementById('editProfitMargin').value = getValue(item, 'profitMargin', 'profit_margin', 'profit') || 60;
  document.getElementById('editSellingPrice').value = getValue(item, 'sellingPrice', 'selling_price', 'price', 'sellingprice') || '';
  document.getElementById('editLotNo').value = getValue(item, 'lotNo', 'lot_no', 'lot') || '';
  document.getElementById('editStock').value = item.stock ?? 0;
  document.getElementById('editImportDate').value = getValue(item, 'importDate', 'import_date', 'import') || '';
  document.getElementById('editExpiryDate').value = getValue(item, 'expiryDate', 'expiry_date', 'exp', 'expiry') || '';
  document.getElementById('editSize').value = item.size || (item.volumeValue ? `${item.volumeValue} ${item.volumeUnit || ''}` : '');

  document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

async function handleUpdateProduct(event) {
  event.preventDefault();
  const id = document.getElementById('editId').value;

  const updateData = {
    brand: document.getElementById('editBrand').value,
    name: document.getElementById('editName').value,
    costPrice: Number(document.getElementById('editCostPrice').value),
    profitMargin: Number(document.getElementById('editProfitMargin').value),
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
    profitMargin: Number(document.getElementById('profitMargin').value),
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
      document.getElementById('importDate').value = today;

      document.getElementById('imagePreviewContainer').style.display = 'none';
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

function openBarcodeModal(product) {
  document.getElementById('modalBarcodeText').innerText = product.barcode;
  document.getElementById('modalLotText').innerText = getValue(product, 'lotNo', 'lot_no', 'lot') || '-';
  JsBarcode("#modalBarcodeCanvas", product.barcode, {
    format: "CODE128",
    width: 2,
    height: 40,
    displayValue: true
  });
  document.getElementById('barcodeModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('barcodeModal').style.display = 'none';
}

function triggerPrintFromModal() {
  if (lastSavedProduct) {
    printBarcode(lastSavedProduct.brand, lastSavedProduct.name, lastSavedProduct.barcode, getValue(lastSavedProduct, 'lotNo', 'lot_no', 'lot'));
  }
}

function printBarcode(brand, name, barcodeCode, lotNo) {
  document.getElementById('printBrand').innerText = brand || 'Magma Market';
  document.getElementById('printName').innerText = name || 'สินค้า';
  document.getElementById('printLot').innerText = `LOT: ${lotNo || '-'}`;

  JsBarcode("#barcodeCanvas", barcodeCode, {
    format: "CODE128",
    width: 2,
    height: 50,
    displayValue: true,
    fontSize: 14,
    margin: 0
  });

  setTimeout(() => {
    window.print();
  }, 100);
}

async function toggleScanner() {
  const container = document.getElementById('reader-container');
  if (container.style.display === 'none') {
    container.style.display = 'block';
    
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("reader");
    }

    const qrboxFunction = function(viewfinderWidth, viewfinderHeight) {
      return {
        width: Math.min(viewfinderWidth * 0.8, 250),
        height: 120
      };
    };

    const config = {
      fps: 20,
      qrbox: qrboxFunction,
      aspectRatio: 1.333333,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.UPC_A
      ]
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
  document.getElementById('reader-container').style.display = 'none';
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

        const confirmCut = confirm(`🎯 สแกนพบสินค้า!\n\nต้องการตัดสต็อก (-1) ของ:\n${productName}${lotText}\n\nคงเหลือปัจจุบัน: ${item.stock} ชิ้น หรือไม่?`);
        
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

async function reduceStockDirect(id, currentStock) {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stock: currentStock - 1 })
  });
  const result = await res.json();
  if (result.status === 'success') {
    fetchProducts();
    fetchDatabaseTable();
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
    const res = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: currentStock - 1 })
    });
    const result = await res.json();
    if (result.status === 'success') {
      fetchProducts();
      fetchDatabaseTable();
    }
  } catch (err) {
    alert('ไม่สามารถตัดสต็อกได้');
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