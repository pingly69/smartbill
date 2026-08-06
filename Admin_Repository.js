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
    const formattedDate = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss");

    const failedIds = [];
    const statusA1List = [];
    const dateA1List = [];
    
    // Helper to convert 0-based index to A, B, C...
    const getColLetter = (idx) => {
      let letter = '';
      let col = idx + 1;
      while (col > 0) {
        let temp = (col - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        col = (col - temp - 1) / 26;
      }
      return letter;
    };
    
    const statusCol = getColLetter(idxStatus);
    const dateCol = getColLetter(idxApproveDatetime);

    // Process each requested ID
    for (const txId of transactionIds) {
      const rowIndex = txMap.get(txId.toString());
      if (rowIndex !== undefined) {
        const row = data[rowIndex];
        
        // Double-check: Must still be PENDING and belong to this approver
        if (row[idxStatus] === 'PENDING' && row[idxApprover] === approverName) {
          statusA1List.push(statusCol + (rowIndex + 1));
          dateA1List.push(dateCol + (rowIndex + 1));
          processedCount++;
        } else {
          // Already processed or wrong approver (Data Racing caught)
          failedIds.push({ id: txId, reason: 'ALREADY_PROCESSED_OR_INVALID' });
        }
      } else {
        failedIds.push({ id: txId, reason: 'NOT_FOUND' });
      }
    }
    
    // Use RangeList for lightning fast batch updates (O(1) API call regardless of size)
    if (processedCount > 0) {
      sheet.getRangeList(statusA1List).setValue(newStatus);
      sheet.getRangeList(dateA1List).setValue(formattedDate);
      SpreadsheetApp.flush();
    }
    
    return {
      processedCount: processedCount,
      failedTransactions: failedIds
    };
  }
};
