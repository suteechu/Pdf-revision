import React from 'react';

const HelpModal = ({ showHelp, setShowHelp }) => {
  if (!showHelp) {
    return null;
  }

  const sectionStyle = {
    marginBottom: '24px',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '16px'
  };

  const h3Style = {
    color: 'var(--color-primary)',
    marginTop: '0',
    marginBottom: '12px'
  };

  const pStyle = {
    lineHeight: '1.7',
    color: 'var(--text-main)',
    margin: '0 0 10px 0'
  };
  
  const liStyle = {
    marginBottom: '10px',
    lineHeight: '1.6'
  };

  const codeStyle = {
    background: 'var(--upload-bg)',
    padding: '2px 6px',
    borderRadius: '3px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.85rem',
    border: '1px solid var(--border-color)'
  };

  return (
    <div className="modal-overlay" onClick={() => setShowHelp(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <button className="modal-close" onClick={() => setShowHelp(false)}>&times;</button>
        <h2 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          คู่มือการใช้งาน (MANUAL)
        </h2>
        
        <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px 10px 0 0' }} className="terminal-scroll">
          
          <div style={sectionStyle}>
            <h3 style={h3Style}>1. ภาพรวม (Overview)</h3>
            <p style={pStyle}>
              <strong>FloorPlan-Revised-CR-Auto</strong> เป็นเครื่องมือสำหรับอัปเดตชุดแบบแปลนหลัก (Master PDF) ด้วยหน้าแบบที่แก้ไขจากเอกสารแจ้งการเปลี่ยนแปลง (Change Request - CR) โดยอัตโนมัติ
            </p>
            <p style={pStyle}>
              กระบวนการหลักของโปรแกรมประกอบด้วย: <strong>การแทนที่ (Replace)</strong>, <strong>การเพิ่ม (Append)</strong>, และ <strong>การลบ (Purge)</strong> หน้าเอกสาร เพื่อให้ได้ไฟล์ PDF ที่เป็นเวอร์ชันล่าสุด
            </p>
          </div>

          <div style={sectionStyle}>
            <h3 style={h3Style}>2. ขั้นตอนการใช้งาน (Step-by-Step Guide)</h3>
            <ol style={{ paddingLeft: '20px' }}>
              <li style={liStyle}>
                <strong>เตรียมไฟล์:</strong>
                <ul style={{ marginTop: '8px' }}>
                  <li><strong>ไฟล์ Master:</strong> คือไฟล์ PDF ที่เป็นชุดแบบแปลนหลักฉบับสมบูรณ์</li>
                  <li><strong>รายการ CR:</strong> คือไฟล์ PDF ของแบบที่แก้ไข โดยแต่ละไฟล์อาจมี 1 หน้าหรือหลายหน้าก็ได้ โปรแกรมจะใช้เทคโนโลยี OCR เพื่ออ่านหมายเลขแบบ (Drawing Number) จากไฟล์เหล่านี้</li>
                </ul>
              </li>
              <li style={liStyle}>
                <strong>อัปโหลดไฟล์:</strong>
                <ul style={{ marginTop: '8px' }}>
                  <li>ลากไฟล์ Master PDF วางในกล่อง <code style={codeStyle}>[1] ไฟล์ MASTER</code> หรือกดปุ่มเพื่อเลือกไฟล์</li>
                  <li>ลากไฟล์ CR ทั้งหมดวางในกล่อง <code style={codeStyle}>[2] รายการ CR</code> หรือกดปุ่มเพื่อเลือกไฟล์ (สามารถเลือกได้หลายไฟล์พร้อมกัน)</li>
                </ul>
              </li>
              <li style={liStyle}>
                <strong>เลือกหมวดหมู่ (Filter Categories):</strong>
                <p style={pStyle}>
                  ที่ส่วนหัวของโปรแกรม คุณสามารถกดปุ่มหมวดหมู่ (เช่น <code style={codeStyle}>AR</code>, <code style={codeStyle}>ST</code>, <code style={codeStyle}>EE</code>) เพื่อเลือกประมวลผลเฉพาะไฟล์ CR ที่มีชื่อตรงตามหมวดหมู่ที่เลือก (ตัวอักษร 2 ตัวแรกของชื่อไฟล์) ปุ่มสีเขียวคือ "เปิดใช้งาน" และปุ่มสีแดงคือ "ข้าม"
                </p>
              </li>
              <li style={liStyle}>
                <strong>เริ่มการประมวลผล (Execute Batch):</strong>
                <p style={pStyle}>
                  กดปุ่ม <code style={codeStyle}>⚡ เริ่มทำงาน</code> โปรแกรมจะเริ่มสแกนไฟล์ Master และ CR ทั้งหมดเพื่อจับคู่หมายเลขแบบที่ตรงกัน คุณสามารถดูความคืบหน้าได้ในส่วน "Terminal"
                </p>
              </li>
              <li style={liStyle}>
                <strong>ตรวจสอบก่อนยืนยัน (Pre-flight Check):</strong>
                <p style={pStyle}>
                  หลังจากสแกนเสร็จ จะมีหน้าต่าง "Pre-flight Check" ปรากฏขึ้นเพื่อให้คุณตรวจสอบแผนการทำงานทั้งหมด:
                </p>
                <ul style={{ marginTop: '8px' }}>
                  <li><strong style={{color: 'var(--color-up)'}}>REPLACED:</strong> รายการหน้าที่จะถูกแทนที่ (แสดงภาพตัวอย่าง ก่อน-หลัง)</li>
                  <li><strong style={{color: 'var(--color-primary)'}}>APPENDED:</strong> รายการหน้าใหม่ที่จะถูกเพิ่มต่อท้ายไฟล์ Master</li>
                  <li><strong style={{color: 'var(--color-down)'}}>PURGED:</strong> รายการหน้าในไฟล์ Master ที่จะถูกลบออก (เนื่องจากมีเวอร์ชันใหม่มาแทนที่)</li>
                  <li><strong style={{color: 'var(--color-warning)'}}>UNRESOLVED:</strong> รายการ CR ที่โปรแกรมไม่สามารถจับคู่ได้ คุณสามารถป้อนหมายเลขหน้าของไฟล์ Master ที่ต้องการให้แทนที่ได้ด้วยตนเอง หากเว้นว่างไว้ จะถือว่าเป็นการเพิ่มหน้าใหม่ (Append)</li>
                  <li><strong>สำคัญ:</strong> คุณสามารถยกเลิกการทำงานแต่ละรายการได้โดยการกดปุ่ม <code style={codeStyle}>&times;</code> ที่อยู่ด้านหน้ารายการนั้นๆ</li>
                </ul>
              </li>
              <li style={liStyle}>
                <strong>ยืนยันและสร้างไฟล์ (Confirm & Execute):</strong>
                <p style={pStyle}>
                  เมื่อตรวจสอบแผนการทำงานจนพอใจแล้ว ให้กดปุ่ม <code style={codeStyle}>Confirm & Execute</code> เพื่อเริ่มกระบวนการสร้างไฟล์ PDF ฉบับใหม่
                </p>
              </li>
              <li style={liStyle}>
                <strong>ดาวน์โหลด (Download):</strong>
                <p style={pStyle}>
                  เมื่อกระบวนการเสร็จสิ้น จะมีกล่อง "Summary" ปรากฏขึ้นมา
                </p>
                 <ul style={{ marginTop: '8px' }}>
                  <li>กดปุ่ม <code style={codeStyle}>ดาวน์โหลด PDF</code> เพื่อบันทึกไฟล์ที่เสร็จสมบูรณ์</li>
                  <li>กดปุ่ม <code style={codeStyle}>Export Log</code> เพื่อดาวน์โหลด Log การทำงานทั้งหมดเป็นไฟล์ .txt</li>
                </ul>
              </li>
            </ol>
          </div>

          <div style={{...sectionStyle, borderBottom: 'none'}}>
            <h3 style={h3Style}>3. การตั้งค่าและปุ่มอื่นๆ (Settings & Other Buttons)</h3>
            <ul style={{ paddingLeft: '20px' }}>
              <li style={liStyle}>
                <strong>ตั้งค่า OCR:</strong> สำหรับผู้ใช้ขั้นสูง เพื่อปรับตำแหน่งและขนาดของพื้นที่ที่โปรแกรมจะสแกนหาหมายเลขแบบบนหน้ากระดาษ ควรปรับเมื่อโปรแกรมอ่านหมายเลขแบบผิดพลาด
              </li>
              <li style={liStyle}>
                <strong>คู่มือ:</strong> เปิดหน้าต่างคู่มือการใช้งานนี้
              </li>
              <li style={liStyle}>
                <strong>สว่าง/มืด:</strong> เปลี่ยนธีมสีของโปรแกรม
              </li>
              <li style={liStyle}>
                <strong>เริ่มใหม่:</strong> ล้างข้อมูลไฟล์ที่อัปโหลดและ Log ทั้งหมด เพื่อเริ่มต้นการทำงานใหม่
              </li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HelpModal;