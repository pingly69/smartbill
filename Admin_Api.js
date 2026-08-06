/**
 * Admin_Api.js - API Router for Approver System
 */

const AdminApi = {
  
  /**
   * Main POST handler
   */
  handlePost: function(e) {
    try {
      if (!e || !e.postData || !e.postData.contents) {
        throw new Error('No POST data received');
      }

      // Parse JSON from plain text payload (CORS bypass)
      const requestData = JSON.parse(e.postData.contents);
      const action = requestData.action;
      const payload = requestData.payload || {};

      let result;

      switch (action) {
        case 'login':
          result = AdminService.handleLogin(payload.lineUid, payload.setupCode);
          break;
        case 'getPendingApprovals':
          result = AdminService.getPendingApprovals(payload.approverName);
          break;
        case 'approveTransactions':
          result = AdminService.approveTransactions(payload.transactionIds, payload.approverName, payload.status);
          break;
        default:
          throw new Error('Invalid action: ' + action);
      }

      return this.successResponse(result);

    } catch (error) {
      Logger.log("API Error: " + error.toString());
      return this.errorResponse(error.message);
    }
  },

  successResponse: function(data) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: data
    })).setMimeType(ContentService.MimeType.JSON);
  },

  errorResponse: function(message) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: message
    })).setMimeType(ContentService.MimeType.JSON);
  }
};
