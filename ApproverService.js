/**
 * ดึงรายชื่อผู้อนุมัติจากชีต Approve_users
 * สำคัญ: ต้องกรองค่า "เงินสดย่อยรอตัด" ออกเสมอ ผู้ใช้ type1 ห้ามเลือกเองได้
 */
function getApproverList() {
  try {
    const sheet = SheetRepo.getSheet(Config.SHEET_APPROVE_USERS);
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const headers = data[0];
    const colIndex = headers.indexOf('approve_request');
    if (colIndex === -1) return [];
    
    let approvers = [];
    for (let i = 1; i < data.length; i++) {
      const name = data[i][colIndex];
      if (name && name !== "เงินสดย่อยรอตัด") {
        approvers.push(name);
      }
    }
    
    // Remove duplicates
    return [...new Set(approvers)];
  } catch (err) {
    Logger.log("Error in getApproverList: " + err.message);
    return [];
  }
}
