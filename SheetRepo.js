/**
 * Helper กลางสำหรับจัดการ Google Sheets
 */
const SheetRepo = {
  getSheet: function(sheetName) {
    if (!Config.SPREADSHEET_ID) throw new Error("SPREADSHEET_ID is not configured.");
    const ss = SpreadsheetApp.openById(Config.SPREADSHEET_ID);
    return ss.getSheetByName(sheetName);
  },

  appendRow: function(sheetName, rowData) {
    const sheet = this.getSheet(sheetName);
    if (!sheet) throw new Error("Sheet not found: " + sheetName);
    sheet.appendRow(rowData);
  },

  findRowByValue: function(sheetName, columnName, searchVal) {
    const sheet = this.getSheet(sheetName);
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return null; // Only header or empty
    const headers = data[0];
    const colIndex = headers.indexOf(columnName);
    if (colIndex === -1) return null;

    for (let i = 1; i < data.length; i++) {
      if (data[i][colIndex] == searchVal) { // use soft equality to match string/number
        return {
          rowIndex: i + 1,
          data: data[i],
          headers: headers
        };
      }
    }
    return null;
  }
};
