/**
 * app.js v2.0 — Trip1Day Approver
 * Redesigned: Per-card Approve/Reject buttons (no FAB, no bulk select)
 * Fixes: text selection, pointer-events, modal hidden bug
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
  totalCount: 0,
  serverOffset: 0,
  displayedCount: 0,
  pendingAction: null  // { txId, action: 'APPROVED'|'REJECTED' }
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
  loadMoreContainer:   document.getElementById('loadMoreContainer'),
  btnLoadMore:         document.getElementById('btnLoadMore'),
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

  // 🔥 GAS Warm-up: ping ก่อนล่วงหน้าขณะ LIFF init (ลด cold start)
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

  // ใช้ session cache ถ้ามี (ลด API call)
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

// Setup Code
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
  fetchTransactions();
}

async function fetchTransactions() {
  showLoader('กำลังดึงข้อมูล...');
  try {
    const res = await callApi('getPendingApprovals', {
      approverName: state.approverName,
      offset: 0,
      limit: CONFIG.PAGE_SIZE
    });
    if (res.status === 'success') {
      const pageData = res.data;
      state.transactions  = pageData.items;
      state.totalCount    = pageData.total;
      state.serverOffset  = pageData.items.length;
      state.displayedCount = 0;
      els.transactionList.innerHTML = '';
      renderNextBatch(pageData.hasMore);
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
function renderNextBatch(serverHasMore) {
  const start = state.displayedCount;
  const end   = Math.min(start + CONFIG.PAGE_SIZE, state.transactions.length);

  for (let i = start; i < end; i++) {
    els.transactionList.appendChild(createCard(state.transactions[i]));
  }
  state.displayedCount = end;

  const localHasMore  = state.displayedCount < state.transactions.length;
  const hasMore       = localHasMore || serverHasMore;

  // Empty state
  if (state.transactions.length === 0 && !serverHasMore) {
    els.emptyState.classList.remove('hidden');
  } else {
    els.emptyState.classList.add('hidden');
  }

  // Load more button
  if (hasMore) {
    els.loadMoreContainer.classList.remove('hidden');
    els.btnLoadMore.dataset.fetchServer = localHasMore ? '0' : '1';
  } else {
    els.loadMoreContainer.classList.add('hidden');
  }
}

function createCard(tx) {
  const div = document.createElement('div');
  div.className = 'tx-card';
  div.dataset.txId = String(tx.Transaction_ID);

  const dateStr  = tx.Req_Date ? new Date(tx.Req_Date).toLocaleDateString('th-TH') : '-';
  const netTotal = Number(tx.Net_Total || 0).toLocaleString();

  // Parse trip details
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
    </div>
    <div class="card-actions">
      <button class="btn-card-reject" data-tx-id="${tx.Transaction_ID}">
        <i class="fa-solid fa-xmark"></i><span>ไม่อนุมัติ</span>
      </button>
      <button class="btn-card-approve" data-tx-id="${tx.Transaction_ID}">
        <i class="fa-solid fa-check"></i><span>อนุมัติ</span>
      </button>
    </div>
  `;

  // Bind per-card buttons — no FAB, no bulk, no floating element
  div.querySelector('.btn-card-approve').addEventListener('click', (e) => {
    e.stopPropagation();
    openConfirmModal(String(tx.Transaction_ID), tx.Req_Name, 'APPROVED');
  });
  div.querySelector('.btn-card-reject').addEventListener('click', (e) => {
    e.stopPropagation();
    openConfirmModal(String(tx.Transaction_ID), tx.Req_Name, 'REJECTED');
  });

  return div;
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function openConfirmModal(txId, reqName, action) {
  state.pendingAction = { txId, action };

  if (action === 'APPROVED') {
    els.modalTitle.textContent   = 'ยืนยันการอนุมัติ';
    els.modalTitle.style.color   = 'var(--primary-dark)';
    els.modalMessage.textContent = `อนุมัติค่าเดินทางของ "${reqName}" ใช่หรือไม่?`;
    els.btnModalConfirm.className = 'btn btn-success';
    els.btnModalConfirm.textContent = '✓ อนุมัติ';
  } else {
    els.modalTitle.textContent   = 'ยืนยันการไม่อนุมัติ';
    els.modalTitle.style.color   = 'var(--danger-color)';
    els.modalMessage.textContent = `ปฏิเสธค่าเดินทางของ "${reqName}" ใช่หรือไม่?`;
    els.btnModalConfirm.className = 'btn btn-danger';
    els.btnModalConfirm.textContent = '✗ ไม่อนุมัติ';
  }

  // ต้อง remove hidden ก่อน แล้วค่อย add active
  els.confirmModal.classList.remove('hidden');
  requestAnimationFrame(() => els.confirmModal.classList.add('active'));
}

function closeConfirmModal() {
  els.confirmModal.classList.remove('active');
  setTimeout(() => els.confirmModal.classList.add('hidden'), 200); // รอ animation
  state.pendingAction = null;
}

async function executeAction() {
  const pending = state.pendingAction; // cache ก่อน close modal
  if (!pending) return;
  closeConfirmModal();

  showLoader(pending.action === 'APPROVED' ? 'กำลังอนุมัติ...' : 'กำลังปฏิเสธ...');
  try {
    const res = await callApi('approveTransactions', {
      transactionIds: [pending.txId],
      approverName:   state.approverName,
      status:         pending.action
    });
    if (res.status === 'success') {
      // ลบ card ออกจาก DOM และ state
      removeCardFromUI(pending.txId);
    } else {
      alert('เกิดข้อผิดพลาด: ' + res.message);
    }
  } catch (err) {
    alert('เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่');
  } finally {
    hideLoader();
  }
}

function removeCardFromUI(txId) {
  const card = els.transactionList.querySelector(`[data-tx-id="${txId}"]`);
  if (card) {
    card.classList.add('card-removing');
    setTimeout(() => {
      card.remove();
      state.transactions = state.transactions.filter(t => String(t.Transaction_ID) !== txId);
      state.displayedCount = Math.max(0, state.displayedCount - 1);
      state.totalCount = Math.max(0, state.totalCount - 1);

      if (els.transactionList.children.length === 0) {
        els.emptyState.classList.remove('hidden');
      }
    }, 300);
  }
}

// ─── LOAD MORE ───────────────────────────────────────────────────────────────
els.btnLoadMore.addEventListener('click', async () => {
  if (els.btnLoadMore.dataset.fetchServer === '1') {
    // ดึงจาก server
    try {
      showLoader('กำลังโหลดเพิ่มเติม...');
      const res = await callApi('getPendingApprovals', {
        approverName: state.approverName,
        offset: state.serverOffset,
        limit: CONFIG.PAGE_SIZE
      });
      if (res.status === 'success') {
        const pageData = res.data;
        state.transactions = state.transactions.concat(pageData.items);
        state.serverOffset += pageData.items.length;
        renderNextBatch(pageData.hasMore);
      }
    } catch (err) {
      alert('โหลดข้อมูลไม่ได้');
    } finally {
      hideLoader();
    }
  } else {
    renderNextBatch(false);
  }
});

// ─── EVENT BINDINGS ──────────────────────────────────────────────────────────
els.btnModalConfirm.addEventListener('click', executeAction);
els.btnModalCancel.addEventListener('click',  closeConfirmModal);

// ปิด modal เมื่อกด backdrop
els.confirmModal.addEventListener('click', (e) => {
  if (e.target === els.confirmModal) closeConfirmModal();
});

els.btnRefreshEmpty.addEventListener('click', fetchTransactions);

// ─── START ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
