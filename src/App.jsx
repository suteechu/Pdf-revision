import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import Tesseract from 'tesseract.js';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function App() {
  const [masterFile, setMasterFile] = useState(null);
  const [crFiles, setCrFiles] = useState([]); 
  const [logs, setLogs] = useState([]); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [crSummary, setCrSummary] = useState([]); 
  const [stats, setStats] = useState({ replaced: 0, purged: 0, appended: 0 });
  const [downloadFilename, setDownloadFilename] = useState("Updated_Master.pdf");
  
  const [progress, setProgress] = useState(0);
  const [dragMaster, setDragMaster] = useState(false);
  const [dragCr, setDragCr] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const [showOcrConfig, setShowOcrConfig] = useState(false);
  
  // 🌟 ตั้งค่าครอบตัด 2 ชุด
  const [cropConfig, setCropConfig] = useState({ width: 15, height: 25 }); 
  const [altCropConfig, setAltCropConfig] = useState({ width: 35, height: 25 }); 

  const [previewData, setPreviewData] = useState({ 
    image1: null, rawText1: '', match1: '', 
    image2: null, rawText2: '', match2: '', 
    image3: null, rawText3: '', match3: '', // 🌟 เพิ่ม Data สำหรับก๊อก 3 (หน้าปก)
    isLoading: false 
  });
  
  const [testPageNum, setTestPageNum] = useState(1);
  const [reviewData, setReviewData] = useState(null); 
  const [manualInputs, setManualInputs] = useState({}); 

  const logEndRef = useRef(null);
  const scrollToBottom = () => logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [logs]);

  const addLog = (msg) => setLogs((prev) => [...prev, msg]);

  // 🌟 ฟังก์ชัน OCR ก๊อก 1 & 2 (สแกนมุมขวาล่าง หาเลขแบบ Eng)
  const processOcrOnPage = async (pdf, pageNum, config) => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 3.0 }); 
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport: viewport }).promise;

    const cropWidth = viewport.width * (config.width / 100); 
    const cropHeight = viewport.height * (config.height / 100); 
    const cropX = viewport.width - cropWidth;
    const cropY = viewport.height - cropHeight;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedContext = croppedCanvas.getContext('2d');
    croppedContext.imageSmoothingEnabled = false; 
    croppedContext.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    
    const imageUrl = croppedCanvas.toDataURL('image/png');
    const { data: { text } } = await Tesseract.recognize(imageUrl, 'eng', { 
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_./()', 
      tessedit_pageseg_mode: '6', 
    });

    let cleanText = text.replace(/\s+/g, '').toUpperCase(); 
    cleanText = cleanText.replace(/[OQ]/g, '0'); 
    cleanText = cleanText.replace(/[L|!]/g, 'I'); 
    cleanText = cleanText.replace(/1N/g, 'IN');  
    cleanText = cleanText.replace(/IM/g, 'IN');  
    cleanText = cleanText.replace(/(AR|AD|AC|EE|IN|ME|SN|ST)D/g, '$10'); 

    const match = cleanText.match(/(AR|AD|AC|EE|IN|ME|SN|ST)\d*[-_.]\d+(?:[-_.]\d+)?/); 
    
    let finalMatch = null;
    if (match) {
      const parts = match[0].split(/[-_.]/);
      if (parts.length === 3) finalMatch = `${parts[0]}-${parts[1]}_${parts[2]}`;
      else if (parts.length === 2) finalMatch = `${parts[0]}-${parts[1]}`;
      else finalMatch = match[0];
    }

    return { imageUrl, cleanText, finalMatch };
  };

  // 🌟 ฟังก์ชัน OCR ก๊อก 3 (สแกนครึ่งบน หาข้อความหน้าปก ไทย+Eng)
  const processCoverOcr = async (pdf, pageNum) => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // ลด Scale ลงนิดนึงเพื่อความเร็ว เพราะตัวหนังสือหน้าปกใหญ่
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport: viewport }).promise;

    // ครอบตัดเฉพาะครึ่งบนของกระดาษ (Top 40%)
    const cropWidth = viewport.width;
    const cropHeight = viewport.height * 0.40;
    const cropX = 0;
    const cropY = 0;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedContext = croppedCanvas.getContext('2d');
    croppedContext.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    
    const imageUrl = croppedCanvas.toDataURL('image/png');
    // โหลด 2 ภาษา (tha+eng) เพื่อให้อ่านคำว่า "แบบและรายละเอียดการก่อสร้าง" ได้
    const { data: { text } } = await Tesseract.recognize(imageUrl, 'tha+eng', { 
      tessedit_pageseg_mode: '6', 
    });

    const cleanText = text.replace(/\s+/g, ''); 
    // เช็คว่ามีคีย์เวิร์ดของหน้าปกไหม
    const isCover = /แบบและราย|การก่อสร้าง|โครงการ|เจ้าของ|SMART|CUSTOMIZE/i.test(cleanText);

    return { imageUrl, rawText: text, isCover };
  };

  const handleTestOcr = async () => {
    const fileToTest = masterFile || (crFiles.length > 0 ? crFiles[0] : null);
    if (!fileToTest) {
      alert('กรุณาอัปโหลดไฟล์ Master หรือ CR อย่างน้อย 1 ไฟล์เพื่อใช้ทดสอบครับ');
      return;
    }

    setPreviewData(prev => ({ ...prev, isLoading: true }));
    try {
      const fileBytes = await fileToTest.arrayBuffer();
      const pdfjsDoc = await pdfjsLib.getDocument({ data: fileBytes }).promise;
      
      let targetPage = parseInt(testPageNum) || 1;
      if (targetPage < 1) targetPage = 1;
      if (targetPage > pdfjsDoc.numPages) targetPage = pdfjsDoc.numPages;
      setTestPageNum(targetPage); 

      // 🌟 รันทดสอบ 3 ก๊อกพร้อมกันให้ดูผลลัพธ์
      const res1 = await processOcrOnPage(pdfjsDoc, targetPage, cropConfig); 
      const res2 = await processOcrOnPage(pdfjsDoc, targetPage, altCropConfig); 
      const res3 = await processCoverOcr(pdfjsDoc, targetPage); 
      
      setPreviewData({ 
        image1: res1.imageUrl, rawText1: res1.cleanText, match1: res1.finalMatch || '❌ หาไม่เจอ', 
        image2: res2.imageUrl, rawText2: res2.cleanText, match2: res2.finalMatch || '❌ หาไม่เจอ', 
        image3: res3.imageUrl, rawText3: res3.rawText.substring(0, 50) + '...', match3: res3.isCover ? '✅ หน้าปก (COVER)' : '❌ ไม่ใช่หน้าปก',
        isLoading: false 
      });
    } catch (error) { 
      console.error(error);
      setPreviewData(prev => ({ ...prev, isLoading: false })); 
    }
  };

  const handleScanFiles = async () => {
    if (!masterFile || crFiles.length === 0) return;
    setIsProcessing(true);
    setProgress(5); 
    setLogs([]);
    setCrSummary([]); 
    setStats({ replaced: 0, purged: 0, appended: 0 });
    setDownloadUrl(null);
    setManualInputs({}); 

    const now = new Date();
    const dateStr = now.toISOString().slice(0,10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0,5).replace(/:/g, '');
    setDownloadFilename(`Updated_Master_${dateStr}_${timeStr}.pdf`);

    try {
      addLog('🚀 [1/6] SYSTEM INITIALIZATION: กำลังเริ่มต้นระบบ...');
      const masterBytes = await masterFile.arrayBuffer();
      const masterPdfjs = await pdfjsLib.getDocument({ data: masterBytes.slice(0) }).promise;

      const crDataList = [];
      for (let i = 0; i < crFiles.length; i++) {
        addLog(`   📥 LOADING: กำลังโหลดไฟล์ ${crFiles[i].name}...`);
        const crBytes = await crFiles[i].arrayBuffer();
        const crPdfjs = await pdfjsLib.getDocument({ data: crBytes.slice(0) }).promise;
        crDataList.push({ file: crFiles[i], bytes: crBytes, pdfjs: crPdfjs });
      }

      addLog(`\n🤖 [2/6] TRI-PASS OCR: สแกนไฟล์ CR ด้วยระบบ 3 ก๊อก (ค้นหารหัส & หน้าปก)...`);
      const tempSummary = [];
      setProgress(10);

      for (let i = 0; i < crDataList.length; i++) {
        const crItem = crDataList[i];
        for (let c = 1; c <= crItem.pdfjs.numPages; c++) {
          
          let dwgNo = null;
          let usedAlt = false;
          let isCover = false;

          // 🌟 ก๊อก 1
          let result = await processOcrOnPage(crItem.pdfjs, c, cropConfig);
          dwgNo = result.finalMatch;

          // 🌟 ก๊อก 2
          if (!dwgNo) {
            result = await processOcrOnPage(crItem.pdfjs, c, altCropConfig);
            dwgNo = result.finalMatch;
            usedAlt = true;
          }

          // 🌟 ก๊อก 3 (หาหน้าปก)
          if (!dwgNo) {
            const coverRes = await processCoverOcr(crItem.pdfjs, c);
            if (coverRes.isCover) {
              dwgNo = 'COVER';
              isCover = true;
            }
          }

          if (dwgNo) {
            const baseNo = dwgNo === 'COVER' ? 'COVER' : dwgNo.split('_')[0]; 
            const existingIdx = tempSummary.findIndex(item => item.baseNo === baseNo);
            
            if (existingIdx !== -1) {
              tempSummary[existingIdx] = { dwgNo, baseNo, crPageIndex: c - 1, crFileIndex: i, status: 'searching' };
            } else {
              tempSummary.push({ dwgNo, baseNo, crPageIndex: c - 1, crFileIndex: i, status: 'searching' });
              if (isCover) addLog(`      ✅ ดึงข้อมูล CR สำเร็จ: พบหน้าปก (COVER)`);
              else addLog(`      ✅ ดึงข้อมูล CR สำเร็จ: ${dwgNo} ${usedAlt ? '(ก๊อก 2)' : ''}`);
            }
          } else {
            addLog(`      ⏩ ข้ามหน้า ${c} ของ CR (สแกนทั้ง 3 ก๊อกแล้วไม่พบรหัสหรือปก)`);
          }
          setProgress(10 + Math.round(((i / crDataList.length) + (c / crItem.pdfjs.numPages / crDataList.length)) * 25));
        }
      }
      setCrSummary([...tempSummary]);

      if (tempSummary.length === 0) {
        addLog('\n❌ ABORT: ยกเลิกการทำงาน ไม่พบเลขแบบก่อสร้างในไฟล์ CR ที่แนบมาครับ');
        setIsProcessing(false); setProgress(0); return;
      }

      addLog(`\n🔍 [3/6] MASTER INDEXING: สแกน Master (${masterPdfjs.numPages} หน้า) เพื่อค้นหาเป้าหมาย...`);
      const masterIndicesMap = {}; 
      const pagesToDelete = []; 
      
      for (let m = 1; m <= masterPdfjs.numPages; m++) {
        if (m % 10 === 0 || m === 1) addLog(`   ⏳ สแกน Master... ${Math.round((m/masterPdfjs.numPages)*100)}%`);
        
        let dwgNo = null;
        let isCover = false;

        // 🌟 ก๊อก 1
        let result = await processOcrOnPage(masterPdfjs, m, cropConfig);
        dwgNo = result.finalMatch;

        // 🌟 ก๊อก 2
        if (!dwgNo) {
          result = await processOcrOnPage(masterPdfjs, m, altCropConfig);
          dwgNo = result.finalMatch;
        }

        // 🌟 ก๊อก 3 (หาหน้าปกใน Master)
        if (!dwgNo) {
          const coverRes = await processCoverOcr(masterPdfjs, m);
          if (coverRes.isCover) {
            dwgNo = 'COVER';
            isCover = true;
            addLog(`   🛡️ พบหน้าปก (COVER) ที่ Master หน้า ${m} -> ป้องกันการลบทิ้งอัตโนมัติ`);
          }
        }

        if (dwgNo) {
          const baseNo = dwgNo === 'COVER' ? 'COVER' : dwgNo.split('_')[0]; 
          masterIndicesMap[baseNo] = m - 1; 
          
          const foundIndex = tempSummary.findIndex(item => item.baseNo === baseNo);
          if (foundIndex !== -1) {
            tempSummary[foundIndex].status = 'success';
            setCrSummary([...tempSummary]); 
            addLog(`   🎯 เจอคู่แมตช์! [${tempSummary[foundIndex].dwgNo}] -> จะแทนที่ Master หน้า ${m}`);
          }
        } else {
          // ถ้า 3 ก๊อกหาไม่เจอจริงๆ ถึงจะเอาไปรอประหาร (ลบทิ้ง)
          pagesToDelete.push(m - 1);
          addLog(`   🗑️ เตรียมลบทิ้ง: หน้า ${m} (สแกน 3 ก๊อกไม่พบข้อมูล)`);
        }
        setProgress(35 + Math.round((m / masterPdfjs.numPages) * 15));
      }

      if (pagesToDelete.length > 0) {
        addLog(`\n⏸️ SYSTEM PAUSED: รอการตรวจสอบและยืนยันจากผู้ใช้งาน...`);
        setReviewData({ tempSummary, masterIndicesMap, pagesToDelete, masterBytes, crDataList });
        setProgress(50);
      } else {
        // ถ้าไม่มีหน้าขยะให้ตรวจ ก็รันต่อให้จบเลย
        await executeFinalPhase({ tempSummary, masterIndicesMap, pagesToDelete, masterBytes, crDataList }, {});
      }

    } catch (e) { 
      addLog(`\n🚨 CRITICAL ERROR: ${e.message}`); 
      setIsProcessing(false); setProgress(0);
    }
  };

  // 🌟 ฟังก์ชันสำหรับทำงานต่อหลังตรวจหน้าขยะ
  const executeFinalPhase = async (data, userInputs) => {
    try {
      let finalMasterMap = { ...data.masterIndicesMap };
      let finalPagesToDelete = [...data.pagesToDelete];
      let finalTempSummary = [...data.tempSummary];

      Object.keys(userInputs).forEach(idxStr => {
        const pIdx = parseInt(idxStr);
        const dwgNo = userInputs[idxStr].trim().toUpperCase();
        
        if (dwgNo) {
          const baseNo = dwgNo === 'COVER' ? 'COVER' : dwgNo.split('_')[0];
          finalMasterMap[baseNo] = pIdx; 
          finalPagesToDelete = finalPagesToDelete.filter(id => id !== pIdx); 

          const sumIdx = finalTempSummary.findIndex(item => item.baseNo === baseNo);
          if (sumIdx !== -1 && finalTempSummary[sumIdx].status === 'searching') {
            finalTempSummary[sumIdx].status = 'success';
            addLog(`   🎯 MANUAL MATCH: บังคับจับคู่ [${finalTempSummary[sumIdx].dwgNo}] กับ Master หน้า ${pIdx + 1}`);
          } else {
            addLog(`   💾 MANUAL SAVE: ป้องกันการลบหน้า ${pIdx + 1} (ระบุเป็น: ${dwgNo})`);
          }
        }
      });

      finalTempSummary.forEach(item => {
        if (item.status === 'searching') {
          if (finalMasterMap[item.baseNo] !== undefined) {
             item.status = 'success';
          } else {
             item.status = 'new_append';
             addLog(`   🆕 ไม่พบรหัส ${item.baseNo} ใน Master -> เตรียมเพิ่มเป็นแบบใหม่`);
          }
        }
      });
      setCrSummary([...finalTempSummary]); 
      setProgress(60);

      addLog('\n✂️ [4/6] BATCH REPLACEMENT: กำลังผ่าตัดสลับหน้า (Replace)...');
      const masterDoc = await PDFDocument.load(data.masterBytes);
      
      const loadedCrDocs = [];
      for (let i = 0; i < data.crDataList.length; i++) {
        loadedCrDocs.push(await PDFDocument.load(data.crDataList[i].bytes));
      }

      let replacedCount = 0;
      for (const item of finalTempSummary) {
        if (item.status === 'success') {
          const targetIdx = finalMasterMap[item.baseNo];
          const crDoc = loadedCrDocs[item.crFileIndex];
          const [crPage] = await masterDoc.copyPages(crDoc, [item.crPageIndex]);
          masterDoc.removePage(targetIdx);
          masterDoc.insertPage(targetIdx, crPage);
          replacedCount++;
        }
      }
      setProgress(80);

      addLog(`\n🧹 [5/6] AUTO-PURGE: กำลังลบหน้าขยะ... ลบทิ้งทั้งหมด ${finalPagesToDelete.length} แผ่น`);
      finalPagesToDelete.sort((a, b) => b - a);
      for (const idx of finalPagesToDelete) {
        masterDoc.removePage(idx);
      }
      setProgress(90);

      const newPages = finalTempSummary.filter(item => item.status === 'new_append');
      let appendedCount = 0;
      
      if (newPages.length > 0) {
        addLog(`\n➕ [6/6] AUTO-APPEND: กำลังเพิ่มและจัดเรียงแบบใหม่ (${newPages.length} แผ่น)...`);
        const categoryOrder = ['COVER', 'AR', 'IN', 'EE', 'AC', 'ST', 'ME', 'SN', 'AD'];
        
        newPages.sort((a, b) => {
          const prefixA = a.dwgNo === 'COVER' ? 'COVER' : (a.dwgNo.match(/^[A-Z]+/) || [''])[0];
          const prefixB = b.dwgNo === 'COVER' ? 'COVER' : (b.dwgNo.match(/^[A-Z]+/) || [''])[0];
          const orderA = categoryOrder.indexOf(prefixA) !== -1 ? categoryOrder.indexOf(prefixA) : 99;
          const orderB = categoryOrder.indexOf(prefixB) !== -1 ? categoryOrder.indexOf(prefixB) : 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.dwgNo.localeCompare(b.dwgNo);
        });

        for (const item of newPages) {
          const crDoc = loadedCrDocs[item.crFileIndex];
          const [crPage] = await masterDoc.copyPages(crDoc, [item.crPageIndex]);
          
          // ถ้าเป็นปกใหม่ที่เพิ่มเข้ามา ให้เอาไปไว้หน้าแรกสุดเลย
          if (item.dwgNo === 'COVER') {
             masterDoc.insertPage(0, crPage);
          } else {
             masterDoc.addPage(crPage); 
          }
          appendedCount++;
          addLog(`   ➕ เพิ่มสำเร็จ: [${item.dwgNo}]`);
        }
      }
      
      setStats({ replaced: replacedCount, purged: finalPagesToDelete.length, appended: appendedCount });
      setProgress(100);

      if (replacedCount > 0 || finalPagesToDelete.length > 0 || appendedCount > 0) {
        addLog(`\n🎉 OPERATION COMPLETE: ดำเนินการเสร็จสมบูรณ์!`);
        const finalBytes = await masterDoc.save();
        setDownloadUrl(URL.createObjectURL(new Blob([finalBytes], { type: 'application/pdf' })));
        addLog('✅ สร้างไฟล์ Master อัปเดตสำเร็จ พร้อมให้ดาวน์โหลดแล้วครับ');
      } else {
        addLog('\n🚨 ZERO MODIFICATIONS: ไม่มีการแก้ไขไฟล์ใดๆ เกิดขึ้น');
      }

    } catch (e) { 
      addLog(`\n🚨 CRITICAL ERROR: ระบบขัดข้อง: ${e.message}`); 
      setProgress(0);
    }
    finally { setIsProcessing(false); }
  };

  const handleConfirmExecute = () => {
    setReviewData(null); 
    addLog('\n✅ USER CONFIRMED: นำข้อมูลที่ยืนยันมาประมวลผลต่อ...');
    executeFinalPhase(reviewData, manualInputs);
  };

  const exportLogReport = () => {
    const reportContent = `===========================================
PDF BATCH REPLACER - EXECUTION REPORT
===========================================
Generated: ${new Date().toLocaleString('th-TH')}
System Auth: @The Toi

--- SUMMARY STATISTICS ---
✅ Replaced (สลับทับหน้าเดิม): ${stats.replaced} แผ่น
➕ Appended (เพิ่มแบบใหม่ต่อท้าย): ${stats.appended} แผ่น
🗑️ Purged (ลบหน้าปก/ขยะทิ้ง): ${stats.purged} แผ่น

--- DRAWING STATUS ---
${crSummary.map(item => {
  let stat = '';
  if(item.status === 'success') stat = '[REPLACED]';
  else if(item.status === 'new_append') stat = '[APPENDED]';
  else stat = '[ERROR]';
  return `- ${item.dwgNo.padEnd(15)} : ${stat}`;
}).join('\n')}

===========================================
--- DETAILED SYSTEM LOGS ---
===========================================
${logs.join('\n')}
`;
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Report_${downloadFilename.replace('.pdf', '.txt')}`;
    link.click();
  };

  return (
    <div className={isDarkMode ? 'theme-dark' : 'theme-light'} style={{ display: 'flex', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', paddingTop: '40px', paddingBottom: '20px', transition: 'background-color 0.3s ease' }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
          
          :root {}
          .theme-dark { --bg-app: #020617; --bg-panel: #0f172a; --text-main: #f8fafc; --text-muted: #94a3b8; --border-color: #1e293b; --upload-bg: #020617; --upload-border: #334155; }
          .theme-light { --bg-app: #f1f5f9; --bg-panel: #ffffff; --text-main: #0f172a; --text-muted: #64748b; --border-color: #e2e8f0; --upload-bg: #f8fafc; --upload-border: #cbd5e1; }
          
          * { box-sizing: border-box; }
          body, html { margin: 0; padding: 0; height: 100%; font-family: 'Prompt', sans-serif; overflow: hidden; }
          .glass-panel { background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; position: relative; transition: all 0.3s ease; }
          
          .upload-box { transition: all 0.3s ease; border: 1px dashed var(--upload-border); background: var(--upload-bg); position: relative; }
          .upload-box:hover { border-color: #3b82f6; background: var(--bg-panel); }
          .upload-box.drag-active { border-color: #10b981 !important; background: rgba(16, 185, 129, 0.05) !important; transform: scale(1.02); }
          
          .btn-run { background: linear-gradient(135deg, #2563eb, #4f46e5); transition: all 0.2s; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.2); }
          .btn-run:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4); }
          .btn-run:disabled { background: var(--border-color); color: var(--text-muted); box-shadow: none; cursor: not-allowed; }
          
          .btn-secondary { background: #334155; transition: all 0.2s; border: 1px solid #475569; color: #f8fafc; }
          .theme-light .btn-secondary { background: #e2e8f0; border-color: #cbd5e1; color: #0f172a; }
          .theme-light .btn-secondary:hover { background: #cbd5e1; }
          .btn-secondary:hover { background: #475569; }
          
          .btn-tool { background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 4px 12px; border-radius: 6px; font-size: 0.7rem; cursor: pointer; transition: all 0.2s; font-family: 'Prompt', sans-serif; font-weight: 600; }
          .btn-tool:hover { background: var(--border-color); color: var(--text-main); }
          .btn-tool.active { border-color: #3b82f6; color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
          
          .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; alignItems: center; z-index: 999; animation: fadeIn 0.2s ease-out; }
          .modal-content { background: var(--bg-panel); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 16px; padding: 30px; width: 90%; max-width: 650px; box-shadow: 0 25px 50px rgba(0,0,0,0.4); position: relative; max-height: 90vh; overflow-y: auto; }
          .modal-close { position: absolute; top: 16px; right: 20px; background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; transition: color 0.2s; }
          .modal-close:hover { color: var(--text-main); }
          
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          .terminal-scroll::-webkit-scrollbar { width: 6px; }
          .terminal-scroll::-webkit-scrollbar-track { background: transparent; }
          .terminal-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
          
          @keyframes pulse-yellow { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
          .status-searching { animation: pulse-yellow 1.5s infinite; }
          
          input[type=file]::file-selector-button { border: none; background: #334155; padding: 6px 14px; border-radius: 6px; color: #f8fafc; cursor: pointer; font-family: 'Prompt', sans-serif; font-size: 0.75rem; margin-right: 12px; transition: background .2s ease-in-out; font-weight: 500; }
          .theme-light input[type=file]::file-selector-button { background: #e2e8f0; color: #0f172a; }
          .theme-light input[type=file]::file-selector-button:hover { background: #cbd5e1; }
          input[type=file]::file-selector-button:hover { background: #475569; }

          input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
          input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: #3b82f6; cursor: pointer; margin-top: -6px; }
          input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; cursor: pointer; background: #334155; border-radius: 2px; }

          .manual-input { flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-app); color: var(--text-main); font-family: 'Prompt', sans-serif; font-size: 0.8rem; transition: border-color 0.2s; }
          .manual-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
        `}
      </style>

      {/* 🌟 Modal: ตรวจสอบและยืนยันก่อนลบ (Pre-Flight Check) */}
      {reviewData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.3rem', color: '#facc15', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🛡️</span> ตรวจสอบความถูกต้องก่อนแก้ไขไฟล์
            </h2>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.6' }}>
              AI สแกนไฟล์ Master เสร็จสิ้น! ตรวจพบหน้าที่ <b>หาเลขแบบไม่เจอ</b> จำนวน {reviewData.pagesToDelete.length} หน้า ซึ่งระบบเตรียมจะ <b>"ลบทิ้งอัตโนมัติ"</b><br/>
              หากหน้าไหนดังกล่าวเป็นแบบก่อสร้างที่แท้จริง <b>โปรดพิมพ์เลขแบบลงในช่องว่าง เพื่อดึงกลับมาใช้จับคู่ครับ</b>
            </div>
            <div className="terminal-scroll" style={{ maxHeight: '280px', overflowY: 'auto', backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
              {reviewData.pagesToDelete.length === 0 ? (
                <div style={{ color: '#10b981', textAlign: 'center', padding: '20px', fontWeight: 'bold' }}>✅ ยอดเยี่ยม! ไม่พบหน้าขยะที่ต้องลบทิ้ง</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {reviewData.pagesToDelete.map(pIdx => (
                    <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-panel)', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ color: '#facc15', fontWeight: 'bold', width: '90px' }}>🗑️ หน้า {pIdx + 1}</span>
                      <span style={{ color: 'var(--text-muted)' }}>👉</span>
                      <input type="text" className="manual-input" placeholder="เว้นว่างเพื่อลบทิ้ง / พิมพ์เลขแบบเพื่อเซฟ (เช่น IN0-01)" value={manualInputs[pIdx] || ''} onChange={(e) => setManualInputs({...manualInputs, [pIdx]: e.target.value.toUpperCase()})} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn-secondary" onClick={() => { setReviewData(null); setIsProcessing(false); setProgress(0); addLog('\n🛑 CANCELED: ผู้ใช้ยกเลิกการประมวลผล กลับสู่โหมดเตรียมพร้อม'); }} style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer' }}>ยกเลิก (Cancel)</button>
              <button className="btn-run" onClick={handleConfirmExecute} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}>⚡ ยืนยันและดำเนินการ (Confirm)</button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 Modal ตั้งค่าและทดสอบ OCR (เพิ่มกล้อง 3) */}
      {showOcrConfig && (
        <div className="modal-overlay" onClick={() => setShowOcrConfig(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <button className="modal-close" onClick={() => setShowOcrConfig(false)}>✖</button>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚙️</span> ตั้งค่าขอบเขตการสแกน (Tri-Pass OCR)
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              ระบบจะสแกนด้วย "กรอบหลัก" ➡️ "กรอบสำรอง" ➡️ "หาหน้าปก (สแกนภาษาไทย)" ตามลำดับอัตโนมัติ
            </div>
            
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '250px', background: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <strong style={{ color: '#34d399', display: 'block', marginBottom: '10px' }}>🎯 กรอบหลัก (Main)</strong>
                <div style={{ marginBottom: '10px' }}><label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-main)', fontSize: '0.8rem' }}>ความกว้าง: {cropConfig.width}%</label><input type="range" min="5" max="50" value={cropConfig.width} onChange={(e) => setCropConfig({...cropConfig, width: parseInt(e.target.value)})} /></div>
                <div><label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-main)', fontSize: '0.8rem' }}>ความสูง: {cropConfig.height}%</label><input type="range" min="5" max="50" value={cropConfig.height} onChange={(e) => setCropConfig({...cropConfig, height: parseInt(e.target.value)})} /></div>
              </div>
              <div style={{ flex: 1, minWidth: '250px', background: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <strong style={{ color: '#c4b5fd', display: 'block', marginBottom: '10px' }}>🚑 กรอบสำรอง (Fallback)</strong>
                <div style={{ marginBottom: '10px' }}><label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-main)', fontSize: '0.8rem' }}>ความกว้าง: {altCropConfig.width}%</label><input type="range" min="5" max="80" value={altCropConfig.width} onChange={(e) => setAltCropConfig({...altCropConfig, width: parseInt(e.target.value)})} /></div>
                <div><label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-main)', fontSize: '0.8rem' }}>ความสูง: {altCropConfig.height}%</label><input type="range" min="5" max="80" value={altCropConfig.height} onChange={(e) => setAltCropConfig({...altCropConfig, height: parseInt(e.target.value)})} /></div>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                <strong style={{ color: 'var(--text-main)' }}>จอพรีวิว 3 ระบบ (Tri-Camera Preview)</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>หน้า:</span>
                  <input type="number" min="1" value={testPageNum} onChange={(e) => setTestPageNum(e.target.value)} style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-main)', textAlign: 'center', fontFamily: 'Prompt' }} />
                  <button onClick={handleTestOcr} disabled={previewData.isLoading || (!masterFile && crFiles.length === 0)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    {previewData.isLoading ? '⏳ กำลังวิเคราะห์...' : '🔍 ทดสอบสแกน'}
                  </button>
                </div>
              </div>

              {/* 🌟 จอพรีวิว 3 กล้อง */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', background: 'var(--bg-panel)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#34d399', marginBottom: '8px', fontWeight: 'bold' }}>กล้อง 1: กรอบหลัก</div>
                  {previewData.image1 ? <div style={{ textAlign: 'center', marginBottom: '10px', border: '1px dashed #34d399', padding: '5px', background: '#000' }}><img src={previewData.image1} alt="Crop 1" style={{ maxWidth: '100%', maxHeight: '80px' }} /></div> : <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', border: '1px dashed var(--border-color)', fontSize: '0.7rem' }}>รอทดสอบ</div>}
                  <div style={{ fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace", color: previewData.match1.includes('❌') ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>RES: {previewData.match1 || '-'}</div>
                </div>

                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', background: 'var(--bg-panel)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#c4b5fd', marginBottom: '8px', fontWeight: 'bold' }}>กล้อง 2: กรอบสำรอง</div>
                  {previewData.image2 ? <div style={{ textAlign: 'center', marginBottom: '10px', border: '1px dashed #c4b5fd', padding: '5px', background: '#000' }}><img src={previewData.image2} alt="Crop 2" style={{ maxWidth: '100%', maxHeight: '80px' }} /></div> : <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', border: '1px dashed var(--border-color)', fontSize: '0.7rem' }}>รอทดสอบ</div>}
                  <div style={{ fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace", color: previewData.match2.includes('❌') ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>RES: {previewData.match2 || '-'}</div>
                </div>

                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', background: 'var(--bg-panel)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#facc15', marginBottom: '8px', fontWeight: 'bold' }}>กล้อง 3: ค้นหาหน้าปก</div>
                  {previewData.image3 ? <div style={{ textAlign: 'center', marginBottom: '10px', border: '1px dashed #facc15', padding: '5px', background: '#000' }}><img src={previewData.image3} alt="Cover Crop" style={{ maxWidth: '100%', maxHeight: '80px' }} /></div> : <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', border: '1px dashed var(--border-color)', fontSize: '0.7rem' }}>รอทดสอบ</div>}
                  <div style={{ fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace", color: previewData.match3.includes('❌') ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>RES: {previewData.match3 || '-'}</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button className="btn-run" onClick={() => setShowOcrConfig(false)} style={{ padding: '8px 30px', borderRadius: '6px', border: 'none', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem' }}>ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal คู่มือการใช้งาน */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowHelp(false)}>✖</button>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.4rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>📖</span> คู่มือการใช้งานระบบ
            </h2>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.7' }}>
              <p>ใส่ไฟล์ <b>Master PDF</b> ช่องซ้าย และ <b>ไฟล์ CR</b> ช่องขวา แล้วกด <b>SCAN & REVIEW</b></p>
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '10px' }}>ความหมายของป้ายสถานะ:</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#34d399' }}>🔄 สีเขียว:</span> สลับทับแผ่นเดิม</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#c4b5fd' }}>➕ สีม่วง:</span> เพิ่มเป็นแบบใหม่ท้ายเล่ม (หน้าปกจะอยู่หน้าสุดเสมอ)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#facc15' }}>🗑️ สีเหลือง:</span> ลบทิ้ง (หน้าปก/ขยะ)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#fde047' }}>⏳ สีน้ำตาล:</span> กำลังสแกนหาใน Master</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button className="btn-run" onClick={() => setShowHelp(false)} style={{ padding: '10px 30px', borderRadius: '8px', border: 'none', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>เข้าใจแล้ว</button>
            </div>
          </div>
        </div>
      )}

      {/* โครงสร้างหลักของแอป */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '1200px', gap: '16px', height: '100%' }}>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'stretch', gap: '20px', flexShrink: 0 }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: '220px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '1.6rem', textShadow: '0 0 10px rgba(59,130,246,0.5)' }}>⚡</span>
                <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', letterSpacing: '0.5px' }}>PDF BATCH REPLACER</h1>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '34px' }}>
                <span style={{ backgroundColor: '#3b82f6', color: '#fff', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>@The Toi</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Auto-Append & Sort</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '6px', paddingLeft: '34px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button className="btn-tool" onClick={() => setShowHelp(true)}>📖 วิธีใช้</button>
              <button className="btn-tool" onClick={() => setShowOcrConfig(true)} style={{ color: '#10b981', borderColor: 'var(--border-color)' }}>⚙️ ตั้งค่า OCR</button>
              <button className={`btn-tool ${!isDarkMode ? 'active' : ''}`} onClick={() => setIsDarkMode(!isDarkMode)}>
                {isDarkMode ? '☀️ สว่าง' : '🌙 มืด'}
              </button>
            </div>
          </div>

          <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '0 5px' }}></div>

          <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
            
            <div 
              className={`upload-box ${dragMaster ? 'drag-active' : ''}`} 
              style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}
              onDragOver={(e) => { e.preventDefault(); setDragMaster(true); }}
              onDragLeave={() => setDragMaster(false)}
              onDrop={(e) => { e.preventDefault(); setDragMaster(false); if(e.dataTransfer.files.length) setMasterFile(e.dataTransfer.files[0]); }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: '700', letterSpacing: '0.5px' }}>1. MASTER PDF</span>
                {masterFile ? <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '600' }}>✓ READY</span> : <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Drag & Drop</span>}
              </div>
              <input type="file" accept="application/pdf" onChange={(e) => setMasterFile(e.target.files[0])} disabled={isProcessing} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '100%' }} />
            </div>

            <div 
              className={`upload-box ${dragCr ? 'drag-active' : ''}`} 
              style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}
              onDragOver={(e) => { e.preventDefault(); setDragCr(true); }}
              onDragLeave={() => setDragCr(false)}
              onDrop={(e) => { e.preventDefault(); setDragCr(false); if(e.dataTransfer.files.length) setCrFiles(Array.from(e.dataTransfer.files)); }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: '700', letterSpacing: '0.5px' }}>2. CR FILES (MULTI)</span>
                {crFiles.length > 0 ? <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: '700' }}>{crFiles.length} FILES</span> : <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Drag & Drop</span>}
              </div>
              <input type="file" multiple accept="application/pdf" onChange={(e) => setCrFiles(Array.from(e.target.files))} disabled={isProcessing} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '100%' }} />
            </div>

          </div>

          <button 
            className="btn-run"
            onClick={handleScanFiles} 
            disabled={!masterFile || crFiles.length === 0 || isProcessing || reviewData} 
            style={{ padding: '0 24px', borderRadius: '8px', border: 'none', color: '#fff', fontWeight: '700', fontSize: '1rem', cursor: 'pointer', minWidth: '160px', letterSpacing: '1px', alignSelf: 'stretch' }}
          >
            {isProcessing ? `${progress}%` : '🚀 SCAN & REVIEW'}
          </button>
        </div>

        {(crSummary.length > 0 || downloadUrl) && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', flexShrink: 0 }}>
            {crSummary.length > 0 && (
              <div className="glass-panel" style={{ flex: 3, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>📊 LIVE TRACKING DASHBOARD ({crSummary.length} ITEMS)</span>
                  {isProcessing && <span style={{ color: '#eab308' }}>SYNCING...</span>}
                </div>
                
                <div className="terminal-scroll" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '85px', overflowY: 'auto' }}>
                  {crSummary.map((item, idx) => {
                    let bg = '#1e293b', text = '#94a3b8', border = '#334155', icon = '';
                    if (item.status === 'success') { bg = '#064e3b'; text = '#34d399'; border = '#059669'; icon = '🔄'; }
                    else if (item.status === 'new_append') { bg = '#4c1d95'; text = '#c4b5fd'; border = '#7c3aed'; icon = '➕'; }
                    else if (item.status === 'searching') { bg = '#713f12'; text = '#fde047'; border = '#ca8a04'; icon = '⏳'; }

                    return (
                      <div key={idx} className={item.status === 'searching' ? 'status-searching' : ''} style={{ 
                        padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600',
                        backgroundColor: bg, color: text, border: `1px solid ${border}`, display: 'flex', gap: '4px', alignItems: 'center'
                      }}>
                        <span>{icon}</span> {item.dwgNo === 'COVER' ? 'หน้าปก (COVER)' : item.dwgNo}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {downloadUrl && (
              <div className="glass-panel" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid #10b981', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px', fontSize: '0.8rem', fontWeight: '600' }}>
                  <span style={{ color: '#34d399' }}>🔄 Replaced: {stats.replaced}</span>
                  <span style={{ color: '#c4b5fd' }}>➕ Appended: {stats.appended}</span>
                  <span style={{ color: '#facc15' }}>🗑️ Purged: {stats.purged}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a href={downloadUrl} download={downloadFilename} style={{ flex: 2, textAlign: 'center', padding: '8px 0', borderRadius: '6px', textDecoration: 'none', color: '#fff', fontSize: '0.8rem', fontWeight: '700', backgroundColor: '#10b981', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    📥 LOAD PDF
                  </a>
                  <button onClick={exportLogReport} className="btn-secondary" style={{ flex: 1, padding: '8px 0', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    📝 LOG
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          <div style={{ width: '100%', height: '3px', backgroundColor: 'var(--border-color)' }}>
            <div style={{ 
              width: `${progress}%`, height: '100%', 
              backgroundColor: '#38bdf8', 
              boxShadow: '0 0 10px #38bdf8, 0 0 5px #38bdf8', 
              transition: 'width 0.4s ease-out' 
            }}></div>
          </div>

          <div style={{ padding: '10px 16px', backgroundColor: '#020617', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#eab308' }}></div>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22c55e' }}></div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '12px', letterSpacing: '1px', fontFamily: "'JetBrains Mono', monospace" }}>
                AI_CORE_TERMINAL_V4 // ระบบอัปเดตและจัดเรียงแบบ
              </span>
            </div>
            <span style={{ fontSize: '0.65rem', color: '#3b82f6', letterSpacing: '1px', fontFamily: "'JetBrains Mono', monospace", opacity: 0.8 }}>
              SYS.AUTH: @The Toi
            </span>
          </div>
          
          <div className="terminal-scroll" style={{ flex: 1, padding: '20px', overflowY: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', lineHeight: '1.6', backgroundColor: '#0f172a' }}>
            {logs.map((log, i) => {
              let logColor = '#38bdf8'; 
              if (log.includes('✅') || log.includes('🎉') || log.includes('🎯')) logColor = '#4ade80'; 
              if (log.includes('❌') || log.includes('🚨') || log.includes('⚠️')) logColor = '#f43f5e'; 
              if (log.includes('⏩') || log.includes('⏳')) logColor = '#94a3b8'; 
              if (log.includes('🗑️') || log.includes('🧹')) logColor = '#facc15'; 
              if (log.includes('➕') || log.includes('🆕')) logColor = '#c084fc'; 
              if (log.includes('⏸️')) logColor = '#eab308'; 
              if (log.includes('💾') || log.includes('🛡️')) logColor = '#facc15'; 
              
              return <div key={i} style={{ marginBottom: '4px', whiteSpace: 'pre-wrap', color: logColor }}>{log}</div>;
            })}
            <div ref={logEndRef} />
            {!logs.length && <div style={{ color: '#64748b' }}>&gt; ระบบพร้อมทำงาน. ลากไฟล์มาวางที่กล่องด้านบนเพื่อเริ่มต้น...</div>}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;