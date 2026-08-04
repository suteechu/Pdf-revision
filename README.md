<div align="center">
  <h1>📄 Auto PDF REPLACER CR</h1>
  <p><strong>A smart automation tool for scanning, matching, and replacing PDF drawing pages using OCR.</strong></p>
  
  !React
  !Vite
  !Tesseract.js
  !PDF-lib
</div>

---

## 📌 About The Project (เกี่ยวกับโปรเจกต์)

**Auto PDF REPLACER CR** คือเว็บแอปพลิเคชันที่พัฒนาขึ้นเพื่อลดเวลาในการทำงานกับไฟล์เอกสารแบบก่อสร้าง (Drawing) โดยระบบจะทำการสแกนหา "รหัสแบบ (Drawing ID)" จากไฟล์ที่ถูกแก้ไข (CR Files) ด้วยเทคโนโลยี **OCR (Optical Character Recognition)** จากนั้นนำไปค้นหาและ **สวมทับ (Replace) หรือต่อท้าย (Append)** ลงในไฟล์ Master อัตโนมัติ พร้อมระบบคัดกรองหมวดหมู่ (Filtering) 

## ✨ Key Features (ความสามารถหลัก)

- 🚀 **Automated PDF Manipulation:** อัปเดตไฟล์ Master ได้ในคลิกเดียว (ลบหน้าเก่า, แทรกหน้าใหม่, ต่อท้ายหน้าใหม่)
- 👁️ **Smart OCR Engine:** อ่านรหัสแบบจากรูปภาพใน PDF โดยใช้ `tesseract.js` (รองรับภาษาอังกฤษและภาษาไทยสำหรับหน้าปก)
- 🎛️ **Dual OCR Channels:** ตั้งค่าพื้นที่การสแกน (Crop Area) ได้ 2 รูปแบบ (Main & Fallback) เพื่อความแม่นยำสูงสุด
- 📺 **Live Vision Preview:** หน้าต่างทดสอบการสแกน OCR แบบเรียลไทม์ (Test Scan)
- 🚦 **Pre-Flight Check:** ระบบหยุดรอให้ผู้ใช้ตรวจสอบและยืนยัน/บังคับบันทึก (Force Save) ก่อนดำเนินการแก้ไขไฟล์จริง
- 📊 **Execution Report:** สรุปผลการทำงาน (Order Book) พร้อม Export Log ออกเป็นไฟล์ `.txt` ได้
- 🌗 **Dark / Light Theme:** ปรับเปลี่ยนธีมของแอปพลิเคชันเพื่อความสบายตา

---

## 🛠️ Built With (เทคโนโลยีที่ใช้)

- React.js - UI Library
- Vite - Build Tool
- pdfjs-dist - PDF Parsing & Rendering for OCR
- pdf-lib - PDF Modification (Copy, Insert, Remove pages)
- tesseract.js - Pure Javascript OCR
- SweetAlert2 - Beautiful Popup Notifications

---

## 🚀 Getting Started (การติดตั้งและใช้งาน)

### Prerequisites
- Node.js (v16 หรือสูงกว่า)
- npm หรือ yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/FloorPlan-Revised-CR-Auto-app.git
```

2. Navigate to the project directory:
```bash
cd FloorPlan-Revised-CR-Auto-app
```

3. Install dependencies:
```bash
npm install
# or
yarn install
```

4. Start the development server:
```bash
npm run dev
# or
yarn dev
```

---

## 📖 How to Use (วิธีใช้งานเบื้องต้น)

1. **Upload Files:** ลากไฟล์ Master PDF วางที่ช่อง `[1] ไฟล์ MASTER` และลากไฟล์ที่ต้องการแก้ไขวางที่ช่อง `[2] ไฟล์แก้ไข CR` (รองรับหลายไฟล์)
2. **Configure Filters:** เลือกหมวดหมู่ (เช่น AR, IN, EE) ที่ต้องการสแกน หมวดหมู่ที่ไม่ได้เลือกจะถูกลบ (Purge) ออกจากไฟล์ Master อัตโนมัติ
3. **Adjust OCR (Optional):** หากรหัสแบบอยู่ผิดตำแหน่ง สามารถกด `ตั้งค่า OCR` เพื่อปรับจุดตัดภาพ (Crop Area)
4. **Execute:** กดปุ่ม `⚡ EXECUTE BATCH` เพื่อให้ระบบเริ่มสแกน
5. **Pre-Flight Check:** หากมีหน้าไหนที่หารหัสไม่พบ ระบบจะเด้งหน้าต่างให้คุณใส่รหัสแบบแมนนวล หากปล่อยว่างจะเป็นการสั่งลบทิ้ง (Drop)
6. **Download:** ตรวจสอบสรุปผลและกด `ดาวน์โหลด PDF` 

---

## 📁 Project Structure (โครงสร้างไฟล์)

```text
src/
 ├── App.jsx             # Main Application UI
 ├── App.css             # Global Styles & Theming
 ├── usePdfProcessor.js  # Custom Hook (Core Business Logic & PDF manipulation)
 ├── ocrUtils.js         # OCR Image Cropping & Tesseract configurations
 ├── PreFlightModal.jsx  # Modal for user confirmation before executing
 ├── OcrConfigModal.jsx  # Modal for live OCR testing & tuning
 └── HelpModal.jsx       # User Manual Modal
```

---

## 👤 Author

**@The Toi**

*Project crafted for Architectural & Engineering Document Management.*
