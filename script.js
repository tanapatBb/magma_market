const API_URL = 'https://magma-market-api.onrender.com/api';
let dbColumns = ['id', 'brand', 'name', 'size', 'stock', 'expDate'];

document.addEventListener('DOMContentLoaded', () => {
  fetchProducts();
  fetchDatabaseTable();
});

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  document.getElementById(tabId).classList.add('active');
  event.currentTarget.classList.add('active');

  if (tabId === 'database-tab') {
    fetchDatabaseTable();
  }
}

// 📌 1. ดึงรายการสินค้าทั้งหมดหน้าคลัง
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

// 📌 2. ดึงข้อมูลตาราง Database (Real-time Table)
async function fetchDatabaseTable() {
  try {
    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();

    const header = document.getElementById('dbTableHeader');
    const body = document.getElementById('dbTableBody');

    // สร้าง Header ของตารางตามคอลัมน์ที่มี
    header.innerHTML = `
      <tr>
        ${dbColumns.map(col => `
          <th>
            ${col} 
            ${col !== 'id' ? `<span class="col-header-action" onclick="editColumn('${col}')">✏️</span>` : ''}
          </th>
        `).join('')}
        <th>Action</th>
      </tr>
    `;

    // สร้างข้อมูลแต่ละแถว
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
    console.error('Database Fetch Error:', err);
  }
}

// 📌 3. เพิ่มสินค้าเข้าสต็อก
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
      alert('บันทึกข้อมูลลง Database เรียบร้อย!');
      document.getElementById('productForm').reset();
      fetchProducts();
      fetchDatabaseTable();
    }
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการบันทึก');
  }
}

// 📌 4. เพิ่มคอลัมน์ใหม่ใน Database
function addNewColumn() {
  const colName = prompt('ระบุชื่อคอลัมน์ใหม่ที่ต้องการเพิ่มในตาราง Database (ภาษาอังกฤษ):');
  if (colName && colName.trim() !== '') {
    const cleanColName = colName.trim();
    if (!dbColumns.includes(cleanColName)) {
      dbColumns.push(cleanColName);
      alert(`เพิ่มคอลัมน์ "${cleanColName}" เข้าตาราง Database เรียบร้อย!`);
      fetchDatabaseTable();
    } else {
      alert('มีคอลัมน์นี้อยู่ในตารางแล้ว');
    }
  }
}

// 📌 5. แก้ไขคอลัมน์
function editColumn(oldColName) {
  const newColName = prompt(`แก้ไขชื่อคอลัมน์ "${oldColName}" เป็น:`, oldColName);
  if (newColName && newColName.trim() !== '' && newColName !== oldColName) {
    const index = dbColumns.indexOf(oldColName);
    if (index !== -1) {
      dbColumns[index] = newColName.trim();
      alert(`อัปเดตชื่อคอลัมน์เรียบร้อย!`);
      fetchDatabaseTable();
    }
  }
}

// 📌 6. ตัดสต็อก
async function reduceStock(id, currentStock) {
  if (currentStock <= 0) {
    alert('สินค้าในสต็อกหมดแล้ว!');
    return;
  }

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

// 📌 7. ลบข้อมูล
async function deleteProduct(id) {
  if (!confirm('ยืนยันการลบรายการนี้ออกจาก Database ใช่หรือไม่?')) return;

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