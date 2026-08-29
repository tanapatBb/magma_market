// Config URL หลังบ้านบน Render
const API_BASE_URL = 'https://magma-market-api.onrender.com/api';

let allProducts = [];

// ==========================================
// 1. ระบบเริ่มต้นทำงาน (Initialization & Auto Polling)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // ดึงข้อมูลครั้งแรกทันทีที่เปิดหน้าเว็บ
  fetchProducts();
  fetchFilteredHistory();

  // ตั้งเวลา Auto Polling ดึงข้อมูลใหม่ทุกๆ 15 วินาที (ป้องกัน Render นอนหลับด้วย)
  setInterval(() => {
    fetchProducts();
    fetchFilteredHistory();
  }, 15000);
});

// ==========================================
// 2. ระบบสลับแท็บ (Tab Switching)
// ==========================================
function switchTab(tabId) {
  const tabs = document.querySelectorAll('.tab-content');
  const buttons = document.querySelectorAll('.tab-btn');

  tabs.forEach(tab => tab.style.display = 'none');
  buttons.forEach(btn => btn.classList.remove('active'));

  const activeTab = document.getElementById(tabId);
  if (activeTab) activeTab.style.display = 'block';

  // Hilight ปุ่มแท็บที่เลือก
  const activeButton = Array.from(buttons).find(b => b.getAttribute('onclick').includes(tabId));
  if (activeButton) activeButton.classList.add('active');

  // ถ้าสลับไปแท็บประวัติ ให้โหลดประวัติล่าสุึด
  if (tabId === 'history-tab') {
    fetchFilteredHistory();
  }
}

// ==========================================
// 3. จัดการสินค้า (Products API)
// ==========================================

// ดึงรายการสินค้าทั้งหมด
async function fetchProducts() {
  try {
    const res = await fetch(`${API_BASE_URL}/products`);
    if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลสินค้าได้");
    allProducts = await res.json();
    renderProductList(allProducts);
    renderDashboard(allProducts);
    renderDatabaseTable(allProducts);
  } catch (err) {
    console.error("Fetch Products Error:", err);
  }
}

// เพิ่มสินค้าใหม่
async function handleAddProduct(event) {
  event.preventDefault();

  const productData = {
    brand: document.getElementById('brand').value,
    name: document.getElementById('name').value,
    lotNo: document.getElementById('lotNo').value,
    volumeValue: document.getElementById('volumeValue').value,
    volumeUnit: document.getElementById('volumeUnit').value,
    costPrice: document.getElementById('costPrice').value,
    profitMargin: getSelectedProfitMargin(false),
    sellingPrice: document.getElementById('sellingPrice').value,
    stock: document.getElementById('stock').value,
    importDate: document.getElementById('importDate').value,
    expiryDate: document.getElementById('expiryDate').value,
    image: document.getElementById('imagePreview')?.src || ""
  };

  try {
    const res = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });

    if (!res.ok) throw new Error("บันทึกสินค้าล้มเหลว");

    alert("บันทึกสินค้าเรียบร้อยแล้ว!");
    document.getElementById('productForm').reset();
    toggleAddForm();
    fetchProducts();
  } catch (err) {
    alert("เกิดข้อผิดพลาดในการบันทึกสินค้า: " + err.message);
  }
}

// ตัดสต็อกสินค้า + บันทึกประวัติ (จุดสำคัญ)
async function reduceStock(productId, currentStock, qtyToCut = 1) {
  const newStock = Number(currentStock) - Number(qtyToCut);
  if (newStock < 0) {
    alert("สินค้าในสต็อกไม่เพียงพอ!");
    return;
  }

  const targetProduct = allProducts.find(p => p.id === productId);

  try {
    // 1. อัปเดตจำนวนสต็อกในตาราง products (PUT)
    const updateRes = await fetch(`${API_BASE_URL}/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: newStock })
    });

    if (!updateRes.ok) throw new Error("ไม่สามารถอัปเดตสต็อกได้");

    // 2. บันทึกประวัติลงตาราง stock_history (POST)
    if (targetProduct) {
      await fetch(`${API_BASE_URL}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: targetProduct.id,
          brand: targetProduct.brand,
          name: targetProduct.name,
          lotNo: targetProduct.lotNo || targetProduct.lot_no,
          barcode: targetProduct.barcode,
          sellingPrice: targetProduct.sellingPrice || targetProduct.selling_price,
          qtyCut: qtyToCut,
          remainingStock: newStock
        })
      });
    }

    alert("ตัดสต็อกและบันทึกประวัติสำเร็จ!");
    fetchProducts();
    fetchFilteredHistory();
  } catch (err) {
    console.error("Error reducing stock:", err);
    alert("เกิดข้อผิดพลาดในการตัดสต็อก: " + err.message);
  }
}

// ลบสินค้า
async function deleteProduct(productId) {
  if (!confirm("คุณต้องการลบสินค้ารายการนี้ใช่หรือไม่?")) return;

  try {
    const res = await fetch(`${API_BASE_URL}/products/${productId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error("ลบสินค้าล้มเหลว");

    alert("ลบรายการสินค้าเรียบร้อยแล้ว");
    fetchProducts();
  } catch (err) {
    alert("เกิดข้อผิดพลาดในการลบสินค้า: " + err.message);
  }
}

// ==========================================
// 4. ระบบประวัติการตัดสต็อก (Audit Log & Filter)
// ==========================================

async function fetchFilteredHistory() {
  const productInput = document.getElementById('filterProduct');
  const startDateInput = document.getElementById('filterStartDate');
  const endDateInput = document.getElementById('filterEndDate');

  const selectedProduct = productInput ? productInput.value.trim() : '';
  const startDate = startDateInput ? startDateInput.value : '';
  const endDate = endDateInput ? endDateInput.value : '';

  let url = `${API_BASE_URL}/history?`;
  if (selectedProduct) url += `productId=${encodeURIComponent(selectedProduct)}&`;
  if (startDate) url += `startDate=${encodeURIComponent(startDate)}&`;
  if (endDate) url += `endDate=${encodeURIComponent(endDate)}&`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("ดึงข้อมูลประวัติไม่สำเร็จ");
    const historyData = await res.json();
    renderHistoryTable(historyData);
  } catch (err) {
    console.error("Fetch History Error:", err);
  }
}

function renderHistoryTable(data) {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  let totalQty = 0;
  let totalPrice = 0;

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">ไม่พบข้อมูลประวัติการตัดสต็อก</td></tr>';
    updateHistorySummary(0, 0);
    return;
  }

  data.forEach(item => {
    const qty = Number(item.qty_cut) || 0;
    const price = Number(item.selling_price) || 0;
    const itemTotal = price * qty;

    totalQty += qty;
    totalPrice += itemTotal;

    const dateStr = item.created_at ? new Date(item.created_at).toLocaleString('th-TH') : '-';

    tbody.innerHTML += `
      <tr>
        <td>${dateStr}</td>
        <td><strong>${item.name || '-'}</strong> (${item.brand || 'ไม่ระบุ'})</td>
        <td>${item.lot_no || '-'}</td>
        <td style="text-align: center; color: #e53e3e; font-weight: bold;">-${qty}</td>
        <td>฿${price.toLocaleString()}</td>
        <td>฿${itemTotal.toLocaleString()}</td>
      </tr>
    `;
  });

  updateHistorySummary(totalQty, totalPrice);
}

function updateHistorySummary(qty, price) {
  const totalQtyEl = document.getElementById('totalCutQty');
  const totalValEl = document.getElementById('totalCutValue');

  if (totalQtyEl) totalQtyEl.innerText = `${qty} ชิ้น`;
  if (totalValEl) totalValEl.innerText = `฿${price.toLocaleString()}`;
}

// ==========================================
// 5. แสดงผลการ์ดและ UI หน้าจอ (Render Functions)
// ==========================================

function renderProductList(products) {
  const listContainer = document.getElementById('productList');
  if (!listContainer) return;
  listContainer.innerHTML = '';

  products.forEach(p => {
    listContainer.innerHTML += `
      <div class="card product-card">
        ${p.image ? `<img src="${p.image}" class="product-img">` : ''}
        <h3>${p.name}</h3>
        <p><strong>ยี่ห้อ:</strong> ${p.brand}</p>
        <p><strong>เลขล็อต:</strong> ${p.lotNo || p.lot_no}</p>
        <p><strong>ขนาด:</strong> ${p.size || '-'}</p>
        <p><strong>ราคาขาย:</strong> ฿${p.sellingPrice || p.selling_price}</p>
        <p><strong>คงเหลือ:</strong> <span class="stock-badge">${p.stock}</span> ชิ้น</p>
        
        <div class="card-actions" style="margin-top: 15px; display: flex; gap: 5px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-xs" onclick="reduceStock('${p.id}', ${p.stock}, 1)">➖ ตัดสต็อก (1)</button>
          <button class="btn btn-secondary btn-xs" onclick="showBarcodeModal('${p.barcode}', '${p.name}', '${p.brand}', '${p.lotNo || p.lot_no}')">🏷️ บาร์โค้ด</button>
          <button class="btn btn-danger btn-xs" onclick="deleteProduct('${p.id}')">🗑️ ลบ</button>
        </div>
      </div>
    `;
  });
}

function renderDashboard(products) {
  let totalCost = 0;
  let totalSelling = 0;

  products.forEach(p => {
    const stock = Number(p.stock) || 0;
    totalCost += (Number(p.costPrice || p.cost_price) || 0) * stock;
    totalSelling += (Number(p.sellingPrice || p.selling_price) || 0) * stock;
  });

  const costEl = document.getElementById('totalCostVal');
  const sellingEl = document.getElementById('totalSellingVal');
  const profitEl = document.getElementById('totalProfitVal');

  if (costEl) costEl.innerText = `฿${totalCost.toLocaleString()}`;
  if (sellingEl) sellingEl.innerText = `฿${totalSelling.toLocaleString()}`;
  if (profitEl) profitEl.innerText = `฿${(totalSelling - totalCost).toLocaleString()}`;
}

function renderDatabaseTable(products) {
  const tbody = document.getElementById('dbTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  products.forEach(p => {
    tbody.innerHTML += `
      <tr>
        <td>${p.id}</td>
        <td>${p.barcode}</td>
        <td>${p.brand}</td>
        <td>${p.name}</td>
        <td>${p.stock}</td>
        <td>฿${p.sellingPrice || p.selling_price}</td>
        <td>${p.importDate || p.import_date}</td>
      </tr>
    `;
  });
}

// ==========================================
// 6. Utility Functions (คำนวณราคา / รูปภาพ / Modal)
// ==========================================

function toggleAddForm() {
  const card = document.getElementById('addProductFormCard');
  if (card) {
    card.style.display = card.style.display === 'none' ? 'block' : 'none';
  }
}

function calculateSellingPrice(isEdit = false) {
  const prefix = isEdit ? 'edit' : '';
  const cost = parseFloat(document.getElementById(`${prefix}CostPrice`)?.value) || 0;
  const margin = getSelectedProfitMargin(isEdit);

  if (margin !== null) {
    const sellingPrice = cost * (1 + margin / 100);
    const sellingInput = document.getElementById(`${prefix}SellingPrice`);
    if (sellingInput) sellingInput.value = sellingPrice.toFixed(2);
  }
}

function getSelectedProfitMargin(isEdit = false) {
  const prefix = isEdit ? 'edit' : '';
  const select = document.getElementById(`${prefix}ProfitMargin`);
  if (!select) return 0;

  if (select.value === 'custom') {
    return parseFloat(document.getElementById(`${prefix}CustomProfitMargin`)?.value) || 0;
  }
  return select.value === 'none' ? 0 : parseFloat(select.value);
}

function previewImage(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('imagePreview');
      const container = document.getElementById('imagePreviewContainer');
      if (preview) preview.src = e.target.result;
      if (container) container.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

function showBarcodeModal(barcode, name, brand, lot) {
  const modal = document.getElementById('barcodeModal');
  if (modal) {
    document.getElementById('printBrand').innerText = brand;
    document.getElementById('printName').innerText = name;
    document.getElementById('printLot').innerText = `LOT: ${lot}`;
    document.getElementById('modalBarcodeText').innerText = barcode;
    
    JsBarcode("#modalBarcodeCanvas", barcode, { format: "CODE128", width: 2, height: 50 });
    modal.style.display = 'flex';
  }
}

function closeModal() {
  const modal = document.getElementById('barcodeModal');
  if (modal) modal.style.display = 'none';
}