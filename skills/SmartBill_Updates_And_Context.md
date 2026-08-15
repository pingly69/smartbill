# บันทึกการเปลี่ยนแปลงจาก Spec เดิม (SmartBill Project 1)

เอกสารนี้รวบรวมรายการที่ปรับปรุง เปลี่ยนแปลง หรือเพิ่มเติมจากสเปกเดิม (`Project1_SmartBill.md`) เพื่อใช้เป็น Context ในการทำงานต่อในวันพรุ่งนี้

## 1. สถาปัตยกรรมและการโฮสต์ (Architecture & Hosting)
- **ปัญหา:** LINE LIFF มีปัญหากับ iframe หากโฮสต์หน้าเว็บผ่าน Google Apps Script โดยตรง
- **ทางแก้ (Deviation):** 
  - นำไฟล์ `index.html` ไปฝากไว้บน **GitHub Pages** เป็น Static Website และอัปเดต Endpoint URL ใน LINE LIFF Console เป็นลิงก์ของ GitHub Pages
  - ตัว Google Apps Script (GAS) จะทำหน้าที่เป็น Backend API (Router ผ่าน `doPost`) รับข้อมูลแบบ Cross-Origin Resource Sharing (CORS) แทน
  - ในหน้า `index.html` มีการชี้ `WEB_APP_URL` ข้ามไปหา GAS Web App URL โดยใช้ `fetch()` แบบ Simple Request (text/plain) เพื่อหลีกเลี่ยงปัญหา CORS Preflight

## 2. กระบวนการพัฒนาและการ Deploy (Development Workflow)
- **Local Development:** เปลี่ยนนามสกุลไฟล์ Backend จาก `.gs` เป็น `.js` ทั้งหมดในเครื่อง (VS Code) เพื่อให้ Syntax Highlighting และ Intellisense ทำงานได้สมบูรณ์
- **Deployment Script:** 
  - ใช้ `gas_sync.py` ในการอัปโหลดโค้ด (เฉพาะ Backend `.js` และ `appsscript.json`) ขึ้น GAS (สคริปต์แปลง `.js` กลับเป็น `SERVER_JS` อัตโนมัติ)
  - ส่วนไฟล์ `index.html` อาศัยการทำ `git commit` และ `git push` เพื่อนำขึ้น GitHub Pages
- **การจัดการความลับ (Secrets):** สร้างไฟล์ `Setup.js` เป็นตัวช่วย เพื่อให้นำ API Key หรือ ID ต่างๆ ไปเซฟลงใน **Script Properties** ได้ด้วยการกดรันเพียงคลิกเดียว (ป้องกันการ Hardcode คีย์ลงไปในซอร์สโค้ด)

## 3. การเพิ่มประสิทธิภาพ AI และความเร็ว (Performance Optimization)
- **Image Compression (Canvas API):** 
  - ก่อนหน้านี้การแปลงรูปขนาดเต็มจากมือถือเป็น Base64 ทำให้ไฟล์ใหญ่มากและบันทึกช้า
  - **ทางแก้:** เพิ่มลอจิกใน Frontend บีบอัดรูปด้วย Canvas API ก่อนส่ง โดยลดสเกลด้านยาวสุดไม่เกิน **1,200px** และแปลงเป็น JPEG คุณภาพ 80% (0.8) 
  - **ผลลัพธ์:** ทำให้ไฟล์เล็กลงเหลือ 100-300KB โหลดเร็วขึ้นมาก และช่วยประหยัด Token ของฝั่ง Gemini AI แถมอ่านค่าได้เร็วขึ้นโดยที่ตัวอักษรยังชัดเจน

## 4. การปรับปรุง UI และข้อกำหนดทางธุรกิจ (UI & Business Logic Tweaks)
- **หัวข้อแอป:** เปลี่ยนชื่อจาก "SmartBill" เป็น **"SmartBill v2.5"**
- **ฟิลด์วันที่บนบิล:** เพิ่มการดักจับ (Validation) ทั้งฝั่ง HTML (`max` attribute) และลอจิก JS **ห้ามให้ผู้ใช้กรอกวันที่ล่วงหน้า** เกินวันปัจจุบัน
- **ฟิลด์โครงการ:** เปลี่ยนป้ายกำกับจาก "รหัสโครงการ (ถ้ามี)" เป็น **"โครงการ"** และปรับให้เป็นฟิลด์บังคับกรอก (`required`)
- **ชื่อผู้เบิก (Requester Name):** ตอนโหลดหน้าเว็บ จะดึงค่า `Request_Name` จากชีต `users_profile` มาแทนที่ชื่อ LINE ให้อัตโนมัติ (หากมีข้อมูล) เพื่อลดภาระการพิมพ์ของผู้ใช้

---
**Note สำหรับพรุ่งนี้:** 
- ถ้ามีการแก้โค้ดฝั่ง Backend (ไฟล์ `.js`) ต้องรัน `python gas_sync.py push`
- ถ้ามีการแก้โค้ดหน้าจอ (`index.html`) ต้องรัน `git add .`, `git commit ...`, `git push`
