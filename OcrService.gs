/**
 * เรียกใช้ Gemini API สำหรับอ่านบิล
 */
function analyzeInvoice(base64Image, mimeType) {
  const apiKey = Config.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${Config.GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const prompt = `คุณคือผู้เชี่ยวชาญด้านบัญชีไทยที่มีความแม่นยำระดับสูงสุดในการอ่านลายมือเขียนและเอกสารบิลใบเสร็จ ใบกำกับภาษีของไทย
กฎเหล็กและคำสั่งควบคุม (OCR Strict Logic):
1. การสกัดวันที่ (Date Extraction):
   - อ่านวันที่จากภาพตามที่ปรากฏ (เช่น "25/ม.ค./69")
   - หากพบชื่อเดือนภาษาไทย ให้แปลงเป็นตัวเลขเดือนตามเงื่อนไขนี้เสมอ:
     (ม.ค.=01, ก.พ.=02, มี.ค.=03, เม.ย.=04, พ.ค.=05, มิ.ย.=06, ก.ค.=07, ส.ค.=08, ก.ย.=09, ต.ค.=10, พ.ย.=11, ธ.ค.=12)
   - หากปีที่ปรากฏเป็น พ.ศ. (เช่น 69 หรือ 2569 หรือมากกว่าเลขนี้) ให้ลบด้วย 543 เพื่อแปลงเป็น ค.ศ. (เช่น 2026) หากเป็น ค.ศ. อยู่แล้ว ห้ามลบซ้ำ
   - ส่งกลับในรูปแบบ YYYY-MM-DD เท่านั้น
   - If confidence < 90%, default today or this month only.
2. กฎเรื่องภาษี (VAT & Calculations) สำคัญมาก:
   - ห้ามคำนวณ VAT เพิ่มเองเด็ดขาด (Don't calculate VAT yourself)
   - หากในบิลไม่มีบรรทัดที่ระบุภาษีมูลค่าเพิ่มหรือ VAT ให้ใส่ vatAmount = 0.00 ทันที
   - ในกรณีไม่มี VAT: ยอดรวม (totalAmount) ต้องเท่ากับยอดก่อน VAT (preVat)
   - หากเป็น "บิลเงินสด" ที่เขียนมือ มักจะไม่มี VAT ให้ตรวจสอบยอดรวมที่ระบุไว้เป็นหลัก
3. การจัดการความผิดพลาด:
   - หากลายมืออ่านยากหรือไม่ชัดเจน ให้พยายามเทียบเคียงจากบริบทของบิลใบอื่นในชุดข้อมูล หรือส่งค่าที่ใกล้เคียงที่สุดโดยไม่เดาสุ่ม
5. ตอบกลับเป็น JSON บริสุทธิ์เท่านั้น ห้ามมี Markdown หรือคำบรรยาย
6. ข้อมูลที่สกัดได้ต้องตรงตามโครงสร้างนี้:
{
  "taxId": "string (เลข 13 หลักของผู้ขาย)",
  "sellerName": "string (ชื่อบริษัทหรือร้านค้าผู้ขาย)",
  "branchCode": "string (5 หลัก เช่น 00000)",
  "billNumber": "string",
  "billDate": "YYYY-MM-DD",
  "preVat": number,
  "vatAmount": number,
  "totalAmount": number,
  "expenseNote": "string (สรุปจากรายการสินค้าในบิล)"
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          { text: "สกัดข้อมูลบิลนี้เป็น JSON" },
          { inline_data: { mime_type: mimeType, data: base64Image } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          taxId: { type: "string" },
          sellerName: { type: "string" },
          branchCode: { type: "string" },
          billNumber: { type: "string" },
          billDate: { type: "string" },
          preVat: { type: "number" },
          vatAmount: { type: "number" },
          totalAmount: { type: "number" },
          expenseNote: { type: "string" }
        },
        required: ["taxId", "sellerName", "branchCode", "billNumber", "billDate", "preVat", "vatAmount", "totalAmount"]
      }
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode !== 200) {
    Logger.log("Gemini API Error: " + responseBody);
    throw new Error("Gemini API Error: " + responseCode);
  }

  const jsonResponse = JSON.parse(responseBody);
  const contentText = jsonResponse.candidates[0].content.parts[0].text;
  return JSON.parse(contentText);
}
