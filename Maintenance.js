function dailyMaintenance() {
  const daysToKeep = Config.DAYS_TO_KEEP;
  const sheet = SheetRepo.getSheet(Config.SHEET_TAXDATA);
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;
  
  const backupSpreadsheetId = Config.SPREADSHEET_ID_BACKUP;
  if (!backupSpreadsheetId) {
    Logger.log("No backup spreadsheet ID configured.");
    return;
  }
  
  let backupSheet;
  try {
    const backupSs = SpreadsheetApp.openById(backupSpreadsheetId);
    backupSheet = backupSs.getSheetByName("TaxData");
    if (!backupSheet) {
      backupSheet = backupSs.insertSheet("TaxData");
    }
  } catch (e) {
    Logger.log("Error opening backup sheet: " + e);
    // If backup fails, return to prevent data loss on original sheet
    return;
  }
  
  // Create headers in backup sheet if it's empty
  if (backupSheet.getLastRow() === 0) {
    backupSheet.appendRow(data[0]);
  }
  
  const now = new Date();
  let rowsToDelete = [];
  let dataToBackup = [];
  
  for (let i = data.length - 1; i >= 1; i--) {
    const approveTimeStr = data[i][18]; // Col S is index 18 (approve_datetime)
    if (approveTimeStr && approveTimeStr !== "") {
      const approveTime = new Date(approveTimeStr);
      if (!isNaN(approveTime.getTime())) {
        const diffTime = Math.abs(now - approveTime);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays > daysToKeep) {
          rowsToDelete.push(i + 1); // 1-based index
          dataToBackup.push(data[i]);
        }
      }
    }
  }
  
  if (dataToBackup.length > 0) {
    // Reverse dataToBackup so it is in chronological order (since we iterated from bottom up)
    dataToBackup.reverse();
    
    // Append to backup sheet in bulk
    backupSheet.getRange(backupSheet.getLastRow() + 1, 1, dataToBackup.length, dataToBackup[0].length).setValues(dataToBackup);
  }
  
  // Delete from bottom up
  for (let i = 0; i < rowsToDelete.length; i++) {
    sheet.deleteRow(rowsToDelete[i]);
  }
}
