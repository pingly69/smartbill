/**
 * จัดการข้อมูลโปรไฟล์ผู้ใช้
 */
function getUserProfile(lineUid) {
  try {
    const record = SheetRepo.findRowByValue(Config.SHEET_USERS_PROFILE, 'line_uid', lineUid);
    if (record) {
      const headers = record.headers;
      const data = record.data;
      
      const getVal = (colName) => data[headers.indexOf(colName)];
      
      return {
        found: true,
        pettycash_control: getVal('pettycash_control'),
        pc_limit: getVal('pc.limit'),
        request_name: getVal('Request_Name'),
        emp_no: getVal('emp_no')
      };
    } else {
      return { found: false };
    }
  } catch (err) {
    Logger.log("Error in getUserProfile: " + err.message);
    return { found: false, error: err.message };
  }
}
