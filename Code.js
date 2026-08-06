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
