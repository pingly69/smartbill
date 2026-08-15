function submitBill(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    // Upload image to Drive
    let fileUrl = "";
    if (payload.base64Image && payload.mimeType) {
      const folderId = Config.DRIVE_FOLDER_ID_BILLS;
      if (folderId) {
        const folder = DriveApp.getFolderById(folderId);
        const blob = Utilities.newBlob(Utilities.base64Decode(payload.base64Image), payload.mimeType, "Bill_" + new Date().getTime());
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fileUrl = file.getUrl();
      }
    }
    
    const preVat = parseNumber(payload.preVat);
    const vatAmount = parseNumber(payload.vatAmount);
    const totalAmount = preVat + vatAmount; // Backend calculation
    
    const recordId = "'" + new Date().getTime();
    
    const rowData = [
      new Date(), // A: Update_datetime
      "'" + (payload.taxId || ""), // B: Tax_id
      payload.sellerName || "", // C: Vend_name
      "'" + (payload.branchCode || "00000"), // D: Branch_no
      "'" + (payload.billNumber || ""), // E: Tax_docno
      formatDateToDDMMYYYY(payload.billDate), // F: doc_date
      preVat, // G: Amt
      vatAmount, // H: vat
      totalAmount, // I: Net
      payload.projectCode || "", // J: Project
      payload.expenseNote || "", // K: Remark
      fileUrl, // L: Pic_bill
      payload.lineEmail || "LIFF User", // M: users_name
      payload.requesterName || "", // N: Request_Name
      payload.lineUserId || "", // O: Line_UID
      recordId, // P: record_id
      payload.approve_request || "", // Q: approve_request
      "", // R: approve_userid
      "", // S: approve_datetime
      "pending", // T: status
      payload.reqType || "1", // U: req_type
      "" // V: pettycash_batch_id
    ];
    
    SheetRepo.appendRow(Config.SHEET_TAXDATA, rowData);
    
    return { success: true, data: "บันทึกสำเร็จ" };
    
  } catch (err) {
    Logger.log("submitBill Error: " + err.message);
    throw err;
  } finally {
    lock.releaseLock();
  }
}
