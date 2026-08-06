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
   * Fetch pending approvals for the specific approver
   */
  getPendingApprovals: function(approverName) {
    if (!approverName) {
      throw new Error("Approver name is required");
    }
    
    const pendingList = AdminRepository.getPendingTransactions(approverName);
    
    // We only return what is needed for the UI to save bandwidth
    return pendingList.map(item => ({
      Transaction_ID: item.Transaction_ID,
      Req_Name: item.Req_Name,
      Site_Name: item.Site_Name,
      Req_Date: item.Req_Date,
      Trip_Details: item.Trip_Details, // Stringified JSON
      Total_KM: item.Total_KM,
      Net_Total: item.Net_Total
    }));
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
      
      // 3. If any rows were updated, we must clear the cache on the main app
      if (result.processedCount > 0) {
        this.callClearTripCache();
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
