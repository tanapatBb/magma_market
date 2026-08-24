const API_URL = 'https://magma-market-api.onrender.com/api';

document.addEventListener('DOMContentLoaded', fetchProducts);

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  document.getElementById(tabId).classList.add('active');
  event.currentTarget.classList.add('active');
}

// 📌 ดึงรายการสินค้าทั้งหมด
async function fetchProducts() {
  try {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();
    renderProducts(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    document.getElementById('productList').innerHTML = '<div class="empty-state">ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้</div>';
  }
}

// 📌 แสดงผลสต็อก + ปุ่มตัดสต็อก
function renderProducts(products) {
  const container = document.getElementById('productList');
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = '<div class="empty-state">ยังไม่มีรายการสินค้าในระบบ</div>';
    return;
  }

  container.innerHTML = products.map(item => `
    <div class="product-card" id="product-card-${item.id}">
      <div class="product-info">
        <h3>${item.brand || 'ไม่ระบุยี่ห้อ'}</h3>
        <p><strong>ชื่อ:</strong> ${item.name || 'ไม่ระบุ'}</p>
        <p><strong>ขนาด:</strong> ${item.size || (item.volumeValue ? item.volumeValue + ' ' + item.volumeUnit : 'ไม่ได้ระบุ')}</p>
        <p><strong>คงเหลือ:</strong> <b style="color: #27ae60; font-size: 1.1rem;">${item.stock ?? 0}</b> ถุง</p>
      </div>
      <div style="margin-top: 15px; text-align: right;">
        <button class="btn-sm btn-stock" onclick="reduceStock('${item.id}', ${item.stock})">➖ ตัดสต็อก (-1)</button>
        <button class="btn-sm btn-delete" onclick="deleteProduct('${item.id}')">🗑️ ลบ</button>
      </div>
    </div>
  `).join('');
}

// 📌 เพิ่มสินค้าเข้าสต็อก
async function handleAddProduct(event) {
  event.preventDefault();

  const productData = {
    brand: document.getElementById('brand').value,
    name: document.getElementById('name').value,
    volumeValue: document.getElementById('volumeValue').value,
    volumeUnit: document.getElementById('volumeUnit').value,
    stock: document.getElementById('stock').value
  };

  try {
    const res = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });

    const result = await res.json();
    if (result.status === 'success') {
      alert('เพิ่มสินค้าเข้าสต็อกเรียบร้อย!');
      document.getElementById('productForm').reset();
      fetchProducts();
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการบันทึก');
  }
}

// 📌 ตัดสต็อกสินค้า (-1)
async function reduceStock(id, currentStock) {
  if (currentStock <= 0) {
    alert('สินค้าในสต็อกหมดแล้ว!');
    return;
  }

  const newStock = currentStock - 1;

  try {
    const res = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: newStock })
    });

    const result = await res.json();
    if (result.status === 'success') {
      fetchProducts();
    }
  } catch (err) {
    alert('ไม่สามารถตัดสต็อกได้');
  }
}

// 📌 ลบสินค้า
async function deleteProduct(id) {
  if (!confirm('ยืนยันการลบรายการนี้ใช่หรือไม่?')) return;

  try {
    const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.status === 'success') fetchProducts();
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการลบรายการ');
  }
}

// 📌 จำลองฟังก์ชันจัดการตาราง Database
function editColumn(columnName) {
  alert(`เปิดการตั้งค่าคอลัมน์ "${columnName}" ใน Database`);
}

function addNewColumn() {
  const colName = prompt('ระบุชื่อคอลัมน์ใหม่ที่ต้องการเพิ่มใน Database:');
  if (colName) {
    alert(`เพิ่มคอลัมน์ "${colName}" เข้าตารางเรียบร้อยแล้ว`);
  }
}