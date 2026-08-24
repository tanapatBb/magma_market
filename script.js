const API_URL = 'https://magma-market-api.onrender.com/api';
let dbColumns = ['id', 'barcode', 'brand', 'name', 'size', 'stock', 'expDate'];
let html5QrcodeScanner = null;
let currentImageData = '';

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

// 📌 1. ฟังก์ชันสร้างเลขบาร์โค้ด 6 หลักแบบสุ่ม
function generate6DigitBarcode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 📌 2. แสดงรูป Preview ตอนถ่าย/เลือกรูป
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

// 📌 3. ดึงรายการสินค้า
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
        <p><strong>บาร์โค้ด:</strong> <code style="background: #eee; padding: 2px 4px; border-radius: 3px;">${item.barcode || '-'}</code></p>
        <p><strong>ขนาด:</strong> ${item.size || (item.volumeValue ? item.volumeValue + ' ' + item.volumeUnit : 'ไม่ได้ระบุ')}</p>
        <p><strong>คงเหลือ:</strong> <b style="color: #27ae60; font-size: 1.1rem;">${item.stock ?? 0}</b> ถุง</p>
      </div>
      <div style="margin-top: 15px; text-align: right;">
        <button class="btn-sm btn-print" onclick="printBarcode('${item.brand}', '${item.name}', '${item.barcode}')">🖨️ พิมพ์บาร์โค้ด</button>
        <button class="btn-sm btn-stock" onclick="reduceStock('${item.id}', ${item.stock})">➖ ตัดสต็อก</button>
        <button class="btn-sm btn-delete" onclick="deleteProduct('${item.id}')">🗑️ ลบ</button>
      </div>
    </div>
  `).join('');
}

// 📌 4. เพิ่มสินค้าพร้อม บาร์โค้ด 6 หลัก และรูปถ่าย
async function handleAddProduct(event) {
  event.preventDefault();

  const barcode = generate6DigitBarcode();
  const productData = {
    barcode: barcode,
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
      alert(`บันทึกสำเร็จ! รหัสบาร์โค้ดสินค้าคือ: ${barcode}`);
      document.getElementById('productForm').reset();
      document.getElementById('imagePreviewContainer').style.display = 'none';
      currentImageData = '';
      fetchProducts();
      fetchDatabaseTable();
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการบันทึก');
  }
}

// 📌 5. สั่งพิมพ์บาร์โค้ดสติ๊กเกอร์ (57x33 mm)
function printBarcode(brand, name, barcodeCode) {
  const code = barcodeCode || generate6DigitBarcode();
  document.getElementById('printBrand').innerText = brand || 'Magma Market';
  document.getElementById('printName').innerText = name || 'สินค้า';

  JsBarcode("#barcodeCanvas", code, {
    format: "CODE128",
    width: 2,
    height: 40,
    displayValue: true
  });

  window.print();
}

function generateBarcodePreview() {
  const brand = document.getElementById('brand').value || 'ตัวอย่าง';
  const name = document.getElementById('name').value || 'สินค้า';
  printBarcode(brand, name, generate6DigitBarcode());
}

// 📌 6. ระบบสแกนกล้องเพื่อตัดสต็อกอัตโนมัติ
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
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear();
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
        await reduceStock(item.id, item.stock);
        alert(`🎯 สแกนเจอ: ${item.name} -> ตัดสต็อกเรียบร้อย (เหลือ ${item.stock - 1})`);
      } else {
        alert(`⚠️ สแกนเจอ: ${item.name} แต่สินค้าหมดสต็อกแล้ว!`);
      }
    } else {
      alert(`❌ ไม่พบสินค้าบาร์โค้ดรหัส: ${decodedText}`);
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการสแกน');
  }
}

// 📌 7. ดึงข้อมูล Real-time Database
async function fetchDatabaseTable() {
  try {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();

    const header = document.getElementById('dbTableHeader');
    const body = document.getElementById('dbTableBody');

    header.innerHTML = `
      <tr>
        ${dbColumns.map(col => `<th>${col}</th>`).join('')}
        <th>Action</th>
      </tr>
    `;

    if (!products || products.length === 0) {
      body.innerHTML = `<tr><td colspan="${dbColumns.length + 1}" style="text-align: center;">ไม่มีข้อมูลใน Database</td></tr>`;
      return;
    }

    body.innerHTML = products.map(row => `
      <tr>
        ${dbColumns.map(col => `<td>${row[col] !== undefined && row[col] !== null ? row[col] : '-'}</td>`).join('')}
        <td>
          <button class="btn-sm btn-delete" onclick="deleteProduct('${row.id}')">🗑️ ลบถาวร</button>
        </td>
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