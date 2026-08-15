/**
 * สคริปต์สำหรับตั้งค่า Script Properties อัตโนมัติ
 * วิธีใช้:
 * 1. ใส่ GEMINI_API_KEY ของคุณในบรรทัดที่ระบุไว้
 * 2. เลือกฟังก์ชัน setupProperties จากแถบด้านบนใน Editor
 * 3. กดปุ่ม "เรียกใช้" (Run)
 * 4. หลังจากรันเสร็จ สามารถลบไฟล์นี้ทิ้งได้เลยเพื่อความปลอดภัย
 */
function setupProperties() {
  const properties = {
    'SPREADSHEET_ID': '1amztKC_QEVv9H7u6ubGCJYEHCHo0NWnJhT6ksNQCpnA',
    'SHEET_TAXDATA': 'TaxData',
    'SHEET_APPROVE_USERS': 'Approve_users',
    'SHEET_USERS_PROFILE': 'users_profile',
    'DRIVE_FOLDER_ID_BILLS': '1g6IiM2GUtwsI6vNJ2l0IMfgAjePGPGbs',
    
    // ⚠️ ใส่ API Key ของคุณตรงนี้ (เอาเครื่องหมาย ... ออกแล้ววางคีย์)
    'GEMINI_API_KEY': 'ใส่คีย์_GEMINI_API_KEY_ที่นี่',
    
    'GEMINI_MODEL': 'gemini-3.1-flash-lite',
    'EMAIL_BACKUP_RECIPIENT': 'pingly69@outlook.com',
    'DAYS_TO_KEEP': '14'
  };

  // บันทึกค่าทั้งหมดลง Script Properties
  PropertiesService.getScriptProperties().setProperties(properties);
  
  Logger.log("ตั้งค่า Script Properties สำเร็จแล้ว! คุณสามารถไปตรวจสอบที่ไอคอนฟันเฟืองได้เลยครับ");
}
