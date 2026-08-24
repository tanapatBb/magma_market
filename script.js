const API_URL = 'https://magma-market-api.onrender.com/api';
let dbColumns = ['id', 'barcode', 'lotNo', 'brand', 'name', 'importDate', 'expiryDate', 'size', 'stock'];
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

// ฟังก์ชันเพิ่มวันหมดอายุทางลัด (+3, +6, +12 เดือน)
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
    return { text: `หมดอายุแล้ว! (${Math.abs(diffDays)} วัน)`, color: '#e74c3c' };
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
    renderProducts(productsCache);
  } catch (err) {
    console.error(err);
  }
}

function renderProducts(products) {
  const container = document.getElementById('productList');
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = '<div class="empty-state">ยังไม่มีรายการสินค้าในระบบ</div>';
    return;
  }

  container.innerHTML = products.map(item => {
    const expStatus = getExpiryStatus(item.expiryDate);

    return `
      <div class="product-card" id="product-card-${item.id}">
        ${item.image ? `<img src="${item.image}" class="product-img" alt="Product">` : ''}
        <div class="product-info">
          <h3>${item.brand || 'ไม่ระบุยี่ห้อ'}</h3>
          <p><strong>ชื่อ:</strong> ${item.name || 'ไม่ระบุ'}</p>
          <p><strong>ล็อตสินค้า:</strong> <span style="color: #d35400; font-weight: bold;">${item.lotNo || '-'}</span></p>
          <p><strong>บาร์โค้ด:</strong> <code>${item.barcode || '-'}</code></p>
          
          <div class="exp-box">
            <p><strong>รับเข้า:</strong> ${item.importDate || 'ไม่ระบุ'}</p>
            <p><strong>หมดอายุ:</strong> ${item.expiryDate || 'ไม่ระบุ'}</p>
            <p style="font-weight: bold; color: ${expStatus.color}; margin-top: 4px;">
              ⏳ ${expStatus.text}
            </p>
          </div>

          <p><strong>ขนาด:</strong> ${item.size || (item.volumeValue ? item.volumeValue + ' ' + item.volumeUnit : 'ไม่ได้ระบุ')}</p>
          <p><strong>คงเหลือ:</strong> <b style="color: #27ae60; font-size: 1.1rem;">${item.stock ?? 0}</b> ถุง</p>
        </div>

        <div class="card-actions">
          <button class="btn-action btn-edit" onclick="openEditModal('${item.id}')">✏️ แก้ไข</button>
          <button class="btn-action btn-print" onclick="printBarcode('${item.brand}', '${item.name}', '${item.barcode}', '${item.lotNo}')">🖨️ พิมพ์</button>
          <button class="btn-action btn-stock" onclick="reduceStock('${item.id}', ${item.stock})">➖ ตัดสต็อก</button>
          <button class="btn-action btn-delete" onclick="deleteProduct('${item.id}')">🗑️ ลบ</button>
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
    volumeValue: document.getElementById('volumeValue').value,
    volumeUnit: document.getElementById('volumeUnit').value,
    stock: document.getElementById('stock').value,
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

async function onScanSuccess(decodedText) {
  stopScanner();
  try {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    const item = products.find(p => String(p.barcode) === String(decodedText));

    if (item) {
      if (item.stock > 0) {
        await reduceStock(item.id, item.stock);
        alert(`🎯 ตัดสต็อกเรียบร้อย: ${item.name}`);
      } else {
        alert(`⚠️ สินค้าหมดสต็อกแล้ว!`);
      }
    } else {
      alert(`❌ ไม่พบรหัสบาร์โค้ด: ${decodedText}`);
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการสแกน');
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

async function reduceStock(id, currentStock) {
  if (currentStock <= 0) return alert('สินค้าหมดสต็อก!');
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
  if (!confirm('ยืนยันการลบรายการนี้?')) return;
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