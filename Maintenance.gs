function dailyMaintenance() {
  const daysToKeep = Config.DAYS_TO_KEEP;
  const sheet = SheetRepo.getSheet(Config.SHEET_TAXDATA);
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;
  
  const now = new Date();
  let rowsToDelete = [];
  
  for (let i = data.length - 1; i >= 1; i--) {
    const updateTime = new Date(data[i][0]); // Col A
    if (!isNaN(updateTime.getTime())) {
      const diffTime = Math.abs(now - updateTime);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      if (diffDays > daysToKeep) {
        rowsToDelete.push(i + 1); // 1-based index
      }
    }
  }
  
  // Delete from bottom up
  for (let i = 0; i < rowsToDelete.length; i++) {
    sheet.deleteRow(rowsToDelete[i]);
  }
}
