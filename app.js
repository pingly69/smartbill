/**
 * app.js v3.0 — Trip1Day Approver (Batch 5 Flow)
 * Redesigned: Stable Batch 5 processing, auto-select all, fixed bottom bar.
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  LIFF_ID: '2009016720-pVeqpTCP',
  API_URL: 'https://script.google.com/macros/s/AKfycbzgiozlTEfJcN9pSH9cYtIabYNy_J7DyjyE0P6tMB8rkki-7kPbslsFw2qHOB1G5BGIUg/exec',
  PAGE_SIZE: 5
};

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  lineUid: null,
  approverName: null,
  transactions: [],
  selectedIds: new Set(),
  pendingAction: null  // 'APPROVED'|'REJECTED'
};

// ─── DOM REFS ────────────────────────────────────────────────────────────────
const els = {
  globalLoader:        document.getElementById('globalLoader'),
  loaderText:          document.getElementById('loaderText'),
  loginScreen:         document.getElementById('loginScreen'),
  setupForm:           document.getElementById('setupForm'),
  setupCodeInput:      document.getElementById('setupCodeInput'),
  btnSetup:            document.getElementById('btnSetup'),
  loginMessage:        document.getElementById('loginMessage'),
  dashboardScreen:     document.getElementById('dashboardScreen'),
  approverNameDisplay: document.getElementById('approverNameDisplay'),
  userAvatar:          document.getElementById('userAvatar'),
  transactionList:     document.getElementById('transactionList'),
  emptyState:          document.getElementById('emptyState'),
  btnRefreshEmpty:     document.getElementById('btnRefreshEmpty'),
  
  // Fixed Bottom Bar
  bottomBar:           document.getElementById('bottomBar'),
  selectedCountText:   document.getElementById('selectedCountText'),
  btnBulkReject:       document.getElementById('btnBulkReject'),
  btnBulkApprove:      document.getElementById('btnBulkApprove'),
  
  // Modal
  confirmModal:        document.getElementById('confirmModal'),
  modalTitle:          document.getElementById('modalTitle'),
  modalMessage:        document.getElementById('modalMessage'),
  btnModalCancel:      document.getElementById('btnModalCancel'),
  btnModalConfirm:     document.getElementById('btnModalConfirm')
};

// ─── LOADER ──────────────────────────────────────────────────────────────────
function showLoader(msg) {
  els.loaderText.textContent = msg || 'กำลังโหลด...';
  els.globalLoader.classList.add('active');
}
function hideLoader() {
  els.globalLoader.classList.remove('active');
}

// ─── API ─────────────────────────────────────────────────────────────────────
async function callApi(action, payload) {
  const body = JSON.stringify({ action, payload });
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body
  });
  const text = await res.text();
  return JSON.parse(text);
}

// ─── INIT ────────────────────────────────────────────────────────────────────
async function init() {
  showLoader('กำลังเชื่อมต่อระบบ...');
  callApi('ping', {}).catch(() => {});

  if (CONFIG.LIFF_ID === 'YOUR_LIFF_ID') {
    state.lineUid = 'Udummy1234567890';
    await checkLogin();
    return;
  }
  try {
    await liff.init({ liffId: CONFIG.LIFF_ID });
    if (!liff.isLoggedIn()) {
      liff.login();
    } else {
      const profile = await liff.getProfile();
      state.lineUid = profile.userId;
      els.userAvatar.src = profile.pictureUrl;
      els.userAvatar.classList.remove('hidden');
      await checkLogin();
    }
  } catch (err) {
    hideLoader();
    alert('ไม่สามารถเชื่อมต่อ LINE ได้');
  }
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────
async function checkLogin() {
  showLoader('กำลังตรวจสอบสิทธิ์...');
  const cached = sessionStorage.getItem('approverName');
  if (cached) {
    state.approverName = cached;
    showDashboard();
    return;
  }

  try {
    const res = await callApi('login', { lineUid: state.lineUid });
    if (res.status === 'success' && res.data.isLoggedIn) {
      state.approverName = res.data.approverName;
      sessionStorage.setItem('approverName', state.approverName);
      showDashboard();
    } else {
      hideLoader();
      els.loginScreen.classList.remove('hidden');
      els.setupForm.classList.remove('hidden');
    }
  } catch (err) {
    hideLoader();
    els.loginScreen.classList.remove('hidden');
    els.loginMessage.textContent = 'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่';
    els.loginMessage.classList.remove('hidden');
  }
}

els.btnSetup.addEventListener('click', async () => {
  const code = els.setupCodeInput.value.trim();
  if (!code) return;
  showLoader('กำลังยืนยันตัวตน...');
  try {
    const res = await callApi('login', { lineUid: state.lineUid, setupCode: code });
    if (res.status === 'success' && res.data.isLoggedIn) {
      state.approverName = res.data.approverName;
      sessionStorage.setItem('approverName', state.approverName);
      showDashboard();
    } else {
      hideLoader();
      els.loginMessage.textContent = res.message || 'รหัสไม่ถูกต้อง';
      els.loginMessage.classList.remove('hidden');
    }
  } catch (err) {
    hideLoader();
    els.loginMessage.textContent = 'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่';
    els.loginMessage.classList.remove('hidden');
  }
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function showDashboard() {
  els.loginScreen.classList.add('hidden');
  els.dashboardScreen.classList.remove('hidden');
  els.approverNameDisplay.textContent = state.approverName;
  fetchTop5Pending();
}

async function fetchTop5Pending() {
  showLoader('กำลังดึงข้อมูลรอบใหม่...');
  state.selectedIds.clear(); // Clear selections on new fetch
  
  try {
    const res = await callApi('getPendingApprovals', {
      approverName: state.approverName,
      offset: 0,
      limit: CONFIG.PAGE_SIZE
    });
    
    if (res.status === 'success') {
      state.transactions = res.data.items || [];
      renderCards();
    } else {
      alert('โหลดข้อมูลไม่ได้: ' + res.message);
    }
  } catch (err) {
    alert('เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่');
  } finally {
    hideLoader();
  }
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
function renderCards() {
  els.transactionList.innerHTML = '';
  
  if (state.transactions.length === 0) {
    els.emptyState.classList.remove('hidden');
    els.bottomBar.classList.add('hidden');
    return;
  }
  
  els.emptyState.classList.add('hidden');
  els.bottomBar.classList.remove('hidden');

  state.transactions.forEach(tx => {
    // Auto-select all by default
    state.selectedIds.add(String(tx.Transaction_ID));
    
    const card = createCard(tx);
    els.transactionList.appendChild(card);
  });
  
  updateBottomBar();
}

function createCard(tx) {
  const div = document.createElement('div');
  div.className = 'tx-card selected'; // Selected by default
  div.dataset.txId = String(tx.Transaction_ID);

  const dateStr  = tx.Req_Date ? new Date(tx.Req_Date).toLocaleDateString('th-TH') : '-';
  const netTotal = Number(tx.Net_Total || 0).toLocaleString();

  let detailsHtml = '';
  try {
    const trips = typeof tx.Trip_Details === 'string' ? JSON.parse(tx.Trip_Details) : tx.Trip_Details;
    if (Array.isArray(trips) && trips.length > 0) {
      detailsHtml = `<div class="trip-details">`;
      trips.forEach((t, idx) => {
        const km = Number(t.km || t.KM || 0).toLocaleString();
        detailsHtml += `
          <div class="trip-item">
            <span class="trip-num">${idx + 1}</span>
            <div class="trip-desc">
              <div>${t.from || t.From || ''} → ${t.to || t.To || ''}</div>
              <div class="trip-km">${km} กม.</div>
            </div>
          </div>`;
      });
      detailsHtml += `</div>`;
    }
  } catch (e) {}

  div.innerHTML = `
    <div class="card-main">
      <div class="card-top">
        <div class="card-name">${tx.Req_Name || '-'}</div>
        <div class="card-date">${dateStr}</div>
      </div>
      <div class="card-site"><i class="fa-solid fa-location-dot"></i> ${tx.Site_Name || '-'}</div>
      <div class="card-amount">฿${netTotal}</div>
      ${detailsHtml}
      
      <!-- Checkbox overlay -->
      <div class="card-checkbox"><i class="fa-solid fa-check"></i></div>
    </div>
  `;

  // Toggle selection on card click
  div.addEventListener('click', () => {
    const txId = div.dataset.txId;
    if (state.selectedIds.has(txId)) {
      state.selectedIds.delete(txId);
      div.classList.remove('selected');
    } else {
      state.selectedIds.add(txId);
      div.classList.add('selected');
    }
    updateBottomBar();
  });

  return div;
}

function updateBottomBar() {
  const count = state.selectedIds.size;
  els.selectedCountText.textContent = `เลือกแล้ว ${count} รายการ`;
  
  const hasSelection = count > 0;
  els.btnBulkApprove.disabled = !hasSelection;
  els.btnBulkReject.disabled = !hasSelection;
}

// ─── MODAL & ACTIONS ─────────────────────────────────────────────────────────
els.btnBulkApprove.addEventListener('click', () => openConfirmModal('APPROVED'));
els.btnBulkReject.addEventListener('click', () => openConfirmModal('REJECTED'));

function openConfirmModal(action) {
  state.pendingAction = action;
  const count = state.selectedIds.size;

  if (action === 'APPROVED') {
    els.modalTitle.textContent   = 'ยืนยันการอนุมัติ';
    els.modalTitle.style.color   = 'var(--primary-dark)';
    els.modalMessage.textContent = `อนุมัติค่าเดินทางทั้งหมด ${count} รายการ ใช่หรือไม่?`;
    els.btnModalConfirm.className = 'btn btn-success';
    els.btnModalConfirm.textContent = '✓ อนุมัติ';
  } else {
    els.modalTitle.textContent   = 'ยืนยันการไม่อนุมัติ';
    els.modalTitle.style.color   = 'var(--danger-color)';
    els.modalMessage.textContent = `ปฏิเสธค่าเดินทางทั้งหมด ${count} รายการ ใช่หรือไม่?`;
    els.btnModalConfirm.className = 'btn btn-danger';
    els.btnModalConfirm.textContent = '✗ ไม่อนุมัติ';
  }

  els.confirmModal.classList.remove('hidden');
  requestAnimationFrame(() => els.confirmModal.classList.add('active'));
}

function closeConfirmModal() {
  els.confirmModal.classList.remove('active');
  setTimeout(() => els.confirmModal.classList.add('hidden'), 200);
  state.pendingAction = null;
}

async function executeBatchAction() {
  const action = state.pendingAction;
  if (!action || state.selectedIds.size === 0) return;
  closeConfirmModal();

  showLoader(action === 'APPROVED' ? 'กำลังอนุมัติ...' : 'กำลังปฏิเสธ...');
  try {
    const res = await callApi('approveTransactions', {
      transactionIds: Array.from(state.selectedIds),
      approverName:   state.approverName,
      status:         action
    });
    
    if (res.status === 'success') {
      // Clear UI visually for a split second before re-fetching
      state.selectedIds.forEach(id => {
        const card = els.transactionList.querySelector(`[data-tx-id="${id}"]`);
        if (card) {
          card.style.opacity = '0';
          card.style.transform = 'scale(0.9)';
        }
      });
      
      // Fetch the next batch immediately
      setTimeout(() => fetchTop5Pending(), 300);
    } else {
      alert('เกิดข้อผิดพลาด: ' + res.message);
    }
  } catch (err) {
    alert('เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่');
  } finally {
    // Note: hideLoader() will be handled by fetchTop5Pending() if successful,
    // but in case of error, we should hide it here.
    if (!state.pendingAction) hideLoader(); 
  }
}

els.btnModalConfirm.addEventListener('click', executeBatchAction);
els.btnModalCancel.addEventListener('click',  closeConfirmModal);
els.confirmModal.addEventListener('click', (e) => {
  if (e.target === els.confirmModal) closeConfirmModal();
});
els.btnRefreshEmpty.addEventListener('click', fetchTop5Pending);

// ─── START ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
