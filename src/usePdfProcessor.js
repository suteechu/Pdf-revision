import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import Tesseract from 'tesseract.js';
import Swal from 'sweetalert2';
import { processOcrOnPage, processCoverOcr, getPageImageBase64 } from './ocrUtils';
import { extractDrawingIdWithGemini } from './aiUtils';

export default function usePdfProcessor(masterFile, crFiles, activeCategories, cropConfig, altCropConfig, crListCropConfig, coverCropConfig, isDarkMode, CATEGORIES, aiEnabled, geminiApiKey) {
  const [logs, setLogs] = useState([]); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [crSummary, setCrSummary] = useState([]); 
  const [stats, setStats] = useState({ replaced: 0, purged: 0, appended: 0 });
  const [downloadFilename, setDownloadFilename] = useState("Updated_Master.pdf");
  
  const [progress, setProgress] = useState(0);
  const [previewData, setPreviewData] = useState({ 
    image1: null, rawText1: '', match1: '', 
    image2: null, rawText2: '', match2: '', 
    image3: null, rawText3: '', match3: '',
    image4: null, rawText4: '', match4: '',
    isLoading: false 
  });
  
  const [testPageNum, setTestPageNum] = useState(1);
  const [reviewData, setReviewData] = useState(null); 
  const [manualInputs, setManualInputs] = useState({}); 

  const addLog = (msg) => setLogs((prev) => [...prev, msg]);

  const resetProcessor = () => {
    setLogs(['> [ระบบ] รีเซ็ตระบบสำเร็จ: พร้อมรับไฟล์และข้อมูลชุดใหม่...']);
    setCrSummary([]);
    setDownloadUrl(null);
    setProgress(0);
    setStats({ replaced: 0, purged: 0, appended: 0 });
    setReviewData(null);
    setManualInputs({});
  };

  const handleTestOcr = async () => {
    const fileToTest = masterFile || (crFiles.length > 0 ? crFiles[0] : null);
    if (!fileToTest) { 
      Swal.fire({
        icon: 'warning',
        title: 'ไม่พบไฟล์',
        text: 'กรุณาอัปโหลดไฟล์ก่อนทำการทดสอบครับ',
        background: 'var(--bg-panel)',
        customClass: {
          popup: isDarkMode ? 'theme-dark' : 'theme-light',
          confirmButton: 'btn-run swal-btn-confirm'
        },
        buttonsStyling: false
      });
      return; 
    }

    const activeCats = CATEGORIES.filter(k => activeCategories[k]);

    setPreviewData(prev => ({ ...prev, isLoading: true }));
    try {
      const fileBytes = await fileToTest.arrayBuffer();
      const pdfjsDoc = await pdfjsLib.getDocument({ data: fileBytes }).promise;
      
      let targetPage = parseInt(testPageNum) || 1;
      if (targetPage < 1) targetPage = 1;
      if (targetPage > pdfjsDoc.numPages) targetPage = pdfjsDoc.numPages;
      setTestPageNum(targetPage); 

      const [res1, res2, res3, res4] = await Promise.all([
        processOcrOnPage(pdfjsDoc, targetPage, cropConfig, activeCats),
        processOcrOnPage(pdfjsDoc, targetPage, altCropConfig, activeCats),
        processCoverOcr(pdfjsDoc, targetPage, coverCropConfig),
        processOcrOnPage(pdfjsDoc, targetPage, crListCropConfig, activeCats)
      ]);
      
      setPreviewData({ 
        image1: res1.imageUrl, rawText1: res1.cleanText, match1: res1.finalMatch || 'N/A', 
        image2: res2.imageUrl, rawText2: res2.cleanText, match2: res2.finalMatch || 'N/A', 
        image3: res3.imageUrl, rawText3: res3.rawText.substring(0, 50) + '...', match3: res3.isCover ? 'COVER_DETECTED' : 'N/A',
        image4: res4.imageUrl, rawText4: res4.cleanText, match4: res4.finalMatch || 'N/A',
        isLoading: false 
      });
    } catch (error) { 
      console.error(error); setPreviewData(prev => ({ ...prev, isLoading: false })); 
    }
  };

  const handleScanFiles = async () => {
    if (!masterFile || crFiles.length === 0) return;

    const activeCats = CATEGORIES.filter(k => activeCategories[k]);
    if (activeCats.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'ตั้งค่าไม่สมบูรณ์',
        text: 'กรุณาเปิดใช้งานหมวดหมู่ (FILTER) อย่างน้อย 1 หมวดครับ!',
        background: 'var(--bg-panel)',
        customClass: {
          popup: isDarkMode ? 'theme-dark' : 'theme-light',
          confirmButton: 'btn-run swal-btn-confirm'
        },
        buttonsStyling: false
      });
      addLog('\n> [ERR] ABORT: กรุณาเปิดใช้งานหมวดหมู่ (FILTER) อย่างน้อย 1 หมวดครับ!');
      return;
    }

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

    let engWorker = null;
    let thaEngWorker = null;

    try {
      addLog('> [ระบบ] กำลังเตรียมการประมวลผล...');
      addLog(`> [ระบบ] หมวดหมู่ที่ค้นหา (FILTER): [${activeCats.join(', ')}]`);
      
      addLog(`> [ข้อมูล] พบไฟล์อัปเดต CR จำนวน (${crFiles.length}) ไฟล์:`);
      crFiles.forEach((file, index) => { addLog(`   |-- [${index + 1}] ${file.name}`); });

      const masterBytes = await masterFile.arrayBuffer();
      const masterPdfjs = await pdfjsLib.getDocument({ data: masterBytes }).promise;

      const crDataList = [];
      addLog(`> [ระบบ] กำลังโหลดและอ่านไฟล์ PDF เข้าสู่ระบบ...`);
      for (let i = 0; i < crFiles.length; i++) {
        const crBytes = await crFiles[i].arrayBuffer();
        const crPdfjs = await pdfjsLib.getDocument({ data: crBytes }).promise;
        crDataList.push({ file: crFiles[i], pdfjs: crPdfjs });
      }

      addLog(`> [ระบบ] กำลังเตรียมระบบอ่านข้อความ OCR (อาจใช้เวลาสักครู่)...`);
      engWorker = await Tesseract.createWorker('eng');
      if (engWorker.setParameters) await engWorker.setParameters({ tessedit_pageseg_mode: '6' });
      
      thaEngWorker = await Tesseract.createWorker('tha+eng');
      if (thaEngWorker.setParameters) await thaEngWorker.setParameters({ tessedit_pageseg_mode: '6' });
      addLog(`> [ระบบ] เครื่องมือ OCR พร้อมทำงาน.`);

      addLog(`\n> [OCR] กำลังสแกนหาเลขแบบในไฟล์เอกสาร CR...`);
      const tempSummary = [];
      setProgress(10);

      for (let i = 0; i < crDataList.length; i++) {
        const crItem = crDataList[i];
        addLog(`   |-- กำลังอ่านไฟล์ CR ${i + 1}/${crDataList.length} (จำนวน: ${crItem.pdfjs.numPages} หน้า)`);
        for (let c = 1; c <= crItem.pdfjs.numPages; c++) {
          try {
            let dwgNo = null;
            let usedAlt = false;
            let isCover = false;

            let result = await processOcrOnPage(crItem.pdfjs, c, cropConfig, activeCats, engWorker);
            dwgNo = result.finalMatch;

            if (!dwgNo) {
              result = await processOcrOnPage(crItem.pdfjs, c, altCropConfig, activeCats, engWorker);
              dwgNo = result.finalMatch;
              usedAlt = true;
            }

            if (!dwgNo) {
              result = await processOcrOnPage(crItem.pdfjs, c, crListCropConfig, activeCats, engWorker);
              dwgNo = result.finalMatch;
              usedAlt = true; // Also consider this an alternative
            }

            if (!dwgNo && aiEnabled && geminiApiKey) {
               addLog(`       [✨ AI] ให้ AI ช่วยสแกนหน้า ${c} ...`);
               try {
                  const fullPageImage = await getPageImageBase64(crItem.pdfjs, c);
                  const aiResult = await extractDrawingIdWithGemini(fullPageImage, geminiApiKey, activeCats);
                  if (aiResult) {
                     dwgNo = aiResult;
                     usedAlt = true;
                     addLog(`       [✨ AI] วิเคราะห์พบรหัส: ${dwgNo}`);
                  } else {
                     addLog(`       [✨ AI] ไม่พบรหัสแบบที่ต้องการ`);
                  }
               } catch (aiErr) {
                  addLog(`       [✨ AI ERR] ${aiErr.message}`);
               }
            }

            if (!dwgNo) {
              // Pass coverCropConfig to the processing function
              const coverRes = await processCoverOcr(crItem.pdfjs, c, coverCropConfig, thaEngWorker);
              if (coverRes.isCover) { dwgNo = 'COVER'; isCover = true; }
            }

            if (dwgNo) {
              const baseNo = dwgNo === 'COVER' ? 'COVER' : dwgNo.split('_')[0]; 
              const existingIdx = tempSummary.findIndex(item => item.baseNo === baseNo);
              
              if (existingIdx !== -1) {
                tempSummary[existingIdx] = { dwgNo, baseNo, crPageIndex: c - 1, crFileIndex: i, status: 'searching' };
              } else {
                tempSummary.push({ dwgNo, baseNo, crPageIndex: c - 1, crFileIndex: i, status: 'searching' });
                if (isCover) addLog(`       [+] พบหน้าปก: COVER_PAGE`);
                else addLog(`       [+] พบรหัส: ${dwgNo} ${usedAlt ? '(CH:2 สำรอง)' : ''}`);
              }
            } else {
              addLog(`       [-] ข้าม: หน้า ${c} (หารหัสไม่พบ หรือถูกยกเว้น)`);
            }
          } catch (pageErr) {
            addLog(`       [ข้อผิดพลาด] หน้า ${c} อ่านล้มเหลว: ${pageErr.message}`);
          }
          setProgress(10 + Math.round(((i / crDataList.length) + (c / crItem.pdfjs.numPages / crDataList.length)) * 25));
        }
      }
      setCrSummary([...tempSummary]);

      if (tempSummary.length === 0) {
        addLog('\n> [ข้อผิดพลาด] ยกเลิกการทำงาน: ไม่พบรหัสแบบที่ถูกต้อง (กรุณาเช็ค OCR/Filter)');
        setIsProcessing(false); setProgress(0); return;
      }

      addLog(`\n> [ดัชนี] กำลังตรวจสอบเลขแบบในไฟล์ MASTER PDF (จำนวน: ${masterPdfjs.numPages} หน้า)...`);
      const masterIndicesMap = {}; 
      const pagesToDelete = []; 
      
      for (let m = 1; m <= masterPdfjs.numPages; m++) {
        if (m % 10 === 0 || m === 1) addLog(`   |-- ตรวจสอบไฟล์ Master... ${Math.round((m/masterPdfjs.numPages)*100)}%`);
        
        try {
          let dwgNo = null;
          let isCover = false;

          let result = await processOcrOnPage(masterPdfjs, m, cropConfig, activeCats, engWorker);
          dwgNo = result.finalMatch;

          if (!dwgNo) {
            result = await processOcrOnPage(masterPdfjs, m, altCropConfig, activeCats, engWorker);
            dwgNo = result.finalMatch;
          }

          if (!dwgNo) {
            result = await processOcrOnPage(masterPdfjs, m, crListCropConfig, activeCats, engWorker);
            dwgNo = result.finalMatch;
          }

          if (!dwgNo && aiEnabled && geminiApiKey) {
             addLog(`       [✨ AI] ให้ AI ช่วยสแกนหน้า ${m} ...`);
             try {
                const fullPageImage = await getPageImageBase64(masterPdfjs, m);
                const aiResult = await extractDrawingIdWithGemini(fullPageImage, geminiApiKey, activeCats);
                if (aiResult) {
                   dwgNo = aiResult;
                   addLog(`       [✨ AI] วิเคราะห์พบรหัส: ${dwgNo}`);
                }
             } catch (aiErr) {
                addLog(`       [✨ AI ERR] ${aiErr.message}`);
             }
          }

          if (!dwgNo) {
            // Pass coverCropConfig to the processing function
            const coverRes = await processCoverOcr(masterPdfjs, m, coverCropConfig, thaEngWorker);
            if (coverRes.isCover) { dwgNo = 'COVER'; isCover = true; addLog(`       [พบล็อค] หน้าปก (COVER) อยู่ที่หน้า ${m}`); }
          }

          if (dwgNo) {
            const baseNo = dwgNo === 'COVER' ? 'COVER' : dwgNo.split('_')[0]; 
            masterIndicesMap[baseNo] = m - 1; 
            
            const foundIndex = tempSummary.findIndex(item => item.baseNo === baseNo);
            if (foundIndex !== -1) {
              tempSummary[foundIndex].status = 'success';
              setCrSummary([...tempSummary]); 
              addLog(`       [ตรงกัน] ${tempSummary[foundIndex].dwgNo} -> จะไปแทนที่หน้า ${m}`);
            }
          } else {
            pagesToDelete.push(m - 1);
            addLog(`       [รอทิ้ง] เตรียมลบหน้า ${m} (หารหัสไม่พบ หรือถูกยกเว้น)`);
          }
        } catch (pageErr) {
           pagesToDelete.push(m - 1);
           addLog(`       [ข้อผิดพลาด] ไฟล์ Master หน้า ${m} อ่านล้มเหลว: ${pageErr.message}`);
        }
        setProgress(35 + Math.round((m / masterPdfjs.numPages) * 15));
      }

      if (pagesToDelete.length > 0) {
        addLog(`\n> [ระบบ] หยุดพักชั่วคราว: รอผู้ใช้ยืนยันการลบหน้าไฟล์ (PRE-FLIGHT CHECK)...`);
        setReviewData({ tempSummary, masterIndicesMap, pagesToDelete, crDataList });
        setProgress(50);
      } else {
        await executeFinalPhase({ tempSummary, masterIndicesMap, pagesToDelete, crDataList }, {});
      }

    } catch (e) { 
      addLog(`\n> [ข้อผิดพลาดร้ายแรง] ${e.message}`); 
      setIsProcessing(false); setProgress(0);
    } finally {
      if (engWorker && engWorker.terminate) await engWorker.terminate();
      if (thaEngWorker && thaEngWorker.terminate) await thaEngWorker.terminate();
    }
  };

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
            addLog(`       [บังคับบันทึก] ${finalTempSummary[sumIdx].dwgNo} -> หน้า ${pIdx + 1}`);
          } else {
            addLog(`       [บังคับเก็บไว้] หน้า ${pIdx + 1} บันทึกเป็นรหัส ${dwgNo}`);
          }
        }
      });

      finalTempSummary.forEach(item => {
        if (item.status === 'searching') {
          if (finalMasterMap[item.baseNo] !== undefined) {
             item.status = 'success';
          } else {
             item.status = 'new_append';
             addLog(`       [สร้างรายการใหม่] ${item.baseNo} -> เข้าคิวเตรียมต่อท้ายไฟล์`);
          }
        }
      });
      setCrSummary([...finalTempSummary]); 
      setProgress(60);

      addLog('\n> [ทำงาน] กำลังดำเนินการแทนที่ไฟล์ใหม่ (REPLACE)...');
      // ดึงข้อมูลไฟล์แบบสดใหม่เพื่อป้องกันปัญหา ArrayBuffer ถูกตัดขาด (Detached) จาก pdfjsLib
      const freshMasterBytes = await masterFile.arrayBuffer();
      const masterDoc = await PDFDocument.load(freshMasterBytes);
      const loadedCrDocs = [];
      for (let i = 0; i < data.crDataList.length; i++) { 
        const freshCrBytes = await data.crDataList[i].file.arrayBuffer();
        loadedCrDocs.push(await PDFDocument.load(freshCrBytes)); 
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

      addLog(`> [ทำงาน] กำลังเคลียร์ไฟล์ที่ไม่ต้องการทิ้งจำนวน (${finalPagesToDelete.length} หน้า)...`);
      finalPagesToDelete.sort((a, b) => b - a);
      for (const idx of finalPagesToDelete) { masterDoc.removePage(idx); }
      setProgress(90);

      const newPages = finalTempSummary.filter(item => item.status === 'new_append');
      let appendedCount = 0;
      
      if (newPages.length > 0) {
        addLog(`> [ทำงาน] กำลังเพิ่มหน้าใหม่และจัดเรียงจำนวน (${newPages.length} หน้า)...`);
        
        const categoryOrder = ['COVER', 'AR', 'IN', 'EE', 'AC', 'ST', 'SN', 'ME', 'AD'];
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
          if (item.dwgNo === 'COVER') { masterDoc.insertPage(0, crPage); } 
          else { masterDoc.addPage(crPage); }
          appendedCount++;
          addLog(`       [+] เพิ่มแล้ว: ${item.dwgNo}`);
        }
      }
      
      setStats({ replaced: replacedCount, purged: finalPagesToDelete.length, appended: appendedCount });
      setProgress(100);

      if (replacedCount > 0 || finalPagesToDelete.length > 0 || appendedCount > 0) {
        addLog(`\n> [สำเร็จ] ดำเนินการอัปเดตไฟล์เสร็จสมบูรณ์!`);
        const finalBytes = await masterDoc.save();
        setDownloadUrl(URL.createObjectURL(new Blob([finalBytes], { type: 'application/pdf' })));

        Swal.fire({
          icon: 'success',
          title: 'ประมวลผลสำเร็จ!',
          text: `อัปเดตไฟล์เรียบร้อยแล้ว (แทนที่: ${replacedCount}, เพิ่ม: ${appendedCount}, ลบ: ${finalPagesToDelete.length} หน้า)`,
          background: 'var(--bg-panel)',
          customClass: { popup: isDarkMode ? 'theme-dark' : 'theme-light', confirmButton: 'btn-run swal-btn-confirm' },
          buttonsStyling: false
        });
      } else {
        addLog('\n> [สำเร็จ] เสร็จสิ้นการทำงาน (ไม่มีหน้าใดถูกเปลี่ยนแปลง)');
        Swal.fire({
          icon: 'info',
          title: 'เสร็จสิ้นการทำงาน',
          text: 'ไม่มีการเปลี่ยนแปลงใดๆ เกิดขึ้นกับไฟล์เป้าหมาย',
          background: 'var(--bg-panel)',
          customClass: { popup: isDarkMode ? 'theme-dark' : 'theme-light', confirmButton: 'btn-run swal-btn-confirm' },
          buttonsStyling: false
        });
      }
    } catch (e) { 
      addLog(`\n> [ข้อผิดพลาดร้ายแรง] ${e.message}`); 
      setProgress(0);
    } finally { setIsProcessing(false); }
  };

  const handleConfirmExecute = () => {
    setReviewData(null); 
    addLog('\n> [ระบบ] ยืนยันการตรวจสอบแล้ว. กำลังดำเนินการต่อ...');
    executeFinalPhase(reviewData, manualInputs);
  };

  const exportLogReport = () => {
    const reportContent = `===========================================
FloorPlan-Revised-CR-Auto - EXECUTION REPORT
===========================================
Generated: ${new Date().toLocaleString('en-US')}
System Auth: @The Toi

--- SUMMARY STATISTICS ---
[UPDATE] Replaced: ${stats.replaced}
[INSERT] Appended: ${stats.appended}
[DELETE] Purged: ${stats.purged}

--- DRAWING STATUS ---
${crSummary.map(item => {
  let stat = '';
  if(item.status === 'success') stat = '[UPDATED]';
  else if(item.status === 'new_append') stat = '[INSERTED]';
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

  return {
    logs, setLogs,
    isProcessing, setIsProcessing,
    downloadUrl, setDownloadUrl,
    crSummary, setCrSummary,
    stats, setStats,
    downloadFilename, setDownloadFilename,
    progress, setProgress,
    previewData, setPreviewData,
    testPageNum, setTestPageNum,
    reviewData, setReviewData,
    manualInputs, setManualInputs,
    addLog, resetProcessor,
    handleTestOcr, handleScanFiles, handleConfirmExecute, exportLogReport
  };
}