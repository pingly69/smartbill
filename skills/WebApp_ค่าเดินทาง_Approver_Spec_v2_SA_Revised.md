# เอกสารข้อกำหนดระบบ (System Requirements Specification) — v2 (SA/DBA Revised)
**ชื่อโครงการ:** WebApp ค่าเดินทาง — Approver (ระบบอนุมัติรายการเบิกค่าเดินทาง)
**Platform:** LINE LIFF (Mobile-first Web App) + GitHub Pages + GAS
**วันที่จัดทำ:** สิงหาคม 2026 (ฉบับปรับปรุงโดย SA & DBA)
**สถานะ:** พร้อมส่งต่อให้ทีม Developer 

*📝 หมายเหตุจาก SA/DBA: เอกสารฉบับนี้ถูกปรับปรุงจาก v1 โดยเสริม "ภูมิคุ้มกัน" ทางด้านสถาปัตยกรรม (Resilience Architecture) จากบทเรียนของระบบผู้ขอเบิก เพื่อป้องกันปัญหาระบบล่ม (Error 429), การชนกันของข้อมูล (Data Racing), และปัญหา CORS/Network Timeout อย่างเด็ดขาด*

---

## 1. ภาพรวมของระบบ (Project Overview)
**วัตถุประสงค์:** สร้าง Web App แยกสำหรับ "ผู้อนุมัติ" (Approver) ใช้ดู/อนุมัติ/ไม่อนุมัติ รายการเบิกค่าเดินทาง (`Transactions`)
- ยืนยันตัวตนด้วย LINE UID (ลงทะเบียนด้วยรหัสผ่านในครั้งแรก)
- แสดงเฉพาะรายการที่ `Status = PENDING` และ `Approver` ตรงกับตัวเอง
- **[SA Added]** สถาปัตยกรรมแยกส่วน: Frontend วางบน GitHub Pages (HTML/JS/CSS ล้วน) และ Backend ใช้ Google Apps Script (GAS) 

---

## 2. โครงสร้างฐานข้อมูลที่ใช้ (Shared Google Sheets)
ใช้ Spreadsheet ตัวเดียวกับระบบหลัก ห้ามแก้โครงสร้างคอลัมน์เดิม 

### 2.1 Sheet: `Approve_users` (อ่าน + เขียน)
| Column | หมายเหตุ |
|---|---|
| `approve_request` | ชื่อผู้อนุมัติ (ใช้ Filter รายการ) |
| `line_uid` | เก็บ LINE UID (หรือรหัส Setup Code ชั่วคราว) |
| `Active` | กรองเฉพาะแถวที่ `TRUE` |

### 2.2 Sheet: `Transactions` (อ่าน + เขียน)
| Column | ใช้ทำอะไรในแอปนี้ |
|---|---|
| `Transaction_ID` | **Primary Key** ใช้อ้างอิงตอนอัปเดตสถานะ |
| `Req_Name`, `Site_Name`, `Req_Date` | ข้อมูลแสดงผลบน Card |
| `Trip_Details` | JSON String สำหรับแปลงเป็นรายละเอียดเส้นทาง |
| `Total_KM`, `Net_Total` | ตัวเลขยอดรวมและยอดสุทธิ (แสดงผลให้ชัดเจน) |
| `Approver` | ใช้กรองว่าเป็นของคนนี้หรือไม่ |
| `Status` | ดึงเฉพาะ `PENDING` และเขียนทับเป็น `APPROVED` / `REJECTED` |
| `Approve_Datetime` | บันทึกเวลาที่ทำการอนุมัติ (Timezone Asia/Bangkok) |

---

## 3. Flow การยืนยันตัวตนผู้อนุมัติ (Approver Authentication)
1. ดึง `lineUserId` ผ่าน `liff.init()`
2. ค้นหาใน `Approve_users` หากพบ `line_uid` ให้ถือว่า Login สำเร็จ
3. **การลงทะเบียนครั้งแรก:** ถ้าระบบเจอค่าในคอลัมน์ `line_uid` ตรงกับ "รหัสผ่านชั่วคราว" ที่ผู้ใช้กรอก ให้เขียนทับคอลัมน์นั้นด้วย `lineUserId` ทันที (ทำให้รหัสใช้ได้แค่ครั้งเดียวแบบ Auto-burn)
4. **[SA Rule]** เมื่อหาชื่อ `approve_request` เจอแล้ว ให้ Frontend เก็บ State ไว้ใน RAM ของเบราว์เซอร์ ห้ามยิง API ไปถามชื่อผู้อนุมัติซ้ำอีกตลอดการใช้งานในเซสชันนั้น

---

## 4. ข้อกำหนด UI/UX & Frontend Resilience (สำคัญมาก)

### 4.1 หน้าจอรายการรออนุมัติ (Approval Queue)
- **Pagination (Lazy Load):** แสดงทีละ `APPROVAL_BATCH_SIZE` (เช่น 4-10 รายการ) เพื่อไม่ให้โหลดหนักเกินไป
- **Card-Based:** ยอดเบิกสุทธิ (`Net_Total`) ต้องตัวใหญ่/หนาที่สุด
- **Bulk Action:** มี Checkbox และปุ่มลอย (FAB) "✅ Approve ที่เลือก (n)"
- **Confirm Dialog:** ต้องมี Popup ยืนยันก่อนยิง API จริง 

### 4.2 🛡️ กฎเหล็กฝั่ง Frontend (SA Enforcement)
1. **Global Loading Overlay:** ทันทีที่ผู้ใช้กดปุ่ม Confirm อนุมัติ หน้าจอ **"ต้อง"** ถูกบล็อกด้วย Overlay สีเทาทึบพร้อมวงล้อหมุน ห้ามปล่อยให้ผู้ใช้กดปุ่มซ้ำเด็ดขาดจนกว่า API จะตอบกลับ
2. **CORS Bypass:** การยิง `fetch` ไปยัง GAS ต้องส่งด้วย `method: 'POST'` และใช้ Headers `Content-Type: text/plain;charset=utf-8` เท่านั้น (ห้ามใช้ `application/json` เด็ดขาดเพื่อเลี่ยง CORS Preflight OPTIONS)
3. **AbortController & Timeout:** ต้องตั้ง Timeout ของ `fetch` ไว้ที่ 30 วินาที หากเกินเวลาให้แจ้งเตือนผู้ใช้ "การเชื่อมต่อหมดเวลา"
4. **HTML Error Handler (Anti-429):** หาก GAS ติด Rate Limit หรือล่ม มันจะส่งหน้าเว็บ HTML กลับมา (ไม่ใช่ JSON) Frontend ต้องจับ Error (Parse Error) ตัวนี้ให้ได้ และ **"หน่วงเวลา 2 วินาที แล้วลอง Retry ยิง API ซ้ำอีก 1 ครั้งแบบเงียบๆ"** ก่อนจะแจ้ง Error สีแดงให้ผู้ใช้ทราบ

---

## 5. ข้อกำหนด Backend & API (DBA & Concurrency Control)

### 5.1 `listPendingApprovals`
- ค้นหาด้วย `getDataRange().getValues()` รวดเดียว (ห้ามวนลูป `getValue()`)
- **[SA Rule - Caching]** เนื่องจากผู้อนุมัติมีจำนวนไม่มากและต้องการข้อมูล Real-time แนะนำให้ **ไม่ทำ Cache สำหรับ `Transactions`** (หรือ Cache สั้นมาก 10-30 วินาที) แต่สำหรับข้อมูล `Approve_users` สามารถจับใส่ `CacheService.getScriptCache()` 10 นาทีได้เพื่อลดโหลดการอ่าน Sheet

### 5.2 `updateApprovalStatus` (หัวใจสำคัญ: ป้องกัน Data Racing)
นี่คือ Algorithm ในการอัปเดตข้อมูลทีละหลายบรรทัดโดยไม่ให้ข้อมูลชนกัน (Race Condition):
1. เปิด `LockService.getScriptLock().tryLock(15000)` ทันที
2. **Bulk Read:** อ่านข้อมูล `Transactions` สดใหม่จาก Sheet ทันที (ห้ามใช้ข้อมูลเก่า) ด้วย `getValues()`
3. **สร้าง Index Map:** วนลูปสร้าง `Map<Transaction_ID, rowIndex>` ไว้ใน Memory (O(N) ครั้งเดียว)
4. วนลูปเช็ค `transactionIds` ที่ส่งมา:
   - ดึงแถวข้อมูลจาก Map
   - **[Double Check]** เช็คว่า `Status` ใน Sheet ณ วินาทีนี้ ยังคงเป็น `PENDING` อยู่หรือไม่? หากเปลี่ยนไปแล้ว ให้ข้าม (Skip) รายการนี้พร้อมระบุเหตุผล `ALREADY_PROCESSED` (ป้องกันหัวหน้า 2 คนอนุมัติซ้อน หรือลูกน้องกดแก้ข้อมูลแทรกกลาง)
   - หากปกติ ให้แก้ค่า `Status` และ `Approve_Datetime` ลงใน 2D Array (Memory)
5. **Bulk Write:** สั่ง `sheet.getRange(1, 1, maxRow, maxCol).setValues(modifiedArray)` สาดข้อมูลตู้มเดียวกลับลง Sheet 
6. `SpreadsheetApp.flush()` แล้วค่อยคลาย Lock

### 5.3 Cross-App Cache Clearing (การล้างแคชข้ามโปรเจกต์)
เนื่องจากระบบนี้แยก Apps Script กับระบบขอเบิก ทำให้ Cache ของ 2 ระบบแยกจากกัน หากผู้อนุมัติกด Approve แล้ว สถานะฝั่งผู้ขอเบิกอาจจะยังไม่อัปเดตทันที ดังนั้นเมื่อทำการอนุมัติข้อมูลสำเร็จแล้ว ระบบ **ต้อง** สั่งล้างแคชของระบบผู้ขอเบิกด้วย โดยยิง API ไปยัง Endpoint ของระบบหลัก

**Endpoint URL (ระบบหลัก):**
`https://script.google.com/macros/s/AKfycbya3fPSmvww1tHK7HEV8FTp10RjKopFCKZ1M9ppCSDkGVAspWuKdsMfypL58ppj378k/exec`

**ตัวอย่างฟังก์ชันสำหรับยิง API ล้างแคชในฝั่ง GAS (Approver Backend):**
```javascript
/**
 * ฟังก์ชันสำหรับสั่งลบแคชโปรเจกต์ระบบหลัก (ผู้ขอเบิก)
 * @param {string} keyName - (Optional) ชื่อแคชที่ต้องการลบ ค่าเริ่มต้นคือ 'TRANSACTIONS_ALL'
 */
function callClearTripCache(keyName) {
  var targetKey = keyName || 'TRANSACTIONS_ALL';
  var endpointUrl = "https://script.google.com/macros/s/AKfycbya3fPSmvww1tHK7HEV8FTp10RjKopFCKZ1M9ppCSDkGVAspWuKdsMfypL58ppj378k/exec";
  
  var payload = {
    action: "clearCache",
    data: {
      key: targetKey
    }
  };
  
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var response = UrlFetchApp.fetch(endpointUrl, options);
    var result = JSON.parse(response.getContentText());
    if (result.status === 'success') {
      Logger.log("✅ ลบแคชระบบหลักสำเร็จ: " + result.message);
    } else {
      Logger.log("❌ เกิดข้อผิดพลาด: " + result.message);
    }
  } catch (error) {
    Logger.log("❌ Error calling clear cache API: " + error.toString());
  }
}
```

---

## 6. โครงสร้างไฟล์
- ยึดตามหลักการของระบบหลัก (แยก API, Repository, Service ออกจากกันอย่างชัดเจน)
- กำหนดให้ใช้ CDN Library โดยต้อง **Pin Version** เสมอ

## 7. QA Checklist
- [ ] ทดสอบลงทะเบียนรหัสครั้งแรก (Auto-burn code)
- [ ] ทดสอบดึงรายการ `PENDING` ตามโควต้าหน้าจอ 
- [ ] **[SA Test]** ทดสอบกดอนุมัติพร้อมกัน 2 เครื่องในรายการเดียวกัน (ต้องมี 1 เครื่องโดนตีกลับด้วย `ALREADY_PROCESSED` อย่างสวยงาม ไม่พัง)
- [ ] ทดสอบ Offline/Timeout (ทดลองจำลองเน็ตช้าดูว่าหน้าจอค้างไหม Overlay ขึ้นไหม)
- [ ] เช็คว่าไม่มีการอ่าน/เขียนข้อมูลทีละ Cell (Cell-by-cell loops) ในโค้ดของ Backend
