function sendDailyBackupEmail() {
  const recipient = Config.EMAIL_BACKUP_RECIPIENT;
  if (!recipient) {
    Logger.log("No backup email recipient configured.");
    return;
  }
  
  const ss = SpreadsheetApp.openById(Config.SPREADSHEET_ID);
  
  const url = "https://docs.google.com/spreadsheets/d/" + Config.SPREADSHEET_ID + "/export?format=xlsx&portrait=false";
  
  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });
  
  const blob = response.getBlob().setName("SmartBill_Backup_" + Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd") + ".xlsx");
  
  MailApp.sendEmail({
    to: recipient,
    subject: "Daily Backup: SmartBill TaxData",
    body: "Please find the daily backup attached.",
    attachments: [blob]
  });
}
