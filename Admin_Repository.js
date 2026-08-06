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
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const colName = headers.indexOf('approve_request');
    const colUid = headers.indexOf('line_uid');
    const colActive = headers.indexOf('Active');

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][colUid]) === String(uidOrCode) && data[i][colActive] === true) {
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
   * Get all PENDING transactions for a specific approver
   */
  getPendingTransactions: function(approverName) {
    const sheet = this._getSpreadsheet().getSheetByName(CONFIG.SHEETS.TRANSACTIONS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const idxStatus = headers.indexOf('Status');
    const idxApprover = headers.indexOf('Approver');
    
    const results = [];
    
    // Start from row 1 (skip headers)
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue; // Skip empty rows to improve performance
      const row = data[i];
      if (row[idxStatus] === 'PENDING' && row[idxApprover] === approverName) {
        // Map array to object based on headers
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = row[j];
        }
        results.push(obj);
      }
    }
    
    // Sort by Date descending (assuming newest first is better for approval)
    results.sort((a, b) => new Date(b.Req_Date) - new Date(a.Req_Date));
    
    return results;
  },

  /**
   * Bulk update transaction statuses
   * Note: This function assumes the caller has already acquired a Lock.
   */
  bulkUpdateTransactionStatus: function(transactionIds, approverName, newStatus) {
    const sheet = this._getSpreadsheet().getSheetByName(CONFIG.SHEETS.TRANSACTIONS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const idxId = headers.indexOf('Transaction_ID');
    const idxStatus = headers.indexOf('Status');
    const idxApprover = headers.indexOf('Approver');
    const idxApproveDatetime = headers.indexOf('Approve_Datetime');
    
    // Create an index map for O(1) lookup: Transaction_ID -> rowIndex (0-based array index)
    const txMap = new Map();
    for (let i = 1; i < data.length; i++) {
      txMap.set(data[i][idxId].toString(), i);
    }
    
    let processedCount = 0;
    const now = new Date();
    // Use the timezone from config for formatting if needed, but Date object is fine for Sheets
    const formattedDate = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss");

    const failedIds = [];

    // Process each requested ID
    for (const txId of transactionIds) {
      const rowIndex = txMap.get(txId.toString());
      if (rowIndex !== undefined) {
        const row = data[rowIndex];
        
        // Double-check: Must still be PENDING and belong to this approver
        if (row[idxStatus] === 'PENDING' && row[idxApprover] === approverName) {
          // Modify the array in memory
          data[rowIndex][idxStatus] = newStatus; // e.g., 'APPROVED' or 'REJECTED'
          data[rowIndex][idxApproveDatetime] = formattedDate;
          processedCount++;
        } else {
          // Already processed or wrong approver (Data Racing caught)
          failedIds.push({ id: txId, reason: 'ALREADY_PROCESSED_OR_INVALID' });
        }
      } else {
        failedIds.push({ id: txId, reason: 'NOT_FOUND' });
      }
    }
    
    // If any modifications were made, bulk write back to sheet
    if (processedCount > 0) {
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      SpreadsheetApp.flush();
    }
    
    return {
      processedCount: processedCount,
      failedTransactions: failedIds
    };
  }
};
