/**
 * app.js - Frontend Logic for Trip1Day Approver
 */

// Configuration
const CONFIG = {
    // ⚠️ Replace this with the URL you get after deploying your GAS backend
    API_URL: 'https://script.google.com/macros/s/AKfycbzgiozlTEfJcN9pSH9cYtIabYNy_J7DyjyE0P6tMB8rkki-7kPbslsFw2qHOB1G5BGIUg/exec',
    LIFF_ID: '2009016720-pVeqpTCP', // Same as backend
    API_TIMEOUT_MS: 30000, // 30 seconds
    PAGE_SIZE: 10
};

// State
const state = {
    lineUid: null,
    approverName: null,
    transactions: [],
    displayedCount: 0,
    selectedIds: new Set(),
    isProcessing: false,
    currentAction: null // 'APPROVED' or 'REJECTED'
};

// DOM Elements
const els = {
    loader: document.getElementById('globalLoader'),
    loaderText: document.getElementById('loaderText'),
    loginScreen: document.getElementById('loginScreen'),
    dashboardScreen: document.getElementById('dashboardScreen'),
    setupForm: document.getElementById('setupForm'),
    setupCodeInput: document.getElementById('setupCodeInput'),
    btnSetup: document.getElementById('btnSetup'),
    loginMessage: document.getElementById('loginMessage'),
    approverNameDisplay: document.getElementById('approverNameDisplay'),
    userAvatar: document.getElementById('userAvatar'),
    transactionList: document.getElementById('transactionList'),
    emptyState: document.getElementById('emptyState'),
    btnRefreshEmpty: document.getElementById('btnRefreshEmpty'),
    loadMoreContainer: document.getElementById('loadMoreContainer'),
    btnLoadMore: document.getElementById('btnLoadMore'),
    fabArea: document.getElementById('fabArea'),
    selectedCount: document.getElementById('selectedCount'),
    btnBulkApprove: document.getElementById('btnBulkApprove'),
    btnBulkReject: document.getElementById('btnBulkReject'),
    confirmModal: document.getElementById('confirmModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalMessage: document.getElementById('modalMessage'),
    btnModalCancel: document.getElementById('btnModalCancel'),
    btnModalConfirm: document.getElementById('btnModalConfirm')
};

/**
 * Initialize System
 */
async function init() {
    showLoader('กำลังเชื่อมต่อระบบ...');
    
    // In local dev without LIFF ID, we can mock it
    if (CONFIG.LIFF_ID === 'รอ update ใหม่') {
        alert("คำเตือน: ยังไม่ได้ใส่ LIFF ID\n(โปรดตั้งค่าใน app.js ตอนขึ้นระบบจริง)");
        // Mock Login for testing
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
        console.error("LIFF Init Error:", err);
        hideLoader();
        alert("ไม่สามารถเชื่อมต่อ LINE ได้");
    }
}

/**
 * Check Login Status with Backend
 */
async function checkLogin(setupCode = null) {
    showLoader('ตรวจสอบสิทธิ์...');
    
    try {
        // If we already have the name cached in session storage, skip API call (SA Rule)
        if (!setupCode) {
            const cachedName = sessionStorage.getItem('approverName');
            if (cachedName) {
                state.approverName = cachedName;
                showDashboard();
                return;
            }
        }

        const res = await callApi('login', { 
            lineUid: state.lineUid,
            setupCode: setupCode 
        });

        if (res.status === 'success' && res.data.isLoggedIn) {
            state.approverName = res.data.approverName;
            sessionStorage.setItem('approverName', state.approverName);
            showDashboard();
        } else {
            showLogin(res.message);
        }
    } catch (error) {
        showLogin("ข้อผิดพลาด: " + error.message);
    }
}

/**
 * Fetch Pending Transactions
 */
async function fetchTransactions() {
    showLoader('กำลังดึงข้อมูล...');
    try {
        const res = await callApi('getPendingApprovals', { approverName: state.approverName });
        if (res.status === 'success') {
            state.transactions = res.data;
            state.displayedCount = 0;
            state.selectedIds.clear();
            els.transactionList.innerHTML = '';
            updateFab();
            renderNextBatch();
        } else {
            alert("Error: " + res.message);
        }
    } catch (error) {
        alert("ข้อผิดพลาด: " + error.message);
    } finally {
        hideLoader();
    }
}

/**
 * Render Cards (Pagination / Lazy Load)
 */
function renderNextBatch() {
    const start = state.displayedCount;
    const end = Math.min(start + CONFIG.PAGE_SIZE, state.transactions.length);
    
    if (state.transactions.length === 0) {
        els.emptyState.classList.remove('hidden');
        els.loadMoreContainer.classList.add('hidden');
        return;
    }
    
    els.emptyState.classList.add('hidden');

    for (let i = start; i < end; i++) {
        const tx = state.transactions[i];
        const card = createCard(tx);
        els.transactionList.appendChild(card);
    }
    
    state.displayedCount = end;
    
    if (state.displayedCount < state.transactions.length) {
        els.loadMoreContainer.classList.remove('hidden');
    } else {
        els.loadMoreContainer.classList.add('hidden');
    }
}

function createCard(tx) {
    const div = document.createElement('div');
    div.className = 'tx-card';
    div.dataset.id = tx.Transaction_ID;
    
    // Parse Trip Details
    let detailsHtml = '';
    try {
        const details = JSON.parse(tx.Trip_Details);
        if (Array.isArray(details)) {
            detailsHtml = `<div class="card-details hidden">`;
            details.forEach((route, idx) => {
                const origin = route.origin || '-';
                const dest = route.dest || '-';
                const km = route.km || 0;
                const routeName = route.route_name || '-';
                const tripType = route.trip_type === 'ROUND_TRIP' ? '(ไป-กลับ)' : '(เที่ยวเดียว)';
                
                detailsHtml += `
                <div class="trip-route">
                    <div class="route-item"><span>จุดที่ ${idx+1}:</span> <strong>${origin} <i class="fa-solid fa-arrow-right" style="margin: 0 4px; font-size: 10px; opacity: 0.5;"></i> ${dest}</strong></div>
                    <div class="route-item"><span>เส้นทาง:</span> <span style="text-align:right; font-size: 12px; color: var(--text-muted);">${routeName} ${tripType}</span></div>
                    <div class="route-item" style="margin-top: 4px;"><span>ระยะทาง:</span> <strong>${km} กม.</strong></div>
                </div>`;
            });
            detailsHtml += `</div>`;
        }
    } catch(e) {
        detailsHtml = `<div class="card-details hidden"><p>ไม่สามารถแสดงรายละเอียดได้</p></div>`;
    }

    const dateStr = new Date(tx.Req_Date).toLocaleDateString('th-TH');
    const netTotal = Number(tx.Net_Total).toLocaleString();

    div.innerHTML = `
        <div class="card-checkbox">
            <input type="checkbox" class="custom-checkbox" value="${tx.Transaction_ID}">
        </div>
        <div class="card-content">
            <div class="card-header">
                <div class="req-name">${tx.Req_Name}</div>
                <div class="req-date">${dateStr}</div>
            </div>
            <div class="site-name"><i class="fa-solid fa-location-dot"></i> ${tx.Site_Name}</div>
            <div class="amount-display">
                <div class="net-total">฿${netTotal}</div>
                <div class="dist-total">ระยะทางรวม ${tx.Total_KM} กม.</div>
            </div>
            ${detailsHtml}
        </div>
    `;

    // Event Listeners
    const checkbox = div.querySelector('.custom-checkbox');
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            state.selectedIds.add(tx.Transaction_ID);
            div.classList.add('selected');
        } else {
            state.selectedIds.delete(tx.Transaction_ID);
            div.classList.remove('selected');
        }
        updateFab();
    });

    const contentArea = div.querySelector('.card-content');
    contentArea.addEventListener('click', () => {
        const detailsObj = div.querySelector('.card-details');
        if (detailsObj) {
            detailsObj.classList.toggle('hidden');
        }
    });

    return div;
}

function updateFab() {
    const count = state.selectedIds.size;
    els.selectedCount.textContent = `(${count})`;
    if (count > 0) {
        els.fabArea.classList.add('active');
    } else {
        els.fabArea.classList.remove('active');
    }
}

/**
 * Handle API Calls with AbortController, Retry, and Anti-CORS
 */
async function callApi(action, payload, retryCount = 0) {
    if (CONFIG.API_URL.includes('YOUR_GAS_DEPLOYMENT_ID')) {
        throw new Error("ยังไม่ได้ตั้งค่า API_URL ใน app.js");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            // Send as plain text to bypass CORS preflight
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify({ action, payload }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        
        const textResponse = await response.text();
        
        // Anti-429 & HTML Error Detection
        if (textResponse.trim().startsWith('<') || response.status === 429) {
            throw new Error("HTML_RESPONSE"); // Trigger retry
        }

        return JSON.parse(textResponse);

    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            throw new Error("การเชื่อมต่อหมดเวลา (Timeout 30s) กรุณาลองใหม่");
        }
        
        // Auto-Retry mechanism (Retry once after 2 seconds)
        if (error.message === "HTML_RESPONSE" || error.name === 'SyntaxError') {
            if (retryCount < 1) {
                console.log("GAS Server busy (Rate Limit). Retrying in 2 seconds...");
                await new Promise(resolve => setTimeout(resolve, 2000));
                return callApi(action, payload, retryCount + 1);
            } else {
                throw new Error("ระบบเซิร์ฟเวอร์ขัดข้อง (Google Service Error) กรุณาลองใหม่ในภายหลัง");
            }
        }
        
        throw error;
    }
}

/**
 * UI State Managers
 */
function showLoader(text) {
    els.loaderText.textContent = text;
    els.loader.classList.add('active');
    state.isProcessing = true;
}

function hideLoader() {
    els.loader.classList.remove('active');
    state.isProcessing = false;
}

function showLogin(msg = "") {
    hideLoader();
    els.loginScreen.classList.remove('hidden');
    els.dashboardScreen.classList.add('hidden');
    if (msg) {
        els.loginMessage.textContent = msg;
        els.loginMessage.classList.remove('hidden');
    }
}

function showDashboard() {
    els.loginScreen.classList.add('hidden');
    els.dashboardScreen.classList.remove('hidden');
    els.approverNameDisplay.textContent = state.approverName;
    fetchTransactions();
}

function openConfirmModal(action) {
    state.currentAction = action;
    const count = state.selectedIds.size;
    
    if (action === 'APPROVED') {
        els.modalTitle.textContent = "ยืนยันการอนุมัติ";
        els.modalTitle.style.color = "var(--primary-dark)";
        els.modalMessage.textContent = `คุณต้องการอนุมัติรายการที่เลือกจำนวน ${count} รายการ ใช่หรือไม่?`;
    } else {
        els.modalTitle.textContent = "ยืนยันการไม่อนุมัติ";
        els.modalTitle.style.color = "var(--danger-dark)";
        els.modalMessage.textContent = `คุณต้องการ "ปฏิเสธ" รายการที่เลือกจำนวน ${count} รายการ ใช่หรือไม่?`;
    }
    
    els.confirmModal.classList.add('active');
}

function closeConfirmModal() {
    els.confirmModal.classList.remove('active');
    state.currentAction = null;
}

async function executeAction() {
    if (state.selectedIds.size === 0 || !state.currentAction) return;
    
    const idsToProcess = Array.from(state.selectedIds);
    closeConfirmModal();
    showLoader('กำลังดำเนินการ...');

    try {
        const res = await callApi('approveTransactions', {
            transactionIds: idsToProcess,
            approverName: state.approverName,
            status: state.currentAction
        });

        if (res.status === 'success') {
            const data = res.data;
            let alertMsg = `✅ อัปเดตสำเร็จ ${data.processedCount} รายการ`;
            if (data.failedTransactions && data.failedTransactions.length > 0) {
                alertMsg += `\n❌ ไม่สำเร็จ ${data.failedTransactions.length} รายการ (สถานะอาจมีการเปลี่ยนแปลงไปแล้ว)`;
            }
            alert(alertMsg);
            // Refresh list
            fetchTransactions();
        } else {
            alert("Error: " + res.message);
            hideLoader();
        }
    } catch (error) {
        alert("ข้อผิดพลาด: " + error.message);
        hideLoader();
    }
}

/**
 * Event Listeners
 */
els.btnSetup.addEventListener('click', () => {
    const code = els.setupCodeInput.value.trim();
    if (!code) {
        els.loginMessage.textContent = "กรุณากรอกรหัสผ่าน";
        els.loginMessage.classList.remove('hidden');
        return;
    }
    checkLogin(code);
});

els.btnLoadMore.addEventListener('click', () => {
    renderNextBatch();
});

els.btnRefreshEmpty.addEventListener('click', () => {
    fetchTransactions();
});

els.btnBulkApprove.addEventListener('click', () => openConfirmModal('APPROVED'));
els.btnBulkReject.addEventListener('click', () => openConfirmModal('REJECTED'));

els.btnModalCancel.addEventListener('click', closeConfirmModal);
els.btnModalConfirm.addEventListener('click', executeAction);

// Start App
window.addEventListener('DOMContentLoaded', init);
