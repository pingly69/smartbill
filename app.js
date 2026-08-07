/**
 * app.js - Frontend Application Logic
 * Trip1Day Approver Mobile Web App (v20260807)
 */

// Configuration & Constants
const APP_CONFIG = {
  GAS_API_URL: 'https://script.google.com/macros/s/AKfycbzgiozlTEfJcN9pSH9cYtIabYNy_J7DyjyE0P6tMB8rkki-7kPbslsFw2qHOB1G5BGIUg/exec',
  LIFF_ID: '2009016720-pVeqpTCP',
  BATCH_SIZE: 5,
  REQUEST_TIMEOUT_MS: 30000
};

// Application State
const state = {
  lineUid: null,
  approverName: null,
  pendingItems: [],
  selectedTxIds: new Set(),
  totalPendingCount: 0
};

// DOM Elements
const elements = {
  approverNameDisplay: document.getElementById('approverNameDisplay'),
  loginSection: document.getElementById('loginSection'),
  setupCodeInput: document.getElementById('setupCodeInput'),
  loginError: document.getElementById('loginError'),
  btnLogin: document.getElementById('btnLogin'),
  queueSection: document.getElementById('queueSection'),
  cardsContainer: document.getElementById('cardsContainer'),
  emptyState: document.getElementById('emptyState'),
  selectAllCheckbox: document.getElementById('selectAllCheckbox'),
  queueBadge: document.getElementById('queueBadge'),
  actionBar: document.getElementById('actionBar'),
  selectedCount: document.getElementById('selectedCount'),
  selectedAmount: document.getElementById('selectedAmount'),
  btnApprove: document.getElementById('btnApprove'),
  btnReject: document.getElementById('btnReject'),
  btnRefresh: document.getElementById('btnRefresh'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  loadingMessage: document.getElementById('loadingMessage'),
  loadingSubtext: document.getElementById('loadingSubtext')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await initLiff();
});

function setupEventListeners() {
  elements.btnLogin.addEventListener('click', handleLoginSubmit);
  elements.btnRefresh.addEventListener('click', () => loadPendingApprovals());
  elements.selectAllCheckbox.addEventListener('change', handleSelectAllToggle);
  elements.btnApprove.addEventListener('click', () => handleApprovalAction('APPROVED'));
  elements.btnReject.addEventListener('click', () => handleApprovalAction('REJECTED'));
}

/**
 * Initialize LINE LIFF SDK
 */
async function initLiff() {
  showLoading('กำลังเข้าสู่ระบบ...', 'กำลังเชื่อมต่อ LINE LIFF');
  try {
    if (window.liff && APP_CONFIG.LIFF_ID) {
      await liff.init({ liffId: APP_CONFIG.LIFF_ID });
      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        state.lineUid = profile.userId;
      } else {
        // Redirect to standard LINE Login on external browsers (Desktop/Notebook)
        liff.login({ redirectUri: window.location.href });
        return;
      }
    }
  } catch (err) {
    console.warn('LIFF init warning:', err);
  }

  // Fallback if LIFF SDK fails to load completely
  if (!state.lineUid) {
    state.lineUid = localStorage.getItem('TRIP1DAY_APPROVER_UID') || ('MOCK_UID_' + Math.floor(Math.random() * 1000));
    localStorage.setItem('TRIP1DAY_APPROVER_UID', state.lineUid);
  }

  // Attempt login with current LINE UID
  await attemptLogin(state.lineUid);
}

/**
 * API Fetch Helper with Timeout & Retry
 */
async function apiCall(action, payload = {}, retryCount = 1) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.REQUEST_TIMEOUT_MS);

  const requestBody = JSON.stringify({
    action: action,
    payload: payload
  });

  try {
    const response = await fetch(APP_CONFIG.GAS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // CORS Bypass header
      },
      body: requestBody,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    let data;

    try {
      data = JSON.parse(responseText);
    } catch (e) {
      // Anti-429 Retry Mechanism: Google returned HTML error instead of JSON
      if (retryCount > 0) {
        console.warn('Received non-JSON response, retrying in 2 seconds...');
        await new Promise(res => setTimeout(res, 2000));
        return await apiCall(action, payload, retryCount - 1);
      }
      throw new Error('ระบบไม่ตอบสนองเป็น JSON กรุณาลองใหม่อีกครั้ง');
    }

    if (data.status !== 'success') {
      throw new Error(data.message || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
    }

    return data.data;

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('การเชื่อมต่อหมดเวลา (Timeout 30s) กรุณาลองใหม่อีกครั้ง');
    }
    throw error;
  }
}

/**
 * Login flow (Checking LINE UID or Setup Code)
 */
async function attemptLogin(lineUid, setupCode = null) {
  showLoading('ตรวจสอบสิทธิ์ใช้งาน...', 'โปรดรอสักครู่');
  elements.loginError.classList.add('hidden');

  try {
    const res = await apiCall('login', { lineUid, setupCode });

    if (res.isLoggedIn) {
      state.approverName = res.approverName;
      elements.approverNameDisplay.textContent = `ผู้อนุมัติ: ${state.approverName}`;
      elements.loginSection.classList.add('hidden');
      elements.queueSection.classList.remove('hidden');
      elements.actionBar.classList.remove('hidden');

      // Load initial batch of 5 items
      await loadPendingApprovals();
    } else {
      elements.loginSection.classList.remove('hidden');
      elements.queueSection.classList.add('hidden');
      elements.actionBar.classList.add('hidden');
      hideLoading();

      if (setupCode) {
        showLoginError('รหัสยืนยันตัวตนไม่ถูกต้อง หรือถูกใช้งานไปแล้ว');
      }
    }
  } catch (err) {
    hideLoading();
    showLoginError(err.message || 'ไม่สามารถเชื่อมต่อระบบได้');
  }
}

async function handleLoginSubmit() {
  const code = elements.setupCodeInput.value.trim();
  if (!code) {
    showLoginError('กรุณากรอกรหัสยืนยันตัวตน');
    return;
  }
  await attemptLogin(state.lineUid, code);
}

function showLoginError(msg) {
  elements.loginError.textContent = msg;
  elements.loginError.classList.remove('hidden');
}

/**
 * Fetch Pending Approvals (Limit = 5)
 */
async function loadPendingApprovals() {
  showLoading('กำลังโหลดรายการรออนุมัติ...', 'ดึงข้อมูลเรียงตาม Sheet');
  state.selectedTxIds.clear();
  elements.selectAllCheckbox.checked = false;

  try {
    const res = await apiCall('getPendingApprovals', {
      approverName: state.approverName,
      offset: 0,
      limit: APP_CONFIG.BATCH_SIZE
    });

    state.pendingItems = res.items || [];
    state.totalPendingCount = res.total || 0;

    renderQueue();
    updateSummary();
  } catch (err) {
    alert('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message);
  } finally {
    hideLoading();
  }
}

/**
 * Parse & Format Trip_Details JSON
 */
function formatTripDetails(tripDetailsJson) {
  let trips = [];
  try {
    if (typeof tripDetailsJson === 'string') {
      trips = JSON.parse(tripDetailsJson);
    } else if (Array.isArray(tripDetailsJson)) {
      trips = tripDetailsJson;
    }
  } catch (e) {
    trips = [];
  }

  if (!Array.isArray(trips) || trips.length === 0) {
    return '<div class="trip-detail-item"><span class="trip-route-name">ไม่มีรายละเอียดเส้นทางย่อย</span></div>';
  }

  return trips.map((t, idx) => {
    const tripNo = t.trip_no || (idx + 1);
    const origin = t.origin || t.Origin || 'ต้นทาง';
    const dest = t.dest || t.destination || t.Destination || t.dest_name || 'ปลายทาง';
    const km = t.km || t.Distance_KM || t.distance || 0;
    const routeName = t.route_name || t.Route_Name || '';
    const isRoundTrip = (t.trip_type === 'ROUND_TRIP' || t.Trip_Type === 'ROUND_TRIP');
    const tripTypeBadge = isRoundTrip ? '🔁 ไป-กลับ' : '➡️ เที่ยวเดียว';

    return `
      <div class="trip-detail-item">
        <div class="trip-detail-header">
          <span class="trip-no-badge">จุดที่ ${tripNo}</span>
          <span class="trip-type-badge">${tripTypeBadge}</span>
          <span class="trip-km">${km} กม.</span>
        </div>
        ${routeName ? `<div class="trip-route-name">${escapeHtml(routeName)}</div>` : ''}
        <div class="trip-route-path">
          <span>📍 ${escapeHtml(origin)}</span>
          <span class="arrow">➔</span>
          <span>🏁 ${escapeHtml(dest)}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render Queue Cards
 */
function renderQueue() {
  elements.queueBadge.textContent = `รออนุมัติทั้งหมด ${state.totalPendingCount} รายการ`;
  elements.cardsContainer.innerHTML = '';

  if (state.pendingItems.length === 0) {
    elements.emptyState.classList.remove('hidden');
    elements.cardsContainer.classList.add('hidden');
    return;
  }

  elements.emptyState.classList.add('hidden');
  elements.cardsContainer.classList.remove('hidden');

  state.pendingItems.forEach(item => {
    const card = document.createElement('div');
    card.className = `trip-card ${state.selectedTxIds.has(item.Transaction_ID) ? 'selected' : ''}`;
    card.dataset.id = item.Transaction_ID;

    const tripDetailsHtml = formatTripDetails(item.Trip_Details);
    const netTotal = parseFloat(item.Net_Total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const reqDate = item.Req_Date ? new Date(item.Req_Date).toLocaleDateString('th-TH') : '-';

    const tollFee = parseFloat(item.Toll_Fee || 0);
    const parkFee = parseFloat(item.Park_Fee || 0);
    const flatRateFee = parseFloat(item.Flat_Rate_Fee || 0);
    
    let extraFeesText = [];
    if (flatRateFee > 0) extraFeesText.push(`ค่าใช้รถ: ฿${flatRateFee}`);
    if (tollFee > 0) extraFeesText.push(`ทางด่วน: ฿${tollFee}`);
    if (parkFee > 0) extraFeesText.push(`ที่จอด: ฿${parkFee}`);

    card.innerHTML = `
      <div class="card-top">
        <div class="card-select">
          <input type="checkbox" class="custom-checkbox card-checkbox" value="${item.Transaction_ID}" ${state.selectedTxIds.has(item.Transaction_ID) ? 'checked' : ''}>
        </div>
        <div class="card-main-info">
          <div class="req-header-row">
            <span class="req-name">${escapeHtml(item.Req_Name || 'ไม่ระบุชื่อ')}</span>
            ${item.Plate_No ? `<span class="plate-badge">🚘 ${escapeHtml(item.Plate_No)}</span>` : ''}
          </div>
          <div class="meta-row">
            <span class="site-badge">🏢 ${escapeHtml(item.Site_Name || 'ทั่วไป')}</span>
            <span>📅 ${reqDate}</span>
          </div>
        </div>
      </div>

      ${item.Travel_Purpose ? `
        <div class="purpose-box">
          <strong>🎯 วัตถุประสงค์:</strong> ${escapeHtml(item.Travel_Purpose)}
        </div>
      ` : ''}

      <div class="trip-details-box">
        ${tripDetailsHtml}
      </div>

      <div class="card-financials">
        <div class="fee-breakdown">
          <span><strong>ระยะทางรวม:</strong> ${item.Total_KM || 0} กม.</span>
          ${extraFeesText.length > 0 ? `<span>${extraFeesText.join(' | ')}</span>` : ''}
        </div>
        <div class="net-total-box">
          <div class="net-total-label">ยอดเบิกสุทธิ</div>
          <div class="net-total-value">฿${netTotal}</div>
        </div>
      </div>
    `;

    // Click handler for card selection
    const checkbox = card.querySelector('.card-checkbox');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      toggleSelectTx(item.Transaction_ID, checkbox.checked);
    });

    card.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        toggleSelectTx(item.Transaction_ID, checkbox.checked);
      }
    });

    elements.cardsContainer.appendChild(card);
  });
}

function toggleSelectTx(txId, isSelected) {
  if (isSelected) {
    state.selectedTxIds.add(txId);
  } else {
    state.selectedTxIds.delete(txId);
  }
  updateSummary();
  updateCardStyles();
}

function handleSelectAllToggle(e) {
  const isChecked = e.target.checked;
  state.pendingItems.forEach(item => {
    if (isChecked) {
      state.selectedTxIds.add(item.Transaction_ID);
    } else {
      state.selectedTxIds.delete(item.Transaction_ID);
    }
  });

  const checkboxes = document.querySelectorAll('.card-checkbox');
  checkboxes.forEach(cb => cb.checked = isChecked);

  updateSummary();
  updateCardStyles();
}

function updateCardStyles() {
  document.querySelectorAll('.trip-card').forEach(card => {
    const id = card.dataset.id;
    if (state.selectedTxIds.has(id)) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
}

function updateSummary() {
  const count = state.selectedTxIds.size;
  let totalAmount = 0;

  state.pendingItems.forEach(item => {
    if (state.selectedTxIds.has(item.Transaction_ID)) {
      totalAmount += parseFloat(item.Net_Total || 0);
    }
  });

  elements.selectedCount.textContent = count;
  elements.selectedAmount.textContent = '฿' + totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  elements.btnApprove.disabled = count === 0;
  elements.btnReject.disabled = count === 0;
}

/**
 * Handle Approval/Rejection in Batches of 5 (ชุดละ 5 รายการ)
 */
async function handleApprovalAction(status) {
  const selectedArray = Array.from(state.selectedTxIds);
  if (selectedArray.length === 0) return;

  const actionText = status === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ';
  if (!confirm(`คุณต้องการ ${actionText} รายการที่เลือกจำนวน ${selectedArray.length} รายการ หรือไม่?`)) {
    return;
  }

  // Chunk selected IDs into batches of max 5
  const chunks = [];
  for (let i = 0; i < selectedArray.length; i += APP_CONFIG.BATCH_SIZE) {
    chunks.push(selectedArray.slice(i, i + APP_CONFIG.BATCH_SIZE));
  }

  let totalProcessed = 0;
  let hasError = false;

  for (let cIndex = 0; cIndex < chunks.length; cIndex++) {
    const currentChunk = chunks[cIndex];
    showLoading(
      `กำลัง${actionText}ชุดที่ ${cIndex + 1}/${chunks.length} (${currentChunk.length} รายการ)...`,
      'กำลังอัปเดตลง Google Sheets และล้างแคช'
    );

    try {
      const res = await apiCall('approveTransactions', {
        transactionIds: currentChunk,
        approverName: state.approverName,
        status: status
      });

      totalProcessed += res.processedCount || 0;
    } catch (err) {
      hasError = true;
      alert(`เกิดข้อผิดพลาดในชุดที่ ${cIndex + 1}: ` + err.message);
      break;
    }
  }

  if (!hasError) {
    // Re-fetch remaining pending approvals automatically (next batch of 5)
    await loadPendingApprovals();
  } else {
    hideLoading();
  }
}

// Helpers
function showLoading(msg, subtext = 'โปรดรอสักครู่ ห้ามปิดหน้าจอ') {
  elements.loadingMessage.textContent = msg;
  elements.loadingSubtext.textContent = subtext;
  elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  elements.loadingOverlay.classList.add('hidden');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
