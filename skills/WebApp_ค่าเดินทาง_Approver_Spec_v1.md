# เอกสารข้อกำหนดระบบ (System Requirements Specification) — v1
**ชื่อโครงการ:** WebApp ค่าเดินทาง — Approver (ระบบอนุมัติรายการเบิกค่าเดินทาง)
**Platform:** LINE LIFF (Mobile-first Web App)
**วันที่จัดทำ:** 31 กรกฎาคม 2026
**สถานะ:** พร้อมส่งต่อให้ทีม Developer (AI.Dev ทีมที่ 2)
**ความสัมพันธ์กับระบบเดิม:** เป็น **โปรเจกต์ GAS + Web App แยกต่างหาก** จากระบบบันทึกเบิกค่าเดินทาง (`WebApp ค่าเดินทาง` หลัก, ปัจจุบัน v10) — คนละ Apps Script Project, คนละ Deploy, คนละทีมพัฒนา แต่ **ใช้ Google Sheets (Spreadsheet) ตัวเดียวกันเป็นฐานข้อมูลร่วมกัน** เอกสารนี้ระบุเฉพาะส่วนฐานข้อมูลที่แอปนี้ต้องแตะจริง (ดูข้อ 2) ไม่ต้องอ้างอิงโครงสร้าง Sheet อื่นที่ไม่เกี่ยวข้องกับการอนุมัติ

---

## 1. ภาพรวมของระบบ (Project Overview)

**วัตถุประสงค์:** สร้าง Web App แยกสำหรับ "ผู้อนุมัติ" (Approver) ใช้ดู/อนุมัติ/ไม่อนุมัติ รายการเบิกค่าเดินทาง (`Transactions`) ที่พนักงานส่งมาจากระบบหลัก โดย:

1. ผู้อนุมัติเปิดผ่าน LINE LIFF เหมือนแอปหลัก — ยืนยันตัวตนด้วย LINE UID อัตโนมัติถ้าเคยลงทะเบียนแล้ว หรือกรอกรหัสยืนยันตัวตนครั้งแรกถ้ายังไม่เคยเข้า (ดูข้อ 3)
2. เห็นเฉพาะรายการที่ `Transactions.Approver` ตรงกับชื่อของตัวเอง และมีสถานะรออนุมัติ (`PENDING`) เท่านั้น
3. แสดงผลแบบย่อทีละชุด (Batch) เพื่อไม่ให้จอรก โดยเลือกได้หลายรายการพร้อมกันแล้วกด Approve/Reject ครั้งเดียว
4. เมื่ออนุมัติ/ไม่อนุมัติแล้ว ระบบดึงชุดถัดไปที่ยังค้างมาแสดงต่อทันที จนกว่าจะหมด

**Non-Goals (ไม่ได้ทำใน Phase นี้):**
- ไม่มีการอนุมัติหลายลำดับขั้น (Multi-level Approval) — 1 รายการอนุมัติจบในขั้นตอนเดียว
- ไม่มีช่องกรอกเหตุผลตอน Reject (Reject Reason) — Reject คือเปลี่ยนสถานะเฉย ๆ ผู้ขอเบิกต้องคุยกับผู้อนุมัติเองนอกระบบถ้าต้องการเหตุผล
- ไม่มีการแจ้งเตือนอัตโนมัติ (LINE Notify/Push) ไปหาผู้ขอเบิกตอนอนุมัติ/ไม่อนุมัติเสร็จ — เตรียมโครงสร้างข้อมูลไว้รองรับอนาคตเท่านั้น (คอลัมน์ `Approve_users.line_uid` ที่มีอยู่แล้วเผื่อไว้)
- ไม่มีหน้าประวัติ (History) ดูรายการที่อนุมัติ/ไม่อนุมัติไปแล้ว — ขอบเขต Phase นี้คือคิวรออนุมัติ (`PENDING`) เท่านั้น

---

## 2. โครงสร้างฐานข้อมูลที่ใช้ (Shared Google Sheets — เฉพาะส่วนที่แอปนี้แตะ)

**สำคัญ:** Sheet ทั้งหมดด้านล่างนี้**มีอยู่แล้ว**ใน Spreadsheet ของระบบหลัก (`WebApp ค่าเดินทาง` v10) — แอปนี้**ไม่สร้าง Sheet ใหม่**ใด ๆ เพียงแค่อ่าน/เขียนบางคอลัมน์ของ 2 Sheet ต่อไปนี้เท่านั้น ห้ามแก้ไขโครงสร้างคอลัมน์ที่มีอยู่แล้ว (ถ้าจำเป็นต้องเพิ่มคอลัมน์ใหม่ ให้ประสานกับทีมแรกก่อน เพราะกระทบ Sheet เดียวกัน)

**Config ที่ทีมพัฒนาต้องตั้งค่า:** `SPREADSHEET_ID` ใน `Config.gs` ของโปรเจกต์นี้ **ต้องเป็นค่าเดียวกันเป๊ะ**กับ Spreadsheet ID ที่ระบบหลักใช้อยู่ (ขอค่านี้จากผู้ดูแลระบบ/ทีมแรกโดยตรง อย่าสร้าง Spreadsheet ใหม่) และ Google Account ที่ใช้ Deploy โปรเจกต์นี้ต้องมีสิทธิ์ **Editor** บน Spreadsheet นั้น (ไม่ใช่แค่ Viewer) เพราะต้องเขียนคอลัมน์ `Status`, `Approve_Datetime`, และ `line_uid`

### 2.1 Sheet: `Approve_users` *(มีอยู่แล้ว — อ่าน + เขียนคอลัมน์ `line_uid`)*

| Column | Type | หมายเหตุ |
|---|---|---|
| `approve_request` | String | ชื่อผู้อนุมัติ — ใช้เป็นตัวกรอง `Transactions.Approver` (ดู 2.2) และแสดงเป็นชื่อผู้ใช้งานบนหน้าจอ |
| `line_profile` | String | รหัสอ้างอิงภายใน — แอปนี้ไม่แตะ/ไม่ใช้ |
| `line_uid` | String | **หัวใจของระบบยืนยันตัวตน (ดูข้อ 3):** เก็บ LINE UID จริงของผู้อนุมัติคนนั้นถ้าเคยลงทะเบียนแล้ว หรือเก็บ "รหัสยืนยันตัวตนชั่วคราว" (Setup Code) ที่ Admin ตั้งไว้ล่วงหน้าถ้ายังไม่เคยลงทะเบียน — แอปนี้เป็นตัวเขียนทับคอลัมน์นี้ตอนลงทะเบียนสำเร็จครั้งแรก |
| `Active` | Boolean | กรองเฉพาะแถวที่ `Active = TRUE` เท่านั้นทุกจุดที่ค้นหาในแอปนี้ (แถว Inactive ถือว่าไม่มีสิทธิ์เข้าระบบอนุมัติอีกต่อไป) |

### 2.2 Sheet: `Transactions` *(มีอยู่แล้ว — อ่านทุกคอลัมน์ที่ใช้แสดงผล + เขียนเฉพาะ `Status`, `Approve_Datetime`)*

แอปนี้ใช้เฉพาะคอลัมน์ต่อไปนี้ (คอลัมน์อื่นของ Sheet เดียวกัน เช่น `Plate_No`, `Image_URL` มีอยู่แต่ไม่เกี่ยวกับหน้าจออนุมัติ ไม่ต้องดึงมาแสดง เพื่อลดขนาด Payload):

| Column | Type | ใช้ทำอะไรในแอปนี้ |
|---|---|---|
| `Transaction_ID` | String (Primary Key) | **Key หลักที่ใช้อ้างอิงตอน Approve/Reject เสมอ — ดูเหตุผลเรื่อง Primary Key ในข้อ 5.2** |
| `Req_Name` | String | แสดงเป็น "ชื่อผู้ขอ" บนการ์ด |
| `Req_Date` | Date (ISO) | แสดงเป็น "วันที่เดินทาง" |
| `Site_Name` | String | แสดงเป็น "สถานที่/SITE งาน" — **ดึงจากคอลัมน์นี้ตรง ๆ ไม่ต้อง Join กับ `Master_Site`** เพราะระบบหลัก denormalize ชื่อ Site มาเก็บไว้ในแถว Transaction อยู่แล้ว |
| `Trip_Details` | JSON String | Parse เพื่อแสดงสรุปต้นทาง/ปลายทาง/ระยะทางของแต่ละเส้นทางย่อย (ดู Service_TripSummary ข้อ 6.1) — โครงสร้าง JSON เดียวกับที่ระบุในสเปกหลัก v10 ข้อ 2.4 |
| `Total_KM` | Number | แสดงระยะทางรวม |
| `Toll_Fee` | Number | แสดงค่าทางด่วน |
| `Park_Fee` | Number | แสดงค่าที่จอด |
| `Flat_Rate_Fee` | Number | แสดงค่าใช้รถ (150 บาท ถ้าเปิดใช้) |
| `Net_Total` | Number | **(แนะนำเพิ่มจากที่ระบุมา แม้ไม่ได้ระบุไว้ชัดเจน)** ยอดเบิกสุทธิ — ผู้อนุมัติควรเห็นยอดนี้ก่อนตัดสินใจกดอนุมัติเสมอ ไม่ควรต้องคำนวณเองจาก Total_KM+ค่าธรรมเนียมต่าง ๆ |
| `Travel_Purpose` | String | แสดงเป็น "รายละเอียดการเดินทาง" |
| `Approver` | String | ใช้กรองว่ารายการนี้เป็นของผู้อนุมัติคนไหน (เทียบกับ `Approve_users.approve_request` ของผู้ที่ Login อยู่) |
| `Status` | String enum: `DRAFT` \| `PENDING` \| `APPROVED` \| `REJECTED` | **ดึงมาเฉพาะแถว `Status = "PENDING"`** และเป็นคอลัมน์ที่แอปนี้เขียนทับตอนกด Approve (→ `APPROVED`) / Reject (→ `REJECTED`) |
| `Approve_Datetime` | DateTime (ISO) | แอปนี้เป็นตัวเขียนคอลัมน์นี้ครั้งแรก (ในสเปกหลัก v7 เตรียมคอลัมน์นี้ไว้เฉย ๆ ยังไม่มีฟังก์ชันเขียน — **แอปนี้คือฟังก์ชันนั้น**) เขียนเป็น Timestamp ปัจจุบัน Timezone `Asia/Bangkok` ทุกครั้งที่ Approve/Reject สำเร็จ (ไม่ว่าผลจะเป็น Approve หรือ Reject ก็บันทึกเวลาที่ตัดสินใจเหมือนกัน) |

---

## 3. Flow การยืนยันตัวตนผู้อนุมัติ (Approver Authentication)

### 3.1 ภาพรวม Flow

```
เปิดแอป → liff.init() → ได้ lineUserId
        → เรียก getApproverProfile(lineUserId)
              │
              ├─ พบแถวที่ line_uid = lineUserId (และ Active=TRUE)
              │     → เข้าระบบทันที ได้ approve_request ชื่อผู้อนุมัติ
              │     → เก็บ approve_request ไว้ใน State ฝั่ง Frontend (ดู 3.4)
              │
              └─ ไม่พบ
                    → แสดงหน้าจอ "กรอกรหัสยืนยันตัวตน" (ครั้งแรกเท่านั้น)
                    → ผู้ใช้กรอกรหัส → เรียก verifyApproverCode(code, lineUserId)
                          │
                          ├─ พบแถวที่ line_uid = code (และ Active=TRUE)
                          │     → เขียนทับ line_uid ของแถวนั้นด้วย lineUserId จริง (ลงทะเบียนเสร็จ)
                          │     → เข้าระบบทันที ได้ approve_request ชื่อผู้อนุมัติ
                          │
                          └─ ไม่พบ (รหัสผิด)
                                → แสดง Error "รหัสไม่ถูกต้อง" ให้กรอกใหม่
```

### 3.2 `getApproverProfile(lineUserId)`

- **Read-only ไม่ต้องขอ Lock**
- Bulk read ทั้ง Sheet `Approve_users` (ตามหลัก Performance เดียวกับสเปกหลักข้อ 4.6.1 — ห้าม cell-by-cell)
- หาแถวแรกที่ `line_uid === lineUserId` **และ** `Active === true`
- **พบ** → Return `{ authenticated: true, approve_request: "<ชื่อ>" }`
- **ไม่พบ** → Return `{ authenticated: false }` (Frontend เด้งไปหน้ากรอกรหัส)

### 3.3 `verifyApproverCode(code, lineUserId)`

- หา row ที่ `line_uid === code` (เทียบแบบ Exact match, `trim()` ทั้งสองฝั่งก่อนเทียบกันข้อพิมพ์เผลอเว้นวรรค) **และ** `Active === true`
- **ไม่พบ** → Return `{ success: false, error_code: "INVALID_CODE" }`
- **พบ** → เปิด `LockService.getScriptLock()` ช่วงสั้น ๆ เฉพาะตอนเขียนทับ (ตามหลัก 4.6.4 ของสเปกหลัก): เขียนทับ `line_uid` ของแถวนั้นด้วยค่า `lineUserId` จริงที่ส่งมา → ปล่อย Lock → Return `{ success: true, approve_request: "<ชื่อ>" }`

**คุณสมบัติด้านความปลอดภัยที่ออกแบบมาในตัว (สำคัญ ให้ Developer เข้าใจตรงกัน):** เพราะรหัสถูกเก็บอยู่ใน**คอลัมน์เดียวกัน**กับ `line_uid` (ไม่มีคอลัมน์แยกสำหรับรหัส) เมื่อลงทะเบียนสำเร็จครั้งหนึ่ง ค่ารหัสเดิมจะ**ถูกเขียนทับหายไปทันที** แทนที่ด้วย LINE UID จริง (ซึ่งเป็นสตริงยาวเฉพาะตัวที่แทบเป็นไปไม่ได้ที่คนอื่นจะพิมพ์ตรงกันโดยบังเอิญ) ผลคือ**รหัสนี้ใช้ได้ครั้งเดียวโดยอัตโนมัติ**ไม่ต้องมี Logic เพิ่มเติมมาคอยเช็ค — ถ้ามีคนพยายามกรอกรหัสเดิมซ้ำหลังจากมีคนลงทะเบียนไปแล้ว ระบบจะหาไม่เจอ (`INVALID_CODE`) เอง เพราะค่านั้นไม่มีอยู่ในคอลัมน์แล้ว **ข้อแนะนำ:** ให้ Admin ตั้งรหัสไม่ซ้ำกันต่อผู้อนุมัติแต่ละคน (ไม่ควรใช้รหัสเดียวกันทุกคน) เพื่อไม่ให้คนแรกที่กรอกไปแย่งสิทธิ์ผูก LINE UID เข้ากับแถวของคนอื่น

### 3.4 การเก็บ State หลัง Login สำเร็จ (ลด Load ซ้ำซ้อน — ตามที่ระบุ)

หลัง `getApproverProfile`/`verifyApproverCode` สำเร็จ ให้ Frontend เก็บค่า `approve_request` ไว้ใน **JS Variable ระดับ App** (เช่น `state.currentApprover`) **ตั้งแต่ตอนเข้าหน้าแรกครั้งเดียว** และส่งค่านี้แนบไปกับทุกครั้งที่เรียก `listPendingApprovals()`/`updateApprovalStatus()` ในเซสชันนั้น **ห้ามเรียก `getApproverProfile` ซ้ำอีกเพื่อหาชื่อผู้อนุมัติ** ตลอดช่วงที่แอปยังเปิดอยู่ (ตรงตามหลักการเดียวกับ `getDataOnLoad` ของสเปกหลักที่โหลดครั้งเดียวตอนเปิดแอป)

---

## 4. ข้อกำหนด UI/UX

### 4.1 หน้าจอกรอกรหัสยืนยันตัวตน (แสดงเฉพาะกรณี `authenticated: false`)

- Input เดียว: "กรอกรหัสยืนยันตัวตน" — `inputmode="numeric"` หรือ `"text"` ตามรูปแบบรหัสที่ Admin ตั้ง (ตัวเลขหรือผสมตัวอักษรก็ได้ ให้ยืดหยุ่นไม่ Fix ความยาว)
- ปุ่ม `ยืนยัน` — Loading state ระหว่างรอผล กันกดซ้ำ
- ผิด → Inline error ใต้ช่อง "รหัสไม่ถูกต้อง กรุณาตรวจสอบกับผู้ดูแลระบบ" ไม่เด้ง Alert popup (ตามหลัก Mobile UX เดียวกับสเปกหลักข้อ 3.3)
- สำเร็จ → เข้าหน้ารายการรออนุมัติทันที (ข้อ 4.2)

### 4.2 หน้าจอรายการรออนุมัติ (Approval Queue)

**Layout:**
- Header เล็ก ๆ บนสุด: "สวัสดีคุณ {approve_request}" + จำนวนที่เหลือทั้งหมด (`remaining_count` จาก `listPendingApprovals`) เช่น "รออนุมัติทั้งหมด 11 รายการ"
- แสดงเป็นการ์ดทีละ **`APPROVAL_BATCH_SIZE`** รายการ (ค่าคงที่ = `4`, ปรับได้ภายหลังใน `Config.gs` โดยไม่ต้องแก้ Logic — ดู 6.2)
- แต่ละการ์ดมี **Checkbox** ที่มุมซ้ายบนสำหรับเลือกหลายรายการพร้อมกัน
- เนื้อหาการ์ด (แบบย่อ ตามที่ระบุ):
  - ชื่อผู้ขอ (`Req_Name`) + สถานที่ (`Site_Name`)
  - วันที่เดินทาง (`Req_Date`)
  - รายการเส้นทาง (จาก `Trip_Details`) แบบย่อ — ถ้ามีหลายเส้นทาง แสดงบรรทัดเดียวสรุปจำนวน + เส้นแรก เช่น "3 เส้นทาง: คลังขอนแก่น→สาขาอุดร 50กม. (+2 เพิ่มเติม)" พร้อมลิงก์ `[ดูทั้งหมด ▾]` กดขยายดูทุกเส้นทางในการ์ดเดียวกัน (กันจอยาวเกินไปเมื่อแสดง 4 การ์ดพร้อมกันบนมือถือ — เหตุผลเดียวกับ Card ยุบ/ขยายของสเปกหลักข้อ 3.3)
  - ระยะทางรวม (`Total_KM`), ค่าทางด่วน (`Toll_Fee`), ค่าที่จอด (`Park_Fee`), ค่าใช้รถ (`Flat_Rate_Fee`)
  - **ยอดเบิกสุทธิ (`Net_Total`)** เด่นสุดในการ์ด (ตัวหนา/สีเข้ม) เพราะเป็นตัวเลขสำคัญที่สุดต่อการตัดสินใจ
  - รายละเอียดการเดินทาง (`Travel_Purpose`)
- **Sticky Action Bar** ด้านล่างจอ (ติดตามการ scroll เหมือนหลักการ Sticky Summary Bar ของสเปกหลักข้อ 3.3): ปุ่ม `✅ Approve ที่เลือก (n)` และ `❌ Reject ที่เลือก (n)` — `n` = จำนวนที่ติ๊กเลือกไว้ ปุ่มทั้งสอง **disable เมื่อ n = 0**
- กดปุ่มใดปุ่มหนึ่ง → Confirm dialog สั้น ๆ ("ยืนยันอนุมัติ {n} รายการ?" / "ยืนยันไม่อนุมัติ {n} รายการ?") ก่อนยิง Backend จริง (กันมือลั่น เช่นเดียวกับปุ่มลบ Trip Card ของสเปกหลัก)
- หลังยืนยันสำเร็จ → เรียก `listPendingApprovals()` ใหม่ทันทีเพื่อดึงชุดถัดไปมาแสดงแทนที่การ์ดเดิม (ไม่ใช่ปิดแอปหรือพากลับหน้าแรก)

### 4.3 Empty State

เมื่อ `listPendingApprovals()` คืนค่า `items` ว่างเปล่า (ไม่ว่าจะเป็นตอนเปิดแอปครั้งแรกหรือหลังอนุมัติ/ไม่อนุมัติจนหมดคิว) → แสดงข้อความ "ไม่พบรายการรออนุมัติ 🎉" กลางจอ พร้อมไอคอนเรียบง่าย ไม่มีปุ่มอื่นให้กด (ไม่มี Non-Goal อื่นที่ต้องทำต่อในหน้านี้)

---

## 5. ข้อกำหนด Backend & API

ทุกฟังก์ชัน Return JSON ตาม Contract เดียวกับสเปกหลัก (คงรูปแบบเดิมเพื่อความสอดคล้อง แม้เป็นคนละโปรเจกต์):
```json
// สำเร็จ
{ "success": true, "data": { ... } }
// ผิดพลาด
{ "success": false, "error_code": "...", "message": "..." }
```
`error_code` ที่ต้องรองรับ: `INVALID_CODE` (ดู 3.3), `NOT_FOUND`, `ALREADY_PROCESSED` (ดู 5.3), `CONCURRENT_WRITE_CONFLICT`, `VALIDATION_ERROR`, `SERVER_ERROR`

### 5.1 `listPendingApprovals(approveRequest)`

- **Read-only ไม่ต้องขอ Lock**
- Bulk read ทั้ง Sheet `Transactions` ครั้งเดียว (`getDataRange().getValues()`) — **ไม่ query ทีละแถว**
- Filter ใน Memory: `Approver === approveRequest && Status === "PENDING"`
- **เรียงลำดับ** ผลลัพธ์ตาม `Req_Date` (เก่าสุดก่อน) ก่อนตัด — ให้รายการที่ค้างนานสุดถูกอนุมัติก่อนเป็น Default (ยุติธรรมกับผู้ขอเบิกที่รอนานแล้ว)
- ตัดมาแสดงแค่ `APPROVAL_BATCH_SIZE` แถวแรก (ดู 6.2) — parse `Trip_Details` ของแต่ละแถวที่จะแสดงเป็น Array เส้นทางย่อยสำหรับ UI (ดู Service_TripSummary ข้อ 6.1)
- Return:
  ```json
  {
    "success": true,
    "data": {
      "items": [ { "transaction_id": "...", "req_name": "...", "site_name": "...", "req_date": "...", "trips": [...], "total_km": 70, "toll_fee": 0, "park_fee": 20, "flat_rate_fee": 150, "net_total": 590, "travel_purpose": "..." } ],
      "remaining_count": 11
    }
  }
  ```
  `remaining_count` = จำนวนแถวทั้งหมดที่ตรงเงื่อนไข **ก่อนตัด** (ไม่ใช่แค่จำนวนที่ส่งมาแสดงรอบนี้) ให้ Frontend ใช้แสดง Header ตามข้อ 4.2 และรู้ว่ายังมีคิวเหลือหลังจากชุดนี้ไหม

### 5.2 `updateApprovalStatus(transactionIds, decision, approveRequest)` — หัวใจสำคัญของระบบ

`decision` ต้องเป็น `"APPROVED"` หรือ `"REJECTED"` เท่านั้น, `transactionIds` เป็น Array ของ `Transaction_ID` ที่ผู้ใช้ติ๊กเลือกไว้ (มากกว่า 1 รายการได้)

**เรื่อง Primary Key — ป้องกันความผิดพลาดตอนวน Update (ตามที่ระบุให้เน้นเป็นพิเศษ):**

`Transaction_ID` คือ Primary Key เดียวที่ใช้อ้างอิงเสมอ **ห้ามอ้างอิงด้วย Row Index ของ Sheet ตรง ๆ ข้ามรอบการทำงาน** เพราะ Row Index อาจเปลี่ยนได้ถ้ามีการ Insert/ลบแถวจากที่อื่น (เช่น `dailyMaintenance()` ของระบบหลักที่ลบแถวเก่าเป็นระยะ ๆ ตามสเปกหลัก v8 ข้อ 4.7 — ซึ่งทำงานอยู่บน Sheet เดียวกันนี้) ดังนั้น Flow การ Update ต้องทำดังนี้เสมอ:

**Flow:**
1. Validate `decision` ต้องเป็นค่าใน enum ที่กำหนดเท่านั้น, `transactionIds.length > 0` — ทำก่อนขอ Lock (ตามหลัก 4.6.4 ของสเปกหลัก)
2. เปิด `LockService.getScriptLock()` ด้วย `tryLock(15000)` ครอบเฉพาะขั้นตอน 3-6 ด้านล่าง (สั้นที่สุดเท่าที่ทำได้)
3. **Bulk read ทั้ง Sheet `Transactions` สดใหม่ 1 ครั้งภายใน Lock นี้เท่านั้น** (ไม่ใช้ข้อมูลที่ Cache ไว้จากตอนแสดงผลก่อนหน้า เพราะอาจมีคนอื่นแก้ไปแล้วระหว่างที่ผู้ใช้กำลังติ๊กเลือกอยู่บนจอ)
4. **สร้าง Index Map ครั้งเดียวจากข้อมูลที่เพิ่ง Bulk read** คือ `Map<Transaction_ID, rowIndexในArray>` โดยวนอ่าน Array ทั้งก้อนแค่รอบเดียว (`O(n)` ครั้งเดียว ไม่ใช่วน scan ใหม่ทุกครั้งที่จะ update แต่ละ `Transaction_ID` ซึ่งจะกลายเป็น `O(n×m)`) — นี่คือเทคนิคหลักที่ทำให้ Search/Update เร็วและไม่เสี่ยงผิดแถวเมื่อมีหลายรายการ
5. วนลูปทีละ `transaction_id` ใน `transactionIds` โดยหา `rowIndex` จาก Map (ขั้นตอน 4) แทนการ scan ใหม่:
   - **ถ้าไม่พบใน Map** → แปลว่ารายการนี้หายไปจาก Sheet แล้ว (ถูกลบโดย `dailyMaintenance()` หรือกรณีผิดปกติอื่น) → บันทึกไว้ใน `skipped` list ของ Response เป็น `{ transaction_id, reason: "NOT_FOUND" }` **ข้ามไปทำรายการถัดไป ไม่ throw error ทั้ง Batch**
   - **ถ้าพบแต่ `Status` ของแถวนั้น ณ ตอนนี้ไม่ใช่ `"PENDING"` แล้ว** (เช่นมีอีกแท็บ/อีกคนกดอนุมัติไปก่อนหน้าเสี้ยววินาที หรือผู้ขอเบิกแก้ไขและ Resubmit กลับไปเป็น `PENDING` ใหม่พอดี) → บันทึกไว้ใน `skipped` เป็น `{ transaction_id, reason: "ALREADY_PROCESSED" }` **ข้ามไปเช่นกัน ไม่เขียนทับสถานะซ้ำ**
   - **ถ้าพบและยังเป็น `PENDING`** → แก้ค่าในแถวนั้น**ใน Array ที่อยู่ใน Memory** (ยังไม่เขียนกลับ Sheet ตอนนี้): `Status = decision`, `Approve_Datetime = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss")` → เพิ่มเข้า `processed` list
6. เมื่อวนครบทุก `transaction_id` แล้ว **เขียนกลับ Sheet ด้วย `setValues()` ครั้งเดียวทั้งตาราง** (Bulk write เต็ม Array ที่แก้ไขใน Memory แล้ว ตามหลัก 4.6.1 ของสเปกหลัก — เหมาะกับขนาด Sheet ที่ไม่ใหญ่มากเพราะมี `dailyMaintenance()` คอยจำกัดขนาดไว้อยู่แล้วตามสเปกหลัก v8) แล้ว `SpreadsheetApp.flush()` หนึ่งครั้งก่อน Return
7. ปล่อย `lock.releaseLock()` ใน `finally` เสมอ
8. Return สรุปผล:
   ```json
   {
     "success": true,
     "data": {
       "processed": ["TXN-001", "TXN-002"],
       "skipped": [ { "transaction_id": "TXN-003", "reason": "ALREADY_PROCESSED" } ]
     }
   }
   ```
   **Frontend ต้องเช็ค `skipped` เสมอ** — ถ้ามีรายการถูกข้าม ให้แจ้งผู้ใช้สั้น ๆ ("1 รายการถูกดำเนินการไปแล้วโดยผู้อื่น") ก่อนจะรีเฟรชรายการชุดถัดไปตามปกติ ไม่ต้องถือเป็น Error ทั้ง Request

### 5.3 หมายเหตุสำคัญเรื่อง Concurrency ข้ามโปรเจกต์ (Cross-App Locking — ต้องอ่านก่อนพัฒนา)

เนื่องจากแอปนี้เป็น **Apps Script Project แยกต่างหาก** จากระบบหลัก แต่เขียนลง Sheet เดียวกัน (`Transactions`) มีข้อจำกัดทางเทคนิคที่ต้องรู้ล่วงหน้า:

- **`LockService.getScriptLock()` ล็อกเฉพาะภายในโปรเจกต์ตัวเอง** — Lock ที่แอปนี้ขอ **ไม่ได้กันชนกับ** Lock ที่ระบบหลัก (`submitTransaction()`) หรือ `dailyMaintenance()` ขอไว้ในโปรเจกต์ของมันเอง ถึงแม้จะพูดถึง Sheet เดียวกันก็ตาม เพราะ Google แยก Scope ของ Lock ตาม Script Project ไม่ใช่ตาม Spreadsheet
- **ทางเลือกที่แนะนำ (ถ้าต้องการ Lock ที่ครอบคลุมจริง):** ถ้าเป็นไปได้ ให้ Deploy โปรเจกต์นี้แบบ **Container-bound Script** ผูกกับ Spreadsheet ตัวเดียวกัน (เปิดจากเมนู Extensions → Apps Script ของ Spreadsheet นั้นโดยตรง แทนที่จะสร้าง Standalone Script แยกแล้ว `openById()`) วิธีนี้ทั้งสองโปรเจกต์จะใช้ `LockService.getDocumentLock()` ร่วมกันได้จริงเพราะผูกกับเอกสารเดียวกัน
- **ถ้าข้อจำกัดขององค์กร/ทีมทำให้ต้องแยกเป็น Standalone Project จริง ๆ (คนละเจ้าของบัญชี Deploy เป็นต้น):** ยอมรับความเสี่ยงที่เหลือได้ในระดับการใช้งานจริงของระบบนี้ (ผู้ใช้พร้อมกันรวมทั้ง 2 แอปไม่เกิน 3-4 คน) เพราะขั้นตอน 5 ข้อ 5.2 ที่เช็ค `Status` สดใหม่ก่อนเขียนทับทุกครั้ง (ไม่เชื่อข้อมูลที่ Cache ไว้ตั้งแต่ตอนแสดงผล) ช่วยลดความเสี่ยงจากการชนกันข้ามแอปได้เกือบทั้งหมดอยู่แล้ว แม้ Lock จะไม่ใบ้กันจริงระดับ Engine — เคสที่จะเกิดปัญหาจริงคือ 2 การเขียนชนกันในเสี้ยววินาทีเดียวกันพอดีซึ่งที่ Scale นี้แทบไม่เกิดขึ้น และถ้าเกิดก็จะจับได้ที่ `ALREADY_PROCESSED` ในรอบถัดไปอยู่ดี ไม่ใช่ข้อมูลเสียหายแบบเงียบ ๆ

---

## 6. โครงสร้าง Source Code & ค่าคงที่

### 6.1 Service_TripSummary.gs — แปลง `Trip_Details` เป็นข้อมูลแสดงผลย่อ

ฟังก์ชันล้วน ๆ ไม่แตะ Sheet โดยตรง: รับ `Trip_Details` (JSON string จาก Sheet) → `JSON.parse()` → คืนค่า Array รูปแบบที่ Frontend ใช้ Render ได้ตรง ๆ เช่น `{ origin, dest, km, trip_type, badge_text }` โดย `badge_text` คำนวณจาก `type` + `trip_type` ตามกฎเดียวกับสเปกหลัก v10 ข้อ 3.2 (Fix+ROUND_TRIP → "🔁 ไปกลับ ×2", Custom+ROUND_TRIP → "🔁 ไปกลับ" ไม่มี ×2 ฯลฯ) — **แอปนี้แค่แสดงผล ไม่คำนวณเงินซ้ำ** เพราะ `Total_KM`/`Net_Total` ถูกคำนวณและ Freeze ไว้แล้วตอน Submit จากระบบหลัก

### 6.2 Config.gs — ค่าคงที่ของโปรเจกต์นี้

| Key | Value | หมายเหตุ |
|---|---|---|
| `SPREADSHEET_ID` | *(ใส่ ID จริงของ Spreadsheet ระบบหลัก)* | **ต้องตรงกับระบบหลักเป๊ะ** ดูข้อ 2 |
| `APPROVAL_BATCH_SIZE` | `4` | จำนวนรายการที่แสดงต่อหน้าจอ 1 ชุด — Const ปรับได้ภายหลังโดยแก้เลขนี้ค่าเดียว ไม่ต้องแก้ Logic ของ `listPendingApprovals` |

### 6.3 โครงสร้างไฟล์ (เดินตามแนวทางเดียวกับระบบหลัก ข้อ 5 ของสเปกหลัก v10 — เพื่อให้ทีมสองทำงานสอดคล้องกัน)

**Backend (`.gs`):**
```
src/
├── Code.gs                    # Entry point: doGet(e) เท่านั้น
├── Config.gs                  # ค่าคงที่ทั้งหมด (ดู 6.2)
├── Api_Auth.gs                 # getApproverProfile(), verifyApproverCode()
├── Api_Approval.gs             # listPendingApprovals(), updateApprovalStatus()
├── Service_TripSummary.gs      # แปลง Trip_Details เป็นข้อมูลแสดงผล (ดู 6.1)
├── Repository_Sheets.gs        # bulkRead(sheetName), bulkWrite() — Layer เดียวที่แตะ SpreadsheetApp ตรง ๆ
├── Util_Date.gs                # คำนวณวันที่/เวลา Timezone Asia/Bangkok ทั้งหมด (เหมือนสเปกหลักข้อ 4.5)
└── Util_Response.gs            # buildSuccess(data), buildError(code, message)
```

**Frontend (`.html` ที่ Serve ผ่าน HtmlService):**
```
src/
├── Index.html                  # Shell หลัก + include ไฟล์อื่น
├── Styles_Main.html            # CSS
├── Js_App.html                  # Bootstrap: liff.init(), เก็บ state.currentApprover (ดู 3.4)
├── Js_ApiClient.html            # ห่อ google.script.run เป็น Promise เดียว
├── Js_Login.html                 # หน้าจอกรอกรหัสยืนยันตัวตน (ดู 4.1)
└── Js_ApprovalQueue.html         # หน้ารายการรออนุมัติ + Checkbox + Sticky Action Bar (ดู 4.2/4.3)
```

**หลักการเดียวกับระบบหลัก (คงไว้เพื่อความสอดคล้องข้ามทีม):** อ่าน/เขียนแบบ Bulk เสมอห้าม cell-by-cell (4.6.1), Lock เฉพาะช่วงเขียนจริงให้สั้นที่สุด (4.6.4), แยก Read-only ออกจาก Write ชัดเจนไม่ขอ Lock ตอนอ่าน (4.6.6), Timezone `Asia/Bangkok` ทุกจุดที่เกี่ยวกับวันที่-เวลา (4.5), CDN Library ใดที่ใช้ต้อง Pin Version เจาะจงเสมอ ห้ามใช้ `@latest`/ไม่ระบุ Version (ตามสเปกหลัก v10 ข้อ 5.3) — ดูรายละเอียดเต็มในเอกสารสเปกหลัก `WebApp ค่าเดินทาง Spec v10`

---

## 7. จุดที่ต้องทดสอบ (QA Checklist)

**Authentication:**
- [ ] LINE UID ที่มีอยู่แล้วใน `Approve_users.line_uid` (Active=TRUE) → เข้าระบบทันทีไม่ต้องกรอกรหัส
- [ ] LINE UID ที่ยังไม่เคยลงทะเบียน → ขึ้นหน้ากรอกรหัส กรอกรหัสถูกต้อง → ลงทะเบียนสำเร็จ, `line_uid` ใน Sheet ถูกเขียนทับเป็น LINE UID จริง
- [ ] หลังลงทะเบียนสำเร็จ (ข้อบน) → เปิดแอปใหม่อีกครั้งด้วย LINE UID เดิม → เข้าระบบได้ทันทีไม่ต้องกรอกรหัสซ้ำ
- [ ] กรอกรหัสที่เคยถูกใช้ไปแล้ว (ถูก overwrite แล้ว) → ต้องขึ้น `INVALID_CODE` ไม่สามารถ Bind ซ้ำได้
- [ ] แถวที่ `Active = FALSE` แม้ `line_uid` จะตรงก็ต้องเข้าระบบไม่ได้ (ถือเป็นยังไม่พบ)

**Approval Queue:**
- [ ] ผู้อนุมัติ A เห็นเฉพาะรายการที่ `Approver = "A"` และ `Status = "PENDING"` เท่านั้น ไม่เห็นของผู้อนุมัติ B
- [ ] มีรายการ Pending มากกว่า `APPROVAL_BATCH_SIZE` → แสดงแค่ชุดแรกตามจำนวนที่ตั้งไว้ พร้อม `remaining_count` ถูกต้อง
- [ ] ปรับ `APPROVAL_BATCH_SIZE` ใน `Config.gs` (เช่น 4 → 6) → จำนวนที่แสดงต่อชุดเปลี่ยนตามทันทีไม่ต้องแก้โค้ดจุดอื่น
- [ ] เลือกหลายรายการ (Checkbox) แล้วกด Approve → ทุกรายการที่เลือกเปลี่ยนเป็น `APPROVED` พร้อม `Approve_Datetime` ถูกเขียนถูกต้อง (Timezone Asia/Bangkok)
- [ ] เลือกหลายรายการแล้วกด Reject → ทุกรายการเปลี่ยนเป็น `REJECTED` พร้อม `Approve_Datetime` เขียนเช่นกัน
- [ ] Approve/Reject เสร็จแล้ว → ระบบดึงชุดถัดไปมาแสดงอัตโนมัติโดยไม่ต้องกดปุ่มอื่นเพิ่ม
- [ ] อนุมัติ/ไม่อนุมัติจนหมดคิว → ขึ้นข้อความ "ไม่พบรายการรออนุมัติ" ถูกต้อง

**Primary Key / Race Condition:**
- [ ] จำลอง 2 แท็บเปิดพร้อมกันเป็นผู้อนุมัติคนเดียวกัน เลือกรายการเดียวกันแล้วกด Approve พร้อมกัน → แท็บที่ 2 (ที่ทำงานทีหลัง) ต้องได้ `ALREADY_PROCESSED` ใน `skipped` ไม่เขียนทับซ้ำ ไม่ error ทั้ง Request
- [ ] จำลอง `Transaction_ID` ที่เลือกไว้ถูกลบออกจาก Sheet ไปแล้ว (เช่นโดย `dailyMaintenance()` ของระบบหลัก) ก่อนกด Approve → ได้ `NOT_FOUND` ใน `skipped` ไม่ error ทั้ง Batch รายการอื่นที่เหลือยังอัปเดตได้ตามปกติ
- [ ] เลือก 4 รายการพร้อมกัน (คนละแถวในตำแหน่งไม่ติดกันของ Sheet) แล้ว Approve → ทั้ง 4 แถวถูกอัปเดตถูกต้องตรงตาม `Transaction_ID` ไม่มีแถวไหนถูกอัปเดตผิดตัว (พิสูจน์ Index Map ทำงานถูกต้อง)

**Data Integrity:**
- [ ] แสดงรายการที่มีหลายเส้นทาง (Multi-Trip) → รายการ origin/dest/km ที่ Parse จาก `Trip_Details` ถูกต้องครบทุกเส้นทาง และ badge "ไปกลับ" แสดงถูกต้องตามกฎ Fix/Custom เดียวกับระบบหลัก v10
- [ ] `Net_Total` ที่แสดงตรงกับค่าที่บันทึกไว้ใน Sheet เป๊ะ (แอปนี้ไม่คำนวณซ้ำ)
