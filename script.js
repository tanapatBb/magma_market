const API_URL = 'https://magma-market-api.onrender.com/api';
let globalProducts = [];

document.addEventListener('DOMContentLoaded', fetchProducts);

// 📌 สลับแท็บ
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  document.getElementById(tabId).classList.add('active');
  event.currentTarget.classList.add('active');
}

// 📌 1. ดึงรายการสินค้าทั้งหมด
async function fetchProducts() {
  try {
    const res = await fetch(`${API_URL}/products`);
    globalProducts = await res.json();
    renderProducts(globalProducts);
  } catch (err) {
    console.error('Error fetching products:', err);
    document.getElementById('productList').innerHTML = '<div class="empty-state">ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้</div>';
  }
}

// 📌 2. แสดงผลการ์ดสินค้า
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
        <h3>${item.brand && item.brand !== '-' ? item.brand : 'ไม่ระบุยี่ห้อ'}</h3>
        <p><strong>ชื่อ:</strong> ${item.name || 'ไม่ระบุ'}</p>
        <p><strong>ขนาด:</strong> ${item.size || (item.volumeValue ? item.volumeValue + ' ' + item.volumeUnit : 'ไม่ได้ระบุ')}</p>
        <p><strong>ราคา:</strong> ${item.price ? item.price + ' บาท' : 'ไม่ระบุ'}</p>
        <p><strong>คงเหลือ:</strong> ${item.stock ?? 0} ถุง</p>
        <p><strong>วันหมดอายุ:</strong> ${item.expDate || 'ไม่ระบุ'}</p>
      </div>
      <div style="margin-top: 15px; text-align: right;">
        <button class="btn-edit" onclick="prepareEdit('${item.id}')">✏️ แก้ไข</button>
        <button class="btn-delete" onclick="deleteProduct('${item.id}')">🗑️ ลบ</button>
      </div>
    </div>
  `).join('');
}

// 📌 3. ระบบ บันทึกใหม่ / แก้ไขสินค้า
async function handleFormSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('productId').value;
  const productData = {
    brand: document.getElementById('brand').value,
    name: document.getElementById('name').value,
    volumeValue: document.getElementById('volumeValue').value,
    volumeUnit: document.getElementById('volumeUnit').value,
    price: document.getElementById('price').value,
    stock: document.getElementById('stock').value,
    expDate: document.getElementById('expDate').value
  };

  const method = id ? 'PUT' : 'POST';
  const url = id ? `${API_URL}/products/${id}` : `${API_URL}/products`;

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });

    const result = await res.json();

    if (result.status === 'success') {
      alert(id ? 'อัปเดตข้อมูลสำเร็จ!' : 'เพิ่มสินค้าลง Database สำเร็จ!');
      resetForm();
      fetchProducts();
      // ย้ายกลับไปหน้าสต็อก
      document.querySelectorAll('.tab-btn')[0].click();
    } else {
      alert('เกิดข้อผิดพลาด: ' + result.message);
    }
  } catch (err) {
    console.error('Save Error:', err);
    alert('ไม่สามารถบันทึกข้อมูลได้');
  }
}

// 📌 4. ดึงข้อมูลสินค้ามาลงฟอร์มเพื่อเตรียมแก้ไข
function prepareEdit(id) {
  const item = globalProducts.find(p => String(p.id) === String(id));
  if (!item) return;

  document.getElementById('productId').value = item.id;
  document.getElementById('brand').value = item.brand || '';
  document.getElementById('name').value = item.name || '';
  document.getElementById('volumeValue').value = item.volumeValue || '';
  document.getElementById('volumeUnit').value = item.volumeUnit || 'kg';
  document.getElementById('price').value = item.price || '';
  document.getElementById('stock').value = item.stock || '';
  document.getElementById('expDate').value = item.expDate || '';

  document.getElementById('formTitle').innerText = '✏️ แก้ไขข้อมูลสินค้า';
  document.getElementById('submitBtn').innerText = '💾 บันทึกการแก้ไข';
  document.getElementById('cancelBtn').style.display = 'block';

  // สลับไปที่แท็บจัดการ
  document.querySelectorAll('.tab-btn')[1].click();
}

// 📌 5. เคลียร์ฟอร์ม
function resetForm() {
  document.getElementById('productForm').reset();
  document.getElementById('productId').value = '';
  document.getElementById('formTitle').innerText = '➕ เพิ่มสินค้าใหม่เข้าฐานข้อมูล';
  document.getElementById('submitBtn').innerText = '💾 บันทึกข้อมูลลง Database';
  document.getElementById('cancelBtn').style.display = 'none';
}

// 📌 6. ลบสินค้า
async function deleteProduct(id) {
  if (!confirm('ยืนยันการลบรายการนี้จาก Database ใช่หรือไม่?')) return;

  try {
    const res = await fetch(`${API_URL}/products/${id}`, { method: 'DELETE' });
    const result = await res.json();

    if (result.status === 'success') {
      fetchProducts();
    } else {
      alert('ลบไม่สำเร็จ: ' + result.message);
    }
  } catch (err) {
    console.error('Delete Error:', err);
    alert('เกิดข้อผิดพลาดในการลบรายการ');
  }
}