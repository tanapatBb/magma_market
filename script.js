const API_URL = 'https://magma-market-api.onrender.com/api';
let dbColumns = ['id', 'barcode', 'lotNo', 'brand', 'name', 'costPrice', 'profitMargin', 'sellingPrice', 'importDate', 'expiryDate', 'size', 'stock'];
let html5QrCode = null;
let currentImageData = '';
let lastSavedProduct = null;
let productsCache = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchProducts();
  fetchDatabaseTable();
  
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('importDate').value = today;
});

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  event.currentTarget.classList.add('active');

  if (tabId === 'database-tab') fetchDatabaseTable();
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
  if (!expiryDateString) return { text: 'ไม่ระบุ', color: '#7f8c8d' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiryDateString);
  expiryDate.setHours(0, 0, 0, 0);

  const diffTime = expiryDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

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
    console.error(err);
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

function renderGroupedProducts(products) {
  const container = document.getElementById('productList');
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = '<div class="empty-state">ไม่พบรายการสินค้า</div>';
    return;
  }

  const groups = {};
  products.forEach(item => {
    const key = `${(item.brand || 'ไม่ระบุ').trim()}_${(item.name || 'ไม่ระบุ').trim()}`;
    if (!groups[key]) {
      groups[key] = {
        brand: item.brand,
        name: item.name,
        size: item.size || (item.volumeValue ? `${item.volumeValue} ${item.volumeUnit}` : ''),
        image: item.image,
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
          <p style="margin-top: 5px;"><strong>สต็อกรวมทุกล็อต:</strong> <b style="color: #27ae60; font-size: 1.1rem;">${group.totalStock}</b> ถุง</p>

          <div class="lots-wrapper">
            <h4 style="font-size: 0.85rem; color: #7f8c8d; margin-bottom: 6px;">📦 รายการแยกตามล็อต (${group.lots.length} ล็อต):</h4>
            ${group.lots.map(lot => {
              const expStatus = getExpiryStatus(lot.expiryDate);
              return `
                <div class="lot-item">
                  <div class="lot-header">
                    <span>🏷️ <b>${lot.lotNo || 'ไม่ระบุล็อต'}</b> (รหัส: <code>${lot.barcode}</code>)</span>
                    <span class="stock-badge">คงเหลือ ${lot.stock}</span>
                  </div>
                  
                  <div class="lot-details">
                    <p>💰 ทุน: ${lot.costPrice || '-'} | ขาย: <b style="color:#27ae60">${lot.sellingPrice || '-'} ฿</b> (${lot.profitMargin || 60}%)</p>
                    <p>📅 EXP: ${lot.expiryDate || '-'} <span style="color:${expStatus.color}; font-weight:bold;">(${expStatus.text})</span></p>
                  </div>

                  <div class="lot-actions">
                    <button class="btn-action btn-edit" onclick="openEditModal('${lot.id}')">✏️ แก้ไข</button>
                    <button class="btn-action btn-print" onclick="printBarcode('${lot.brand}', '${lot.name}', '${lot.barcode}', '${lot.lotNo}')">🖨️ พิมพ์</button>
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

function openEditModal(id) {
  const item = productsCache.find(p => String(p.id) === String(id));
  if (!item) return;

  document.getElementById('editId').value = item.id;
  document.getElementById('editBrand').value = item.brand || '';
  document.getElementById('editName').value = item.name || '';
  document.getElementById('editCostPrice').value = item.costPrice || '';
  document.getElementById('editProfitMargin').value = item.profitMargin || 60;
  document.getElementById('editSellingPrice').value = item.sellingPrice || '';
  document.getElementById('editLotNo').value = item.lotNo || '';
  document.getElementById('editStock').value = item.stock ?? 0;
  document.getElementById('editImportDate').value = item.importDate || '';
  document.getElementById('editExpiryDate').value = item.expiryDate || '';
  document.getElementById('editSize').value = item.size || (item.volumeValue ? `${item.volumeValue} ${item.volumeUnit}` : '');

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
  document.getElementById('modalLotText').innerText = product.lotNo || '-';
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
    printBarcode(lastSavedProduct.brand, lastSavedProduct.name, lastSavedProduct.barcode, lastSavedProduct.lotNo);
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
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess
      );

      setTimeout(() => {
        const scanRegion = document.getElementById('reader__scan_region');
        if (scanRegion && !document.querySelector('.scanner-laser')) {
          const laser = document.createElement('div');
          laser.className = 'scanner-laser';
          scanRegion.appendChild(laser);
        }
      }, 500);

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
  const laser = document.querySelector('.scanner-laser');
  if (laser) laser.remove();

  document.getElementById('reader-container').style.display = 'none';
}

// สแกนบาร์โค้ด + ขึ้น Pop-up ยืนยัน
async function onScanSuccess(decodedText) {
  stopScanner();
  try {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    const item = products.find(p => String(p.barcode) === String(decodedText));

    if (item) {
      if (item.stock > 0) {
        const productName = `${item.brand || ''} ${item.name || ''}`.trim();
        const lotText = item.lotNo ? ` (Lot: ${item.lotNo})` : '';

        // แสดง Pop-up ยืนยันชื่อสินค้า
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

// ฟังก์ชันช่วยตัดสต็อกหลังยืนยันจากหน้าสแกน
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

async function fetchDatabaseTable() {
  try {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    const header = document.getElementById('dbTableHeader');
    const body = document.getElementById('dbTableBody');

    header.innerHTML = `<tr>${dbColumns.map(col => `<th>${col}</th>`).join('')}<th>จัดการ</th></tr>`;

    if (!products || products.length === 0) {
      body.innerHTML = `<tr><td colspan="${dbColumns.length + 1}" style="text-align: center;">ไม่มีข้อมูล</td></tr>`;
      return;
    }

    body.innerHTML = products.map(row => `
      <tr>
        ${dbColumns.map(col => `<td>${row[col] !== undefined && row[col] !== null ? row[col] : '-'}</td>`).join('')}
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn-action btn-edit" onclick="openEditModal('${row.id}')">✏️</button>
            <button class="btn-action btn-delete" onclick="deleteProduct('${row.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

// กดปุ่ม - ตัดสต็อกหน้าเว็บ + ขึ้น Pop-up ยืนยัน
async function reduceStock(id, currentStock) {
  if (currentStock <= 0) return alert('⚠️ สินค้าล็อตนี้หมดสต็อกแล้ว!');

  const item = productsCache.find(p => String(p.id) === String(id));
  const productName = item ? `${item.brand || ''} ${item.name || ''}`.trim() : 'สินค้า';
  const lotText = item && item.lotNo ? ` (Lot: ${item.lotNo})` : '';

  // แสดง Pop-up ยืนยันชื่อสินค้า
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