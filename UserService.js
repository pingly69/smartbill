/**
 * จัดการข้อมูลโปรไฟล์ผู้ใช้ พร้อมระบบเซิร์ฟเวอร์แคช (10 นาที)
 */
function getUserProfile(lineUid) {
  if (!lineUid) return { found: false };
  const cleanUid = lineUid.toString().trim();
  const cacheKey = "user_profile_" + cleanUid;

  // 1. ลองอ่านจาก Cache ก่อน
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (cacheErr) {
    Logger.log("Cache get error (User Profile): " + cacheErr.message);
  }

  // 2. ถ้าไม่มีใน Cache ให้ไปอ่านจาก Google Sheet
  try {
    const record = SheetRepo.findRowByValue(Config.SHEET_USERS_PROFILE, 'line_uid', cleanUid);
    let result = { found: false };

    if (record) {
      const headers = record.headers.map(h => (h || "").toString().trim());
      const data = record.data;
      
      const getVal = (colName) => {
        const idx = headers.indexOf(colName);
        return idx !== -1 ? data[idx] : undefined;
      };
      
      result = {
        found: true,
        pettycash_control: getVal('pettycash_control'),
        pc_limit: getVal('pc.limit'),
        request_name: getVal('Request_Name'),
        emp_no: getVal('emp_no')
      };
    }

    // 3. บันทึกลง Cache 10 นาที (600 วินาที)
    try {
      const cache = CacheService.getScriptCache();
      cache.put(cacheKey, JSON.stringify(result), 600);
    } catch (cacheErr) {
      Logger.log("Cache put error (User Profile): " + cacheErr.message);
    }

    return result;
  } catch (err) {
    Logger.log("Error in getUserProfile: " + err.message);
    return { found: false, error: err.message };
  }
}

