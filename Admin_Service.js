/**
 * Admin_Service.js - Business Logic Layer
 */

const AdminService = {
  
  /**
   * Handle login and setup code registration
   */
  handleLogin: function(lineUid, setupCode) {
    if (!lineUid) {
      throw new Error("LINE UID is required");
    }

    // Try to login with lineUid first
    let approver = AdminRepository.getApproverByLineUidOrCode(lineUid);
    
    if (approver) {
      return {
        isLoggedIn: true,
        approverName: approver.name
      };
    }

    // If not found by lineUid, check if they provided a valid setup code
    if (setupCode) {
      let codeApprover = AdminRepository.getApproverByLineUidOrCode(setupCode);
      if (codeApprover) {
        // Setup code valid! Burn it and replace with actual LINE UID
        AdminRepository.updateApproverLineUid(codeApprover.rowIndex, lineUid);
        
        // Clear cache so next login works properly
        const cache = CacheService.getScriptCache();
        cache.remove('APPROVER_' + setupCode);
        cache.remove('APPROVER_' + lineUid);
        
        return {
          isLoggedIn: true,
          approverName: codeApprover.name,
          message: "Registration successful"
        };
      }
    }

    // Not found
    return {
      isLoggedIn: false,
      message: "Unregistered LINE UID or invalid setup code"
    };
  },

  /**
   * Fetch pending approvals for the specific approver (server-side pagination)
   * @param {string} approverName - Name of the approver
   * @param {number} offset - How many records to skip (for pagination)
   * @param {number} limit  - Max records to return per page
   */
  getPendingApprovals: function(approverName, offset, limit) {
    if (!approverName) {
      throw new Error("Approver name is required");
    }
    
    const allPending = AdminRepository.getPendingTransactions(approverName);
    const safeOffset = Math.max(0, parseInt(offset) || 0);
    const safeLimit  = Math.min(20, Math.max(1, parseInt(limit) || 5)); // กำหนดหลังสุดไม่เกิน 20
    const page = allPending.slice(safeOffset, safeOffset + safeLimit);
    
    // We only return what is needed for the UI to save bandwidth
    return {
      total: allPending.length,
      offset: safeOffset,
      limit: safeLimit,
      hasMore: (safeOffset + safeLimit) < allPending.length,
      items: page.map(item => ({
        Transaction_ID: item.Transaction_ID,
        Req_Name: item.Req_Name,
        Plate_No: item.Plate_No || '',
        Site_Name: item.Site_Name || '',
        Req_Date: item.Req_Date,
        Travel_Purpose: item.Travel_Purpose || '',
        Trip_Details: item.Trip_Details, // Stringified JSON
        Total_KM: item.Total_KM || 0,
        Toll_Fee: item.Toll_Fee || 0,
        Park_Fee: item.Park_Fee || 0,
        Flat_Rate_Fee: item.Flat_Rate_Fee || 0,
        Net_Total: item.Net_Total || 0
      }))
    };
  },

  /**
   * Process approvals with Concurrency Control (LockService)
   */
  approveTransactions: function(transactionIds, approverName, status) {
    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      throw new Error("No transactions selected");
    }
    if (!approverName) throw new Error("Approver name is required");
    if (status !== 'APPROVED' && status !== 'REJECTED') {
      throw new Error("Invalid status");
    }

    // 1. Acquire Lock
    const lock = LockService.getScriptLock();
    const success = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    
    if (!success) {
      throw new Error("System is busy (locked by another process). Please try again later.");
    }

    try {
      // 2. Perform bulk update with double-check inside Repository
      const result = AdminRepository.bulkUpdateTransactionStatus(transactionIds, approverName, status);
      
      // 3. If any rows were updated, clear cache on main app
      if (result.processedCount > 0) {
        this.callClearTripCache();
      } else if (result.failedTransactions && result.failedTransactions.length > 0) {
        const details = result.failedTransactions.map(f => `${f.id}: ${f.reason}`).join('; ');
        throw new Error("ไม่สามารถอัปเดตได้ (" + details + ")");
      }
      
      return result;
      
    } finally {
      // 4. Always release lock
      lock.releaseLock();
    }
  },

  /**
   * Cross-App Cache Clearing
   * Calls the main GAS project to clear its cache so the requester sees the update immediately.
   */
  callClearTripCache: function(keyName) {
    const targetKey = keyName || 'TRANSACTIONS_ALL';
    const endpointUrl = CONFIG.CLEAR_CACHE_URL;
    
    if (!endpointUrl) {
      Logger.log("CLEAR_CACHE_URL is not configured.");
      return;
    }
    
    const payload = {
      action: "clearCache",
      data: {
        key: targetKey
      }
    };
    
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    try {
      const response = UrlFetchApp.fetch(endpointUrl, options);
      const result = JSON.parse(response.getContentText());
      
      if (result.status === 'success') {
        Logger.log("✅ Main system cache cleared successfully: " + result.message);
      } else {
        Logger.log("❌ Main system cache clear failed: " + result.message);
      }
    } catch (error) {
      Logger.log("❌ Error calling clear cache API: " + error.toString());
    }
  }
};
