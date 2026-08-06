/**
 * Admin_Repository.js - Data Access Layer (Google Sheets)
 */

const AdminRepository = {
  
  _getSpreadsheet: function() {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  },

  /**
   * Get approver data by LINE UID or Setup Code
   */
  getApproverByLineUidOrCode: function(uidOrCode) {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'APPROVER_' + uidOrCode;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const sheet = this._getSpreadsheet().getSheetByName(CONFIG.SHEETS.APPROVE_USERS);
    // BUG FIX #1b: ใช้ getLastRow() แทน getDataRange() เพื่อหลีกเลี่ยงการดึงข้อมูลบรรทัดว่างนับพัน
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null; // มีแค่ header หรือว่างเปล่า
    const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    const headers = data[0];
    const colName = headers.indexOf('approve_request');
    const colUid = headers.indexOf('line_uid');
    const colActive = headers.indexOf('Active');

    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue; // ข้ามแถวว่าง
      // BUG FIX #1a: Google Sheets อาจ return Active เป็น Boolean true หรือ String "TRUE"/"true"
      // ใช้ String() เพื่อ normalize ให้ match ได้ทุกกรณี
      const isActive = String(data[i][colActive]).toUpperCase() === 'TRUE';
      if (String(data[i][colUid]) === String(uidOrCode) && isActive) {
        const approverData = {
          name: data[i][colName],
          rowIndex: i + 1 // 1-based index
        };
        // Cache for 10 minutes
        cache.put(cacheKey, JSON.stringify(approverData), CONFIG.CACHE_TTL_SECONDS);
        return approverData;
      }
    }
    return null;
  },

  /**
   * Update the line_uid in Approve_users (for auto-burn setup code)
   */
  updateApproverLineUid: function(rowIndex, newLineUid) {
    const sheet = this._getSpreadsheet().getSheetByName(CONFIG.SHEETS.APPROVE_USERS);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colUid = headers.indexOf('line_uid') + 1; // 1-based
    
    sheet.getRange(rowIndex, colUid).setValue(newLineUid);
    SpreadsheetApp.flush();
  },

  /**
   * Helper for case-insensitive and trimmed header lookup
   */
  _findHeaderIdx: function(headers, name) {
    const target = String(name).trim().toLowerCase();
    return headers.findIndex(h => String(h).trim().toLowerCase() === target);
  },

  /**
   * Get all PENDING transactions for a specific approver
   */
  getPendingTransactions: function(approverName) {
    const sheet = this._getSpreadsheet().getSheetByName(CONFIG.SHEETS.TRANSACTIONS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    const headers = data[0];
    
    const idxStatus = this._findHeaderIdx(headers, 'Status');
    const idxApprover = this._findHeaderIdx(headers, 'Approver');
    
    if (idxStatus === -1 || idxApprover === -1) {
      Logger.log("Error: Column Status or Approver not found in Transactions sheet");
      return [];
    }
    
    const results = [];
    const targetApprover = String(approverName || '').trim();
    
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue; // Skip empty rows
      const row = data[i];
      const rowStatus = String(row[idxStatus] || '').trim().toUpperCase();
      const rowApprover = String(row[idxApprover] || '').trim();

      if (rowStatus === 'PENDING' && rowApprover === targetApprover) {
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = row[j];
        }
        results.push(obj);
      }
    }
    
    // Keep natural top-to-bottom sheet order
    return results;
  },

  /**
   * Bulk update transaction statuses
   * Note: This function assumes the caller has already acquired a Lock.
   */
  bulkUpdateTransactionStatus: function(transactionIds, approverName, newStatus) {
    const sheet = this._getSpreadsheet().getSheetByName(CONFIG.SHEETS.TRANSACTIONS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { processedCount: 0, failedTransactions: transactionIds.map(id => ({ id, reason: 'SHEET_EMPTY' })) };
    }

    const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    const headers = data[0];
    
    const idxId = this._findHeaderIdx(headers, 'Transaction_ID');
    const idxStatus = this._findHeaderIdx(headers, 'Status');
    const idxApprover = this._findHeaderIdx(headers, 'Approver');
    const idxApproveDatetime = this._findHeaderIdx(headers, 'Approve_Datetime');

    if (idxId === -1 || idxStatus === -1 || idxApprover === -1 || idxApproveDatetime === -1) {
      throw new Error(`Required columns not found in Transactions sheet: idxId=${idxId}, idxStatus=${idxStatus}, idxApprover=${idxApprover}, idxApproveDatetime=${idxApproveDatetime}`);
    }
    
    // Create an index map for O(1) lookup: Transaction_ID -> rowIndex (0-based array index)
    const txMap = new Map();
    for (let i = 1; i < data.length; i++) {
      if (data[i][idxId] !== undefined && data[i][idxId] !== null && data[i][idxId] !== '') {
        const cleanId = String(data[i][idxId]).trim();
        txMap.set(cleanId, i);
      }
    }
    
    let processedCount = 0;
    const now = new Date();
    const formattedDate = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    const targetApprover = String(approverName || '').trim();

    const failedIds = [];

    // Process each requested ID
    for (const txId of transactionIds) {
      const cleanTxId = String(txId).trim();
      const rowIndex = txMap.get(cleanTxId);

      if (rowIndex !== undefined) {
        const row = data[rowIndex];
        const rowStatus = String(row[idxStatus] || '').trim().toUpperCase();
        const rowApprover = String(row[idxApprover] || '').trim();
        
        // Double-check: Must still be PENDING and belong to this approver
        if (rowStatus === 'PENDING' && rowApprover === targetApprover) {
          // Direct sheet range update for maximum reliability
          sheet.getRange(rowIndex + 1, idxStatus + 1).setValue(newStatus);
          sheet.getRange(rowIndex + 1, idxApproveDatetime + 1).setValue(formattedDate);
          processedCount++;
        } else {
          // Already processed or wrong approver (Data Racing caught)
          failedIds.push({ id: txId, reason: `Status is ${rowStatus}, Approver is ${rowApprover}` });
        }
      } else {
        failedIds.push({ id: txId, reason: 'NOT_FOUND' });
      }
    }
    
    if (processedCount > 0) {
      SpreadsheetApp.flush();
    }
    
    return {
      processedCount: processedCount,
      failedTransactions: failedIds
    };
  }
};
