const API_URL = 'https://magma-market-api.onrender.com/api';
let dbColumns = ['id', 'barcode', 'lotNo', 'brand', 'name', 'size', 'stock'];
let html5QrcodeScanner = null;
let currentImageData = '';
let lastSavedProduct = null;

document.addEventListener('DOMContentLoaded', () => {
  fetchProducts();
  fetchDatabaseTable();
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

async function fetchProducts() {
  try {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    renderProducts(products);
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

  container.innerHTML = products.map(item => `
    <div class="product-card" id="product-card-${item.id}">
      ${item.image ? `<img src="${item.image}" class="product-img" alt="Product">` : ''}
      <div class="product-info">
        <h3>${item.brand || 'ไม่ระบุยี่ห้อ'}</h3>
        <p><strong>ชื่อ:</strong> ${item.name || 'ไม่ระบุ'}</p>
        <p><strong>ล็อตสินค้า:</strong> <span style="color: #d35400; font-weight: bold;">${item.lotNo || '-'}</span></p>
        <p><strong>บาร์โค้ด:</strong> <code style="background: #eee; padding: 2px 4px; border-radius: 3px;">${item.barcode || '-'}</code></p>
        <p><strong>ขนาด:</strong> ${item.size || (item.volumeValue ? item.volumeValue + ' ' + item.volumeUnit : 'ไม่ได้ระบุ')}</p>
        <p><strong>คงเหลือ:</strong> <b style="color: #27ae60; font-size: 1.1rem;">${item.stock ?? 0}</b> ถุง</p>
      </div>
      <div style="margin-top: 15px; text-align: right;">
        <button class="btn-sm btn-print" onclick="printBarcode('${item.brand}', '${item.name}', '${item.barcode}', '${item.lotNo}')">🖨️ พิมพ์</button>
        <button class="btn-sm btn-stock" onclick="reduceStock('${item.id}', ${item.stock})">➖ ตัดสต็อก</button>
        <button class="btn-sm btn-delete" onclick="deleteProduct('${item.id}')">🗑️ ลบ</button>
      </div>
    </div>
  `).join('');
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
    height: 35,
    displayValue: true
  });

  window.print();
}

function toggleScanner() {
  const container = document.getElementById('reader-container');
  if (container.style.display === 'none') {
    container.style.display = 'block';
    html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 150 } });
    html5QrcodeScanner.render(onScanSuccess);
  } else {
    stopScanner();
  }
}

function stopScanner() {
  if (html5QrcodeScanner) html5QrcodeScanner.clear();
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
        alert(`🎯 สแกนเจอ: ${item.name} (Lot: ${item.lotNo || '-'}) -> ตัดสต็อกเรียบร้อย`);
      } else {
        alert(`⚠️ สินค้าหมดสต็อกแล้ว!`);
      }
    } else {
      alert(`❌ ไม่พบสินค้าบาร์โค้ดรหัส: ${decodedText}`);
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

    header.innerHTML = `<tr>${dbColumns.map(col => `<th>${col}</th>`).join('')}<th>Action</th></tr>`;

    if (!products || products.length === 0) {
      body.innerHTML = `<tr><td colspan="${dbColumns.length + 1}" style="text-align: center;">ไม่มีข้อมูลใน Database</td></tr>`;
      return;
    }

    body.innerHTML = products.map(row => `
      <tr>
        ${dbColumns.map(col => `<td>${row[col] !== undefined && row[col] !== null ? row[col] : '-'}</td>`).join('')}
        <td><button class="btn-sm btn-delete" onclick="deleteProduct('${row.id}')">🗑️ ลบถาวร</button></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function reduceStock(id, currentStock) {
  if (currentStock <= 0) return alert('สินค้าในสต็อกหมดแล้ว!');
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
  if (!confirm('ยืนยันการลบรายการนี้ออกจาก Database?')) return;
  try {
    const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.status === 'success') {
      fetchProducts();
      fetchDatabaseTable();
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการลบรายการ');
  }
}