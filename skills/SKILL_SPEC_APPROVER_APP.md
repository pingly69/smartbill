# 📄 System Specification & Architecture Design
**Project:** Trip1Day Approver Application (Mobile-First)
**Role:** Systems Architect (SA) & Database Administrator (DBA)
**Target Audience:** Development Team

---

## 1. Executive Summary (ภาพรวมระบบ)
โปรเจกต์นี้คือแอปพลิเคชันสำหรับ **"ผู้อนุมัติ (Approver)"** ซึ่งถูกแยกเป็นโปรเจกต์ใหม่ (แยก Repository และ GAS) เพื่อความปลอดภัยและแยกโหลดการทำงาน 
เนื่องจากผู้อนุมัติ 1 คน อาจต้องอนุมัติรายการของลูกน้องจำนวนมากในแต่ละวัน สถาปัตยกรรมจึงต้องเน้นเรื่อง **ความเร็ว (High Performance), การแสดงผลทีละส่วน (Pagination), การลดภาระเซิร์ฟเวอร์ (Caching)** และ **ความถูกต้องของข้อมูล (Concurrency Control)** เพื่อป้องกันปัญหาข้อมูลชนกัน

---

## 2. สถาปัตยกรรมหลัก (Architecture & Infrastructure)
- **Frontend:** HTML/CSS/Vanilla JS โฮสต์บน **GitHub Pages**
- **Backend API:** Google Apps Script (GAS) (คนละ URL กับฝั่งผู้ขอเบิก)
- **Database:** Google Sheets (ใช้ฐานข้อมูลเดียวกันกับฝั่งผู้ขอเบิก)
- **Authentication:** LINE LIFF SDK (ดึง LINE UID ของผู้อนุมัติ)

---

## 3. การออกแบบ UI/UX (Mobile-First Experience)
ผู้อนุมัติส่วนใหญ่เป็นผู้บริหารที่ใช้งานผ่านมือถือ UI ต้องเน้นความกระชับและตัดสินใจได้ไว:
1. **Card-Based Design:** รายการที่รออนุมัติให้แสดงเป็น Card (บอกชื่อคนขอ, วันที่, ยอดเงิน, ระยะทาง)
2. **Expandable Details:** กดที่ Card เพื่อกางดูรายละเอียด (Trip Details, รูปภาพ) โดยไม่ต้องเปลี่ยนหน้า เพื่อความรวดเร็ว
3. **Bulk Approval (อนุมัติทีละหลายรายการ):** 
   - มี Checkbox หน้าแต่ละ Card
   - มีปุ่ม Floating Action Button (FAB) อยู่ด้านล่างหน้าจอ เขียนว่า "อนุมัติรายการที่เลือก (X)"
4. **Global Loading Overlay:** **[บังคับ]** ระหว่างที่แอปยิง API ส่งผลการอนุมัติ ต้องมี Overlay ทึบแสงบังทั้งหน้าจอพร้อมวงล้อโหลด ห้ามให้ผู้บริหารกดย้ำเด็ดขาด ป้องกันการส่ง Request ซ้ำซ้อน

---

## 4. กลยุทธ์การโหลดข้อมูล (API & Data Fetching)
เนื่องจากรายการมีจำนวนมาก การโหลดรวดเดียวจะทำให้แอปค้าง (Timeout 30s) และเปลืองเน็ตมือถือ
1. **Lazy Loading / Pagination (โหลดทีละนิด):**
   - ฝั่ง Frontend ให้โหลดรายการมาแสดงทีละ 5 รายการ (Chunking) 
   - พอเลื่อนจอลงมาสุด (Scroll to bottom) ค่อยดึงข้อมูล 5 รายการถัดไป (หรือใช้ปุ่ม "โหลดเพิ่ม")
2. **Backend Payload Limit:**
   - ฝั่ง GAS ต้องกรองรายการเฉพาะที่ `Status = 'PENDING'` และ `Approver = [LINE_UID_ของผู้อนุมัติ]` เท่านั้น ก่อนส่งกลับมาหน้าบ้าน ห้ามส่งรายการที่อนุมัติแล้วมาให้เปลือง Bandwidth

---

## 5. การจัดการข้อมูลและการป้องกันระบบล่ม (DBA & Concurrency Control)
จากประสบการณ์จากระบบผู้ขอเบิก (Error 429 / Data Racing) นี่คือกฎเหล็กสำหรับโปรเจกต์นี้:

### 5.1. Concurrency Control (ป้องการการชนกันของข้อมูล)
ขณะที่ผู้อนุมัติกำลังกด "อนุมัติ" ลูกน้องอาจจะกำลังกด "แก้ไข" หรือหัวหน้าอีกคนอาจจะกำลังกดอนุมัติรายการเดียวกัน!
- **ต้องใช้ LockService:** ฝั่ง GAS ภายในฟังก์ชัน `approveTransactions()` **ต้อง** มีการเรียกใช้ `LockService.getScriptLock().tryLock(10000)` ก่อนเริ่มอัปเดต Sheet
- **Double-Check Before Write (Validate State):** 
  ก่อนจะเขียนคำว่า "APPROVED" ลงไป GAS ต้องอ่าน Sheet บรรทัดนั้นขึ้นมาเช็คอีกรอบว่า `Status` ยังคงเป็น `PENDING` อยู่หรือไม่? หากเป็นอย่างอื่นไปแล้ว ให้ Throw Error แจ้งผู้บริหารว่า "รายการนี้มีการเปลี่ยนแปลงสถานะไปแล้ว" (เพื่อป้องกันการอนุมัติทับข้อมูลที่ถูกแก้ไข)

### 5.2. Caching Strategy (การรับมือคนเข้าพร้อมกัน)
- **Master Data (รายชื่อผู้ขอเบิก, เรทราคา):** ใช้ `CacheService` เก็บไว้ 10 นาที (เหมือนเดิม)
  - **⚠️ ข้อควรระวังเรื่อง Cache ระหว่าง 2 โปรเจกต์:** 
  เนื่องจาก GAS Script ของผู้อนุมัติ กับ ผู้ขอเบิก **เป็นคนละ Script กัน** ทำให้ `CacheService.getScriptCache()` ของทั้งสองฝั่ง **ไม่เชื่อมถึงกัน**
  - **ผลกระทบ:** เมื่อหัวหน้ากดอนุมัติสำเร็จ ฝั่งหัวหน้าอัปเดตทันที แต่ฝั่งลูกน้อง (ผู้ขอเบิก) อาจจะยังเห็นสถานะเป็น "PENDING"
  - **การแก้ปัญหาเชิงสถาปัตยกรรม:** เพื่อแก้ปัญหานี้ หลังจากที่ทำการ Approve ข้อมูลสำเร็จแล้ว ระบบ Approver ต้องยิง API ไปยังระบบหลักเพื่อสั่งให้เคลียร์แคชข้อมูลด้วย (ดูตัวอย่างโค้ดด้านล่าง)

### 5.3. Bulk Read/Write (ห้ามลูปอ่านทีละเซลล์)
- เมื่อผู้อนุมัติกดอนุมัติพร้อมกัน 10 รายการ (Bulk Approve) ฝั่ง GAS ห้ามเขียนลง Sheet ทีละบรรทัด ให้ใช้ `getRange().getValues()` หาบรรทัดที่ตรงกันทั้งหมด จากนั้นปรับแต่ง Array ใน Memory และใช้ `getRange().setValues()` เซฟกลับลง Sheet **ในคำสั่งเดียว**

---

## 6. การจัดการ Error (Resilience)
1. **Frontend AbortController:** ตัดการเชื่อมต่อ API หากนานเกิน 30 วินาที พร้อมแจ้งเตือน "การเชื่อมต่อหมดเวลา" (ห้ามปล่อยให้หมุนค้าง)
2. **Retry Mechanism:** หาก Google ส่ง HTML กลับมา (Error 429) ทำให้ `JSON.parse` พัง Frontend ต้องมีฟังก์ชันหน่วงเวลา 2 วินาที แล้วลอง Retry ยิง API ใหม่แบบเงียบๆ อย่างน้อย 1 ครั้ง ก่อนฟ้อง Error ให้ผู้บริหารเห็น

---
---

## 7. Cross-App Cache Clearing (การล้างแคชข้ามโปรเจกต์)
หลังจากที่ผู้อนุมัติทำการ Approve แล้ว จะต้องสั่งล้างแคช (Clear Cache) ของระบบฝั่งผู้ขอเบิก (โปรเจกต์หลัก) ด้วย เพื่อให้ผู้ขอเบิกเห็นสถานะอัปเดตทันที โดยการยิง HTTP POST Request ไปที่ระบบหลัก

**Endpoint URL (ระบบหลัก):**
`https://script.google.com/macros/s/AKfycbya3fPSmvww1tHK7HEV8FTp10RjKopFCKZ1M9ppCSDkGVAspWuKdsMfypL58ppj378k/exec`

**ตัวอย่างฟังก์ชัน GAS (Approver Backend):**
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

**SA/DBA Sign-off:** *Architected for High-Availability, Mobile-First UX, and Race-Condition Immunity.*
