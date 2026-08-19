/**
 * Helper กลางสำหรับจัดการ Google Sheets
 */
const SheetRepo = {
  _ss: null,

  getSpreadsheet: function() {
    if (!this._ss) {
      if (!Config.SPREADSHEET_ID) throw new Error("SPREADSHEET_ID is not configured.");
      this._ss = SpreadsheetApp.openById(Config.SPREADSHEET_ID);
    }
    return this._ss;
  },

  getSheet: function(sheetName) {
    const ss = this.getSpreadsheet();
    return ss ? ss.getSheetByName(sheetName) : null;
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
    const colIndex = headers.findIndex(h => (h || "").toString().trim() === columnName);
    if (colIndex === -1) return null;

    const cleanSearch = (searchVal || "").toString().trim();
    for (let i = 1; i < data.length; i++) {
      const cellVal = (data[i][colIndex] !== null && data[i][colIndex] !== undefined)
        ? data[i][colIndex].toString().trim()
        : "";
      if (cellVal === cleanSearch) {
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

