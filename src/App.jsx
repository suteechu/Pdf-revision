import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import Tesseract from 'tesseract.js';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// 🌟 ลำดับหมวดหมู่
const CATEGORIES = ['AR', 'IN', 'EE', 'AC', 'ST', 'SN', 'ME', 'AD'];

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
  const [cropConfig, setCropConfig] = useState({ width: 15, height: 15 }); 
  const [altCropConfig, setAltCropConfig] = useState({ width: 25, height: 25 }); 

  const [activeCategories, setActiveCategories] = useState({
    AR: true, IN: true, EE: true, AC: true, ST: true, SN: true, ME: true, AD: false
  });

  const [previewData, setPreviewData] = useState({ 
    image1: null, rawText1: '', match1: '', 
    image2: null, rawText2: '', match2: '', 
    image3: null, rawText3: '', match3: '',
    isLoading: false 
  });
  
  const [testPageNum, setTestPageNum] = useState(1);
  const [reviewData, setReviewData] = useState(null); 
  const [manualInputs, setManualInputs] = useState({}); 
  
  const [resetKey, setResetKey] = useState(Date.now());
  const [copied, setCopied] = useState(false);

  const logEndRef = useRef(null);
  const scrollToBottom = () => logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [logs]);

  const addLog = (msg) => setLogs((prev) => [...prev, msg]);

  const handleCopyCrNames = () => {
    if (crFiles.length === 0) return;
    const fileNames = crFiles.map(f => f.name).join('\n');
    navigator.clipboard.writeText(fileNames).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); 
    });
  };

  const handleReset = () => {
    setMasterFile(null);
    setCrFiles([]);
    setLogs([]);
    setCrSummary([]);
    setDownloadUrl(null);
    setProgress(0);
    setStats({ replaced: 0, purged: 0, appended: 0 });
    setReviewData(null);
    setManualInputs({});
    setResetKey(Date.now()); 
    setLogs(['> [SYS] SYSTEM RESET: พร้อมรับข้อมูลชุดใหม่...']);
  };

  const processOcrOnPage = async (pdf, pageNum, config, activeCats, worker = null) => {
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
    
    // เคลียร์ Canvas ทันทีเพื่อป้องกัน Memory Leak
    canvas.width = 0; canvas.height = 0;
    croppedCanvas.width = 0; croppedCanvas.height = 0;

    let text = "";
    if (worker) {
      const result = await worker.recognize(imageUrl);
      text = result.data.text;
    } else {
      const result = await Tesseract.recognize(imageUrl, 'eng', { tessedit_pageseg_mode: '6' });
      text = result.data.text;
    }

    let cleanText = text.toUpperCase().replace(/\s+/g, ''); 
    
    cleanText = cleanText.replace(/[1L|!I]N/g, 'IN');
    cleanText = cleanText.replace(/IM/g, 'IN');
    cleanText = cleanText.replace(/5N/g, 'SN');
    cleanText = cleanText.replace(/5T/g, 'ST');
    cleanText = cleanText.replace(/4R/g, 'AR');
    cleanText = cleanText.replace(/4C/g, 'AC');
    
    let finalMatch = null;

    if (activeCats && activeCats.length > 0) {
      const catRegexStr = activeCats.join('|');
      const dynamicRegex = new RegExp(`(${catRegexStr})[0-9OQDGILZSB!]{0,2}[-_.~:\\\\][0-9OQDGILZSB!]{1,3}(?:[-_.~:\\\\][0-9OQDGILZSB!]{1,2})?`); 
      
      const rawMatch = cleanText.match(dynamicRegex); 
      
      if (rawMatch) {
        let matchedStr = rawMatch[0];
        
        let prefix = matchedStr.substring(0, 2); 
        let suffix = matchedStr.substring(2);    
        
        suffix = suffix.replace(/[OQDG]/g, '0');
        suffix = suffix.replace(/[IL|!]/g, '1');
        suffix = suffix.replace(/Z/g, '2');
        suffix = suffix.replace(/S/g, '5');
        suffix = suffix.replace(/B/g, '8');
        suffix = suffix.replace(/[~:\\]/g, '-'); 
        
        matchedStr = prefix + suffix; 

        const parts = matchedStr.split(/[-_.]/);
        if (parts.length >= 3) finalMatch = `${parts[0]}-${parts[1]}_${parts[2]}`;
        else if (parts.length === 2) finalMatch = `${parts[0]}-${parts[1]}`;
        else finalMatch = matchedStr;
      }
    }

    return { imageUrl, cleanText, finalMatch };
  };

  const processCoverOcr = async (pdf, pageNum, worker = null) => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); 
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport: viewport }).promise;

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

    // เคลียร์ Canvas ทันทีเพื่อป้องกัน Memory Leak
    canvas.width = 0; canvas.height = 0;
    croppedCanvas.width = 0; croppedCanvas.height = 0;

    let text = "";
    if (worker) {
      const result = await worker.recognize(imageUrl);
      text = result.data.text;
    } else {
      const result = await Tesseract.recognize(imageUrl, 'tha+eng', { tessedit_pageseg_mode: '6' });
      text = result.data.text;
    }

    const cleanText = text.replace(/\s+/g, ''); 
    const isCover = /แบบและราย|การก่อสร้าง|โครงการ|เจ้าของ|SMART|CUSTOMIZE/i.test(cleanText);

    return { imageUrl, rawText: text, isCover };
  };

  const handleTestOcr = async () => {
    const fileToTest = masterFile || (crFiles.length > 0 ? crFiles[0] : null);
    if (!fileToTest) { alert('กรุณาอัปโหลดไฟล์ก่อนทดสอบครับ'); return; }

    const activeCats = CATEGORIES.filter(k => activeCategories[k]);

    setPreviewData(prev => ({ ...prev, isLoading: true }));
    try {
      const fileBytes = await fileToTest.arrayBuffer();
      const pdfjsDoc = await pdfjsLib.getDocument({ data: fileBytes }).promise;
      
      let targetPage = parseInt(testPageNum) || 1;
      if (targetPage < 1) targetPage = 1;
      if (targetPage > pdfjsDoc.numPages) targetPage = pdfjsDoc.numPages;
      setTestPageNum(targetPage); 

      const res1 = await processOcrOnPage(pdfjsDoc, targetPage, cropConfig, activeCats); 
      const res2 = await processOcrOnPage(pdfjsDoc, targetPage, altCropConfig, activeCats); 
      const res3 = await processCoverOcr(pdfjsDoc, targetPage); 
      
      setPreviewData({ 
        image1: res1.imageUrl, rawText1: res1.cleanText, match1: res1.finalMatch || 'N/A', 
        image2: res2.imageUrl, rawText2: res2.cleanText, match2: res2.finalMatch || 'N/A', 
        image3: res3.imageUrl, rawText3: res3.rawText.substring(0, 50) + '...', match3: res3.isCover ? 'COVER_DETECTED' : 'N/A',
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
      addLog('> [SYS] INIT BATCH ALGO...');
      addLog(`> [SYS] ACTIVE FILTERS: [${activeCats.join(', ')}]`);
      
      addLog(`> [DATA] INCOMING CR FILES (${crFiles.length}):`);
      crFiles.forEach((file, index) => { addLog(`   |-- [${index + 1}] ${file.name}`); });

      const masterBytes = await masterFile.arrayBuffer();
      const masterPdfjs = await pdfjsLib.getDocument({ data: masterBytes.slice(0) }).promise;

      const crDataList = [];
      addLog(`> [SYS] LOADING ASSETS...`);
      for (let i = 0; i < crFiles.length; i++) {
        const crBytes = await crFiles[i].arrayBuffer();
        const crPdfjs = await pdfjsLib.getDocument({ data: crBytes.slice(0) }).promise;
        crDataList.push({ file: crFiles[i], bytes: crBytes, pdfjs: crPdfjs });
      }

      addLog(`> [SYS] INITIALIZING OCR WORKERS (THIS MAY TAKE A MOMENT)...`);
      engWorker = await Tesseract.createWorker('eng');
      if (engWorker.setParameters) await engWorker.setParameters({ tessedit_pageseg_mode: '6' });
      
      thaEngWorker = await Tesseract.createWorker('tha+eng');
      if (thaEngWorker.setParameters) await thaEngWorker.setParameters({ tessedit_pageseg_mode: '6' });
      addLog(`> [SYS] OCR WORKERS READY.`);

      addLog(`\n> [OCR] SCANNING CR DOCUMENTS...`);
      const tempSummary = [];
      setProgress(10);

      for (let i = 0; i < crDataList.length; i++) {
        const crItem = crDataList[i];
        addLog(`   |-- PROCESS CR ${i + 1}/${crDataList.length} (PAGES: ${crItem.pdfjs.numPages})`);
        for (let c = 1; c <= crItem.pdfjs.numPages; c++) {
          try {
            let dwgNo = null;
            let usedAlt = false;
            let isCover = false;

            // ส่ง engWorker ไปเพื่อ Reuse 
            let result = await processOcrOnPage(crItem.pdfjs, c, cropConfig, activeCats, engWorker);
            dwgNo = result.finalMatch;

            if (!dwgNo) {
              result = await processOcrOnPage(crItem.pdfjs, c, altCropConfig, activeCats, engWorker);
              dwgNo = result.finalMatch;
              usedAlt = true;
            }

            if (!dwgNo) {
              // ส่ง thaEngWorker ไป
              const coverRes = await processCoverOcr(crItem.pdfjs, c, thaEngWorker);
              if (coverRes.isCover) { dwgNo = 'COVER'; isCover = true; }
            }

            if (dwgNo) {
              const baseNo = dwgNo === 'COVER' ? 'COVER' : dwgNo.split('_')[0]; 
              const existingIdx = tempSummary.findIndex(item => item.baseNo === baseNo);
              
              if (existingIdx !== -1) {
                tempSummary[existingIdx] = { dwgNo, baseNo, crPageIndex: c - 1, crFileIndex: i, status: 'searching' };
              } else {
                tempSummary.push({ dwgNo, baseNo, crPageIndex: c - 1, crFileIndex: i, status: 'searching' });
                if (isCover) addLog(`       [+] DETECTED: COVER_PAGE`);
                else addLog(`       [+] DETECTED: ${dwgNo} ${usedAlt ? '(CH:2)' : ''}`);
              }
            } else {
              addLog(`       [-] SKIP: P.${c} (NO_MATCH / EXCLUDED)`);
            }
          } catch (pageErr) {
            addLog(`       [ERR] P.${c} FAILED: ${pageErr.message}`);
          }
          setProgress(10 + Math.round(((i / crDataList.length) + (c / crItem.pdfjs.numPages / crDataList.length)) * 25));
        }
      }
      setCrSummary([...tempSummary]);

      if (tempSummary.length === 0) {
        addLog('\n> [ERR] ABORT: NO VALID DRAWING ID FOUND.');
        setIsProcessing(false); setProgress(0); return;
      }

      addLog(`\n> [IDX] MAPPING MASTER PDF (PAGES: ${masterPdfjs.numPages})...`);
      const masterIndicesMap = {}; 
      const pagesToDelete = []; 
      
      for (let m = 1; m <= masterPdfjs.numPages; m++) {
        if (m % 10 === 0 || m === 1) addLog(`   |-- SCANNING... ${Math.round((m/masterPdfjs.numPages)*100)}%`);
        
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
            const coverRes = await processCoverOcr(masterPdfjs, m, thaEngWorker);
            if (coverRes.isCover) { dwgNo = 'COVER'; isCover = true; addLog(`       [LOCKED] COVER AT P.${m}`); }
          }

          if (dwgNo) {
            const baseNo = dwgNo === 'COVER' ? 'COVER' : dwgNo.split('_')[0]; 
            masterIndicesMap[baseNo] = m - 1; 
            
            const foundIndex = tempSummary.findIndex(item => item.baseNo === baseNo);
            if (foundIndex !== -1) {
              tempSummary[foundIndex].status = 'success';
              setCrSummary([...tempSummary]); 
              addLog(`       [MATCH] ${tempSummary[foundIndex].dwgNo} -> TARGET P.${m}`);
            }
          } else {
            pagesToDelete.push(m - 1);
            addLog(`       [DROP] QUEUED P.${m} (NO_MATCH / EXCLUDED)`);
          }
        } catch (pageErr) {
           pagesToDelete.push(m - 1);
           addLog(`       [ERR] P.${m} FAILED TO READ: ${pageErr.message}`);
        }
        setProgress(35 + Math.round((m / masterPdfjs.numPages) * 15));
      }

      if (pagesToDelete.length > 0) {
        addLog(`\n> [SYS] PAUSED FOR PRE-FLIGHT CHECK...`);
        setReviewData({ tempSummary, masterIndicesMap, pagesToDelete, masterBytes, crDataList });
        setProgress(50);
      } else {
        await executeFinalPhase({ tempSummary, masterIndicesMap, pagesToDelete, masterBytes, crDataList }, {});
      }

    } catch (e) { 
      addLog(`\n> [FATAL] ${e.message}`); 
      setIsProcessing(false); setProgress(0);
    } finally {
      // ทำลาย Worker ทิ้งเพื่อคืน Memory 
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
            addLog(`       [FORCE_MATCH] ${finalTempSummary[sumIdx].dwgNo} -> P.${pIdx + 1}`);
          } else {
            addLog(`       [FORCE_SAVE] P.${pIdx + 1} AS ${dwgNo}`);
          }
        }
      });

      finalTempSummary.forEach(item => {
        if (item.status === 'searching') {
          if (finalMasterMap[item.baseNo] !== undefined) {
             item.status = 'success';
          } else {
             item.status = 'new_append';
             addLog(`       [NEW_ENTRY] ${item.baseNo} -> QUEUED APPEND`);
          }
        }
      });
      setCrSummary([...finalTempSummary]); 
      setProgress(60);

      addLog('\n> [EXEC] EXECUTING REPLACEMENTS...');
      const masterDoc = await PDFDocument.load(data.masterBytes);
      const loadedCrDocs = [];
      for (let i = 0; i < data.crDataList.length; i++) { loadedCrDocs.push(await PDFDocument.load(data.crDataList[i].bytes)); }

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

      addLog(`> [EXEC] EXECUTING PURGE (${finalPagesToDelete.length} ITEMS)...`);
      finalPagesToDelete.sort((a, b) => b - a);
      for (const idx of finalPagesToDelete) { masterDoc.removePage(idx); }
      setProgress(90);

      const newPages = finalTempSummary.filter(item => item.status === 'new_append');
      let appendedCount = 0;
      
      if (newPages.length > 0) {
        addLog(`> [EXEC] EXECUTING APPEND & SORT (${newPages.length} ITEMS)...`);
        
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
          addLog(`       [+] APPENDED: ${item.dwgNo}`);
        }
      }
      
      setStats({ replaced: replacedCount, purged: finalPagesToDelete.length, appended: appendedCount });
      setProgress(100);

      if (replacedCount > 0 || finalPagesToDelete.length > 0 || appendedCount > 0) {
        addLog(`\n> [SYS] OPERATION COMPLETED SUCCESSFULLY.`);
        const finalBytes = await masterDoc.save();
        setDownloadUrl(URL.createObjectURL(new Blob([finalBytes], { type: 'application/pdf' })));
      } else {
        addLog('\n> [SYS] ZERO MODIFICATIONS APPLIED.');
      }

    } catch (e) { 
      addLog(`\n> [FATAL] ${e.message}`); 
      setProgress(0);
    }
    finally { setIsProcessing(false); }
  };

  const handleConfirmExecute = () => {
    setReviewData(null); 
    addLog('\n> [SYS] PRE-FLIGHT CONFIRMED. RESUMING...');
    executeFinalPhase(reviewData, manualInputs);
  };

  const exportLogReport = () => {
    const reportContent = `===========================================
PDF BATCH REPLACER - EXECUTION REPORT
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

  return (
    <div className={isDarkMode ? 'theme-dark' : 'theme-light'} style={{ display: 'flex', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', paddingTop: '30px', paddingBottom: '20px', transition: 'background-color 0.2s' }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700;800&display=swap');
          
          :root {}
          .theme-dark { 
            --bg-app: #0b0e11; 
            --bg-panel: #181a20; 
            --text-main: #eaecef; 
            --text-muted: #848e9c; 
            --border-color: #2b3139; 
            --upload-bg: #0b0e11; 
            --color-up: #0ecb81; 
            --color-down: #f6465d; 
            --color-primary: #2962ff; 
            --color-warning: #fcd535; 
          }
          .theme-light { 
            --bg-app: #f1f5f9; 
            --bg-panel: #ffffff; 
            --text-main: #0f172a; 
            --text-muted: #334155; 
            --border-color: #cbd5e1; 
            --upload-bg: #f8fafc;
            --color-up: #047857; 
            --color-down: #b91c1c; 
            --color-primary: #1d4ed8; 
            --color-warning: #b45309; 
          }
          
          * { box-sizing: border-box; }
          body, html { margin: 0; padding: 0; height: 100%; font-family: 'JetBrains Mono', 'Prompt', sans-serif; overflow: hidden; }
          
          .glass-panel { background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 4px; position: relative; }
          
          .upload-box { transition: all 0.2s; border: 1px dashed var(--border-color); background: var(--upload-bg); position: relative; border-radius: 4px; }
          .upload-box:hover { border-color: var(--color-primary); background: var(--bg-panel); }
          .upload-box.drag-active { border-color: var(--color-up) !important; background: rgba(4, 120, 87, 0.05) !important; }
          
          .btn-run { background: var(--color-primary); transition: all 0.2s; border-radius: 4px; text-transform: uppercase; font-family: 'JetBrains Mono', monospace; }
          .btn-run:hover:not(:disabled) { background: #1e4bd8; }
          .btn-run:active:not(:disabled) { transform: scale(0.98); }
          .btn-run:disabled { background: var(--border-color); color: var(--text-muted); cursor: not-allowed; }
          
          .btn-secondary { background: transparent; transition: all 0.2s; border: 1px solid var(--border-color); color: var(--text-main); border-radius: 4px; }
          .btn-secondary:hover { background: var(--border-color); }
          
          .btn-tool { background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 6px 12px; border-radius: 4px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; font-family: 'JetBrains Mono', 'Prompt', sans-serif; }
          .btn-tool:hover { border-color: var(--text-muted); color: var(--text-main); }
          .btn-tool.active { border-color: var(--color-primary); color: var(--color-primary); }
          
          .btn-reset { color: var(--color-down) !important; border-color: rgba(185, 28, 28, 0.3) !important; }
          .btn-reset:hover { background: rgba(185, 28, 28, 0.1) !important; border-color: var(--color-down) !important; }

          .btn-ocr { color: var(--color-up) !important; border-color: rgba(4, 120, 87, 0.3) !important; }
          .btn-ocr:hover { background: rgba(4, 120, 87, 0.1) !important; border-color: var(--color-up) !important; }

          .cat-toggle {
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            font-size: 0.7rem;
            padding: 2px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            transition: all 0.2s;
          }
          .cat-toggle.active {
            background: rgba(14, 203, 129, 0.15); 
            color: var(--color-up);
            border-color: var(--color-up);
          }
          .theme-light .cat-toggle.active { background: rgba(4, 120, 87, 0.1); }
          
          .cat-toggle.inactive {
            background: rgba(246, 70, 93, 0.1); 
            color: var(--color-down);
            border-color: var(--color-down);
            opacity: 0.6;
            text-decoration: line-through;
          }
          .theme-light .cat-toggle.inactive { background: rgba(185, 28, 28, 0.05); }
          
          .cat-toggle:hover:not(:disabled) {
            transform: translateY(-1px);
            opacity: 1;
          }
          .cat-toggle:disabled { cursor: not-allowed; opacity: 0.4; }

          .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(11, 14, 17, 0.85); backdrop-filter: blur(2px); display: flex; justify-content: center; alignItems: center; z-index: 999; }
          .modal-content { background: var(--bg-panel); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 4px; padding: 24px; width: 90%; max-width: 700px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); position: relative; max-height: 90vh; overflow-y: auto; }
          .modal-close { position: absolute; top: 12px; right: 16px; background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; }
          .modal-close:hover { color: var(--text-main); }
          
          .terminal-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
          .terminal-scroll::-webkit-scrollbar-track { background: var(--bg-app); }
          .terminal-scroll::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
          .terminal-scroll::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
          
          @keyframes pulse-yellow { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
          .status-searching { animation: pulse-yellow 1.5s infinite; border-left: 3px solid var(--color-warning) !important; }
          
          input[type=file]::file-selector-button { border: none; background: var(--border-color); padding: 6px 14px; border-radius: 2px; color: var(--text-main); cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; margin-right: 12px; }
          input[type=file]::file-selector-button:hover { background: var(--text-muted); color: #fff; }

          input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
          input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 14px; width: 14px; border-radius: 0; background: var(--color-primary); cursor: pointer; margin-top: -5px; }
          input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; cursor: pointer; background: var(--border-color); }

          .manual-input { flex: 1; padding: 8px 12px; border-radius: 2px; border: 1px solid var(--border-color); background: var(--bg-app); color: var(--text-main); font-family: 'JetBrains Mono', monospace; font-size: 0.95rem; }
          .manual-input:focus { outline: none; border-color: var(--color-primary); }
          
          .badge-primary { background: var(--color-primary); color: #fff; font-size: 0.75rem; padding: 4px 8px; border-radius: 2px; font-weight: 700; }
        `}
      </style>

      {/* 🌟 Modal: ตรวจสอบและยืนยันก่อนลบ (Pre-Flight Check) เพิ่มชื่อไฟล์ MASTER */}
      {reviewData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.3rem', color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'JetBrains Mono', 'Prompt', sans-serif" }}>
              <span>⚠️</span> SYSTEM.PRE_FLIGHT_CHECK
            </h2>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '20px', fontFamily: "'Prompt', sans-serif" }}>
              ตรวจพบหน้าที่ <b>หาเลขแบบไม่เจอ (หรือถูกปิด FILTER ไว้)</b><br/>
              จากไฟล์ MASTER: <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{masterFile?.name}</span><br/>
              จำนวน <span style={{ color: 'var(--color-down)', fontWeight: 'bold' }}>{reviewData.pagesToDelete.length}</span> รายการ ซึ่งจะถูก <b>Drop (ลบทิ้ง)</b><br/>
              หากต้องการบังคับบันทึก (Force Save) ให้กรอก ID ในช่องว่าง
            </div>
            <div className="terminal-scroll" style={{ maxHeight: '350px', overflowY: 'auto', backgroundColor: 'var(--bg-app)', padding: '16px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
              {reviewData.pagesToDelete.length === 0 ? (
                <div style={{ color: 'var(--color-up)', textAlign: 'center', padding: '20px', fontWeight: 'bold', fontSize: '1rem' }}>ALL CLEAR. NO ORPHANED PAGES.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {reviewData.pagesToDelete.map(pIdx => (
                    <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-panel)', padding: '10px 16px', border: '1px solid var(--border-color)' }}>
                      {/* 🌟 แสดงว่าเป็นหน้าจากไฟล์ MASTER */}
                      <span style={{ color: 'var(--color-down)', fontWeight: 'bold', width: '130px', fontSize: '0.9rem' }}>P.{pIdx + 1} (MASTER)</span>
                      <span style={{ color: 'var(--text-muted)' }}>{'>'}</span>
                      <input type="text" className="manual-input" placeholder="EMPTY = DROP / INPUT ID = SAVE" value={manualInputs[pIdx] || ''} onChange={(e) => setManualInputs({...manualInputs, [pIdx]: e.target.value.toUpperCase()})} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn-secondary" onClick={() => { setReviewData(null); setIsProcessing(false); setProgress(0); addLog('> [SYS] ABORTED.'); }} style={{ padding: '8px 24px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold' }}>CANCEL</button>
              <button className="btn-run" onClick={handleConfirmExecute} style={{ padding: '8px 24px', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>CONFIRM EXECUTE</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ตั้งค่าและทดสอบ OCR */}
      {showOcrConfig && (
        <div className="modal-overlay" onClick={() => setShowOcrConfig(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '950px' }}>
            <button className="modal-close" onClick={() => setShowOcrConfig(false)}>✖</button>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.3rem', color: 'var(--color-up)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚙️</span> OCR_CONFIG.PARAMETERS
            </h2>
            
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '220px', background: 'var(--bg-app)', padding: '16px', border: '1px solid var(--border-color)' }}>
                <strong style={{ color: 'var(--color-up)', display: 'block', marginBottom: '12px', fontSize: '0.9rem' }}>CH:1 (MAIN)</strong>
                <div style={{ marginBottom: '12px' }}><label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>WIDTH: {cropConfig.width}%</label><input type="range" min="5" max="50" value={cropConfig.width} onChange={(e) => setCropConfig({...cropConfig, width: parseInt(e.target.value)})} /></div>
                <div><label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>HEIGHT: {cropConfig.height}%</label><input type="range" min="5" max="50" value={cropConfig.height} onChange={(e) => setCropConfig({...cropConfig, height: parseInt(e.target.value)})} /></div>
              </div>
              <div style={{ flex: 1, minWidth: '220px', background: 'var(--bg-app)', padding: '16px', border: '1px solid var(--border-color)' }}>
                <strong style={{ color: 'var(--color-primary)', display: 'block', marginBottom: '12px', fontSize: '0.9rem' }}>CH:2 (FALLBACK)</strong>
                <div style={{ marginBottom: '12px' }}><label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>WIDTH: {altCropConfig.width}%</label><input type="range" min="5" max="80" value={altCropConfig.width} onChange={(e) => setAltCropConfig({...altCropConfig, width: parseInt(e.target.value)})} /></div>
                <div><label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>HEIGHT: {altCropConfig.height}%</label><input type="range" min="5" max="80" value={altCropConfig.height} onChange={(e) => setAltCropConfig({...altCropConfig, height: parseInt(e.target.value)})} /></div>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-app)', padding: '16px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>LIVE VISION</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>PAGE:</span>
                  <input type="number" min="1" value={testPageNum} onChange={(e) => setTestPageNum(e.target.value)} style={{ width: '60px', padding: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-main)', textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: '0.85rem' }} />
                  <button className="btn-run" onClick={handleTestOcr} disabled={previewData.isLoading || (!masterFile && crFiles.length === 0)} style={{ padding: '6px 14px', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    {previewData.isLoading ? 'SCANNING...' : 'TEST SCAN'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ border: '1px solid var(--border-color)', padding: '12px', background: 'var(--bg-panel)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-up)', marginBottom: '10px', fontWeight: 'bold' }}>CH:1 MAIN</div>
                  {previewData.image1 ? <div style={{ textAlign: 'center', marginBottom: '10px', background: '#000' }}><img src={previewData.image1} alt="Crop 1" style={{ maxWidth: '100%', maxHeight: '70px' }} /></div> : <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border-color)', fontSize: '0.8rem' }}>N/A</div>}
                  <div style={{ fontSize: '0.85rem', color: previewData.match1.includes('❌') ? 'var(--color-down)' : 'var(--color-up)', fontWeight: 'bold' }}>{previewData.match1}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', wordBreak: 'break-all' }}>RAW: {previewData.rawText1 || '-'}</div>
                </div>

                <div style={{ border: '1px solid var(--border-color)', padding: '12px', background: 'var(--bg-panel)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', marginBottom: '10px', fontWeight: 'bold' }}>CH:2 FALLBACK</div>
                  {previewData.image2 ? <div style={{ textAlign: 'center', marginBottom: '10px', background: '#000' }}><img src={previewData.image2} alt="Crop 2" style={{ maxWidth: '100%', maxHeight: '70px' }} /></div> : <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border-color)', fontSize: '0.8rem' }}>N/A</div>}
                  <div style={{ fontSize: '0.85rem', color: previewData.match2.includes('❌') ? 'var(--color-down)' : 'var(--color-up)', fontWeight: 'bold' }}>{previewData.match2}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', wordBreak: 'break-all' }}>RAW: {previewData.rawText2 || '-'}</div>
                </div>

                <div style={{ border: '1px solid var(--border-color)', padding: '12px', background: 'var(--bg-panel)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-warning)', marginBottom: '10px', fontWeight: 'bold' }}>CH:3 COVER (TH)</div>
                  {previewData.image3 ? <div style={{ textAlign: 'center', marginBottom: '10px', background: '#000' }}><img src={previewData.image3} alt="Cover Crop" style={{ maxWidth: '100%', maxHeight: '70px' }} /></div> : <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border-color)', fontSize: '0.8rem' }}>N/A</div>}
                  <div style={{ fontSize: '0.85rem', color: previewData.match3.includes('❌') ? 'var(--color-down)' : 'var(--color-up)', fontWeight: 'bold' }}>{previewData.match3}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', wordBreak: 'break-all' }}>RAW: {previewData.rawText3 ? previewData.rawText3.substring(0,30)+'...' : '-'}</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <button className="btn-secondary" onClick={() => setShowOcrConfig(false)} style={{ padding: '8px 24px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>CLOSE</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal คู่มือการใช้งาน */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowHelp(false)}>✖</button>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: "'Prompt', sans-serif" }}>
              <span>📖</span> MANUAL
            </h2>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6', fontFamily: "'Prompt', sans-serif" }}>
              <p>Upload <b>MASTER PDF</b> (Left) and <b>CR FILES</b> (Right) then click <b>EXECUTE</b>.<br/>
              <span style={{ color: 'var(--color-down)' }}>(Note: Excluded categories will be purged automatically)</span></p>
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '20px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                <strong style={{ display: 'block', marginBottom: '12px', fontSize: '1rem' }}>ORDER BOOK STATUS:</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.9rem', fontFamily: "'JetBrains Mono', monospace" }}>
                  <div style={{ color: 'var(--color-up)' }}>[UPDT] REPLACED</div>
                  <div style={{ color: 'var(--color-primary)' }}>[INSR] APPENDED</div>
                  <div style={{ color: 'var(--color-down)' }}>[DROP] PURGED</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <button className="btn-secondary" onClick={() => setShowHelp(false)} style={{ padding: '8px 24px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>ACKNOWLEDGE</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '1024px', gap: '16px', height: '100%' }}>

        {/* 🌟 Header & Control Panel */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: '20px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'var(--color-primary)', color: '#fff', fontWeight: 'bold', fontSize: '1.2rem' }}>
              PBR
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', letterSpacing: '1px' }}>PDF BATCH REPLACER</h1>
                <span className="badge-primary">v4.1</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold', marginRight: '4px' }}>FILTER:</span>
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => !isProcessing && setActiveCategories(prev => ({...prev, [cat]: !prev[cat]}))}
                    className={`cat-toggle ${activeCategories[cat] ? 'active' : 'inactive'}`}
                    disabled={isProcessing}
                    title={activeCategories[cat] ? `Include ${cat}` : `Exclude ${cat}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-tool" onClick={() => setShowHelp(true)}>MANUAL</button>
            <button className="btn-tool btn-ocr" onClick={() => setShowOcrConfig(true)}>OCR_CFG</button>
            <button className={`btn-tool ${!isDarkMode ? 'active' : ''}`} onClick={() => setIsDarkMode(!isDarkMode)}>
              {isDarkMode ? 'LIGHT' : 'DARK'}
            </button>
            <button className="btn-tool btn-reset" onClick={handleReset}>RESET</button>
          </div>
        </div>

        {/* 🌟 Upload & Action Area */}
        <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
          <div 
            className={`upload-box ${dragMaster ? 'drag-active' : ''}`} 
            style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            onDragOver={(e) => { e.preventDefault(); setDragMaster(true); }}
            onDragLeave={() => setDragMaster(false)}
            onDrop={(e) => { e.preventDefault(); setDragMaster(false); if(e.dataTransfer.files.length) setMasterFile(e.dataTransfer.files[0]); }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '700', letterSpacing: '0.5px' }}>[1] MASTER_PDF</span>
              {masterFile ? <span style={{ fontSize: '0.85rem', color: 'var(--color-up)', fontWeight: 'bold' }}>CONNECTED</span> : <span style={{ fontSize: '0.8rem', color: 'var(--border-color)' }}>AWAITING</span>}
            </div>
            <input key={resetKey || 'master'} type="file" accept="application/pdf" onChange={(e) => setMasterFile(e.target.files[0])} disabled={isProcessing} style={{ width: '100%' }} />
          </div>

          <div 
            className={`upload-box ${dragCr ? 'drag-active' : ''}`} 
            style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            onDragOver={(e) => { e.preventDefault(); setDragCr(true); }}
            onDragLeave={() => setDragCr(false)}
            onDrop={(e) => { e.preventDefault(); setDragCr(false); if(e.dataTransfer.files.length) setCrFiles(Array.from(e.dataTransfer.files)); }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '700', letterSpacing: '0.5px' }}>[2] CR_MULTIPLES</span>
                {crFiles.length > 0 && (
                  <button 
                    onClick={(e) => { e.preventDefault(); handleCopyCrNames(); }}
                    style={{ 
                      background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: copied ? 'var(--color-up)' : 'var(--text-muted)', 
                      padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', fontFamily: 'JetBrains Mono', fontWeight: 'bold', transition: 'all 0.2s'
                    }}
                    title="Copy File Names"
                  >
                    {copied ? '✅ COPIED' : '📋 COPY'}
                  </button>
                )}
              </div>
              {crFiles.length > 0 ? <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>{crFiles.length} DETECTED</span> : <span style={{ fontSize: '0.8rem', color: 'var(--border-color)' }}>AWAITING</span>}
            </div>
            <input key={(resetKey + 1) || 'cr'} type="file" multiple accept="application/pdf" onChange={(e) => setCrFiles(Array.from(e.target.files))} disabled={isProcessing} style={{ width: '100%' }} />
          </div>

          <button 
            className="btn-run"
            onClick={handleScanFiles} 
            disabled={!masterFile || crFiles.length === 0 || isProcessing || reviewData} 
            style={{ 
              padding: '0 36px', 
              border: 'none', 
              color: '#fff', 
              fontSize: '1.1rem', 
              fontWeight: 'bold',
              minWidth: '200px',
              letterSpacing: '1.5px'
            }}
          >
            {isProcessing ? `${progress}%...` : 'EXECUTE'}
          </button>
        </div>

        {/* 🌟 Dashboard (สไตล์ Order Book) */}
        {(crSummary.length > 0 || downloadUrl) && (
          <div style={{ display: 'flex', gap: '16px', flexShrink: 0, minHeight: '160px' }}>
            {crSummary.length > 0 && (
              <div className="glass-panel" style={{ flex: 3, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span>ORDER_BOOK (ITEMS: {crSummary.length})</span>
                  {isProcessing && <span style={{ color: 'var(--color-warning)' }}>SYNCING...</span>}
                </div>
                
                <div className="terminal-scroll" style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: '6px', flex: 1, overflowY: 'auto' }}>
                  {crSummary.map((item, idx) => {
                    let color = 'var(--text-muted)';
                    let prefix = '';
                    if (item.status === 'success') { color = 'var(--color-up)'; prefix = 'UPDT'; }
                    else if (item.status === 'new_append') { color = 'var(--color-primary)'; prefix = 'INSR'; }
                    else if (item.status === 'searching') { color = 'var(--color-warning)'; prefix = 'WAIT'; }

                    return (
                      <div key={idx} className={item.status === 'searching' ? 'status-searching' : ''} style={{ 
                        padding: '4px 8px', fontSize: '0.85rem', fontWeight: 'bold', color: color, borderLeft: `3px solid ${color}`, background: 'var(--upload-bg)', display: 'flex', gap: '8px', minWidth: '130px'
                      }}>
                        <span style={{ opacity: 0.6 }}>[{prefix}]</span> {item.dwgNo === 'COVER' ? 'COVER_PAGE' : item.dwgNo}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {downloadUrl && (
              <div className="glass-panel" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--color-up)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>EXECUTION_SUMMARY</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace" }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>REPLACED:</span><span style={{ color: 'var(--color-up)' }}>{stats.replaced}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>APPENDED:</span><span style={{ color: 'var(--color-primary)' }}>{stats.appended}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>PURGED:</span><span style={{ color: 'var(--color-down)' }}>{stats.purged}</span></div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <a href={downloadUrl} download={downloadFilename} className="btn-run" style={{ flex: 2, textAlign: 'center', padding: '8px 0', textDecoration: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 'bold', background: 'var(--color-up)' }}>
                    EXPORT_PDF
                  </a>
                  <button onClick={exportLogReport} className="btn-secondary" style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    LOG
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 🌟 Terminal / Log Area */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '3px', background: 'var(--border-color)' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.2s' }}></div>
          </div>
          
          <div className="terminal-scroll" style={{ flex: 1, padding: '16px', overflowY: 'auto', fontSize: '0.9rem', lineHeight: '1.6', background: 'var(--upload-bg)' }}>
            {logs.map((log, i) => {
              let logColor = 'var(--text-muted)'; 
              if (log.includes('[+]') || log.includes('MATCH')) logColor = 'var(--color-up)'; 
              if (log.includes('[-]') || log.includes('ERR') || log.includes('DROP') || log.includes('ABORT')) logColor = 'var(--color-down)'; 
              if (log.includes('NEW_ENTRY') || log.includes('EXEC')) logColor = 'var(--color-primary)'; 
              if (log.includes('SYS') || log.includes('IDX') || log.includes('DATA')) logColor = 'var(--text-main)'; 
              if (log.includes('LOCKED') || log.includes('PAUSE') || log.includes('FORCE')) logColor = 'var(--color-warning)'; 
              
              return <div key={i} style={{ color: logColor }}>{log}</div>;
            })}
            <div ref={logEndRef} />
            {!logs.length && <div style={{ color: 'var(--text-muted)' }}>{'>'} STATUS: STANDBY</div>}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;