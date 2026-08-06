/**
 * Code.js - Main Entry Point for Approver Backend API
 * Trip1Day Approver System
 */

/**
 * Handle GET requests (For basic testing or serving HTML if needed)
 * However, in this architecture, HTML is hosted on GitHub Pages.
 */
function doGet(e) {
  return ContentService.createTextOutput("Trip1Day Approver API is running.");
}

/**
 * Handle POST requests (Main API Router)
 * Used to bypass CORS and handle all backend logic.
 */
function doPost(e) {
  return AdminApi.handlePost(e);
}

/**
 * 🔍 DEBUG: รันฟังก์ชันนี้จาก GAS Editor โดยตรง (Run > debugCheckData)
 * เพื่อตรวจสอบว่า approverName และ Status ใน Transactions ตรงกันไหม
 */
function debugCheckData() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  // ตรวจ Approve_users
  const approveSheet = ss.getSheetByName(CONFIG.SHEETS.APPROVE_USERS);
  const approveData = approveSheet.getDataRange().getValues();
  Logger.log("=== Approve_users ===");
  for (let i = 1; i < approveData.length; i++) {
    if (!approveData[i][0]) continue;
    Logger.log(`Row ${i+1}: approve_request="${approveData[i][0]}" | line_uid="${approveData[i][2]}" | Active="${approveData[i][3]}" (type: ${typeof approveData[i][3]})`);
  }

  // ตรวจ Transactions
  const txSheet = ss.getSheetByName(CONFIG.SHEETS.TRANSACTIONS);
  const txData = txSheet.getDataRange().getValues();
  const headers = txData[0];
  const idxStatus   = headers.indexOf('Status');
  const idxApprover = headers.indexOf('Approver');
  Logger.log("\n=== Transactions (PENDING only) ===");
  let found = 0;
  for (let i = 1; i < txData.length; i++) {
    if (!txData[i][0]) continue;
    if (txData[i][idxStatus] === 'PENDING') {
      Logger.log(`Row ${i+1}: Approver="${txData[i][idxApprover]}" | Status="${txData[i][idxStatus]}"`);
      found++;
    }
  }
  Logger.log(`Total PENDING rows: ${found}`);
}
