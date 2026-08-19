/**
 * ดึงรายชื่อผู้อนุมัติจากชีต Approve_users พร้อมระบบเซิร์ฟเวอร์แคช (10 นาที)
 * สำคัญ: ต้องกรองค่า "เงินสดย่อยรอตัด" ออกเสมอ ผู้ใช้ type1 ห้ามเลือกเองได้
 */
function getApproverList() {
  const cacheKey = "approver_list_v1";
  
  // 1. ลองอ่านจาก Cache ก่อน
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (cacheErr) {
    Logger.log("Cache get error (Approvers): " + cacheErr.message);
  }

  // 2. ถ้าไม่มีใน Cache ให้ไปอ่านจาก Google Sheet
  try {
    const sheet = SheetRepo.getSheet(Config.SHEET_APPROVE_USERS);
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const headers = data[0];
    const colIndex = headers.findIndex(h => (h || "").toString().trim() === 'approve_request');
    if (colIndex === -1) return [];
    
    let approvers = [];
    for (let i = 1; i < data.length; i++) {
      const name = (data[i][colIndex] !== null && data[i][colIndex] !== undefined)
        ? data[i][colIndex].toString().trim()
        : "";
      if (name && name !== "เงินสดย่อยรอตัด") {
        approvers.push(name);
      }
    }
    
    const uniqueApprovers = [...new Set(approvers)].filter(Boolean);

    // 3. บันทึกลง Cache 10 นาที (600 วินาที)
    try {
      const cache = CacheService.getScriptCache();
      cache.put(cacheKey, JSON.stringify(uniqueApprovers), 600);
    } catch (cacheErr) {
      Logger.log("Cache put error (Approvers): " + cacheErr.message);
    }

    return uniqueApprovers;
  } catch (err) {
    Logger.log("Error in getApproverList: " + err.message);
    return [];
  }
}

