import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import Swal from 'sweetalert2';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import './App.css';
import PreFlightModal from './PreFlightModal';
import HelpModal from './HelpModal';
import OcrConfigModal from './OcrConfigModal';
import usePdfProcessor from './usePdfProcessor';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// 🌟 ลำดับหมวดหมู่
const CATEGORIES = ['AR', 'IN', 'EE', 'AC', 'ST', 'SN', 'ME', 'AD'];

function App() {
  const [masterFile, setMasterFile] = useState(null);
  const [crFiles, setCrFiles] = useState([]); 
  const [dragMaster, setDragMaster] = useState(false);
  const [dragCr, setDragCr] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // AI State
  const [aiEnabled, setAiEnabled] = useState(localStorage.getItem('aiEnabled') === 'true');
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('geminiApiKey') || '');

  const [showOcrConfig, setShowOcrConfig] = useState(false);
  const [cropConfig, setCropConfig] = useState({ width: 16, height: 15 }); 
  const [altCropConfig, setAltCropConfig] = useState({ width: 25, height: 25 }); 
  const [crListCropConfig, setCrListCropConfig] = useState({ width: 25, height: 10 });
  const [coverCropConfig, setCoverCropConfig] = useState({ width: 30, height: 10 });

  const [activeCategories, setActiveCategories] = useState({
    AR: true, IN: true, EE: true, AC: true, ST: true, SN: true, ME: true, AD: false
  });

  const [resetKey, setResetKey] = useState(Date.now());
  const [copied, setCopied] = useState(false);

  const processor = usePdfProcessor(masterFile, crFiles, activeCategories, cropConfig, altCropConfig, crListCropConfig, coverCropConfig, isDarkMode, CATEGORIES, aiEnabled, geminiApiKey);
  const {
    logs, isProcessing, downloadUrl, crSummary, stats, downloadFilename,
    progress, previewData, testPageNum, reviewData, manualInputs,
    setTestPageNum, setManualInputs, setReviewData, setIsProcessing, setProgress,
    addLog, handleTestOcr, handleScanFiles, handleConfirmExecute, exportLogReport, resetProcessor
  } = processor;

  const logEndRef = useRef(null);
  const scrollToBottom = () => logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [logs]);

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
    setResetKey(Date.now()); 
    resetProcessor();
  };

  const handleOpenOcrConfig = () => {
    Swal.fire({
      title: 'ต้องการรหัสผ่าน',
      text: 'กรุณาใส่รหัสผ่านเพื่อเข้าถึงส่วนการตั้งค่าขั้นสูง',
      input: 'password',
      inputPlaceholder: 'Password',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      showCancelButton: true,
      customClass: {
        popup: isDarkMode ? 'theme-dark' : 'theme-light',
        confirmButton: 'btn-run',
        cancelButton: 'btn-secondary',
        input: 'manual-input',
      },
      preConfirm: (password) => {
        if (password === '0000') {
          return true;
        }
        Swal.showValidationMessage('รหัสผ่านไม่ถูกต้อง!');
        return false;
      },
      allowOutsideClick: true,
    }).then((result) => {
      if (result.isConfirmed) {
        setShowOcrConfig(true);
      }
    });
  };

  const handleAiSettings = () => {
    Swal.fire({
      title: 'ตั้งค่า Gemini AI',
      text: 'กรุณาใส่ Gemini API Key ของคุณ (ข้อมูลนี้จะถูกบันทึกไว้ในเครื่องของคุณเท่านั้น)',
      input: 'password',
      inputValue: geminiApiKey,
      inputPlaceholder: 'AIzaSy...',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      customClass: {
        popup: isDarkMode ? 'theme-dark' : 'theme-light',
        confirmButton: 'btn-run',
        cancelButton: 'btn-secondary',
        input: 'manual-input',
      },
    }).then((result) => {
      if (result.isConfirmed) {
        setGeminiApiKey(result.value);
        localStorage.setItem('geminiApiKey', result.value);
        Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ',
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: isDarkMode ? 'theme-dark' : 'theme-light' }
        });
      }
    });
  };

  const toggleAiMode = () => {
    const newVal = !aiEnabled;
    setAiEnabled(newVal);
    localStorage.setItem('aiEnabled', newVal);
  };

  const handleExcludeItem = (itemToExclude, type) => {
    setReviewData(currentData => {
      if (!currentData) return null;

      const list = currentData[type] || [];
      const updatedList = list.filter(item => {
        if (type === 'purged') {
          return item.masterPageNum !== itemToExclude.masterPageNum;
        }
        return item.dwgNo !== itemToExclude.dwgNo;
      });

      return { ...currentData, [type]: updatedList };
    });
  };

  return (
    <div className={isDarkMode ? 'theme-dark' : 'theme-light'} style={{ display: 'flex', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', paddingTop: '30px', paddingBottom: '20px', transition: 'background-color 0.2s' }}>
      <PreFlightModal 
        reviewData={reviewData} masterFile={masterFile} crFiles={crFiles} manualInputs={manualInputs} 
        setManualInputs={setManualInputs} setReviewData={setReviewData} 
        handleConfirmExecute={handleConfirmExecute} onExcludeItem={handleExcludeItem}
      />

      <OcrConfigModal 
        showOcrConfig={showOcrConfig} setShowOcrConfig={setShowOcrConfig} 
        cropConfig={cropConfig} setCropConfig={setCropConfig} 
        altCropConfig={altCropConfig} setAltCropConfig={setAltCropConfig}
        crListCropConfig={crListCropConfig} setCrListCropConfig={setCrListCropConfig}
        coverCropConfig={coverCropConfig} setCoverCropConfig={setCoverCropConfig}
        testPageNum={testPageNum} setTestPageNum={setTestPageNum} 
        handleTestOcr={handleTestOcr} previewData={previewData} 
        masterFile={masterFile} crFiles={crFiles}
        aiEnabled={aiEnabled} toggleAiMode={toggleAiMode}
        geminiApiKey={geminiApiKey} setGeminiApiKey={(val) => { setGeminiApiKey(val); localStorage.setItem('geminiApiKey', val); }}
      />

      <HelpModal showHelp={showHelp} setShowHelp={setShowHelp} />

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '1024px', gap: '16px', height: '100%' }}>

        {/* 🌟 Header & Control Panel */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: '20px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '46px', height: '46px', background: 'var(--color-primary)', color: '#fff', fontWeight: '900', fontSize: '1.3rem', borderRadius: '12px', boxShadow: '0 4px 15px rgba(255, 23, 68, 0.4)', letterSpacing: '1px' }}>
              FR
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900', letterSpacing: '1px', color: 'var(--color-primary)' }}>FloorPlan-Revised-CR-Auto</h1>
                <span className="badge-primary">v4.1</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold', marginRight: '4px' }}>หมวดหมู่ (FILTER):</span>
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => !isProcessing && setActiveCategories(prev => ({...prev, [cat]: !prev[cat]}))}
                    className={`cat-toggle ${activeCategories[cat] ? 'active' : 'inactive'}`}
                    disabled={isProcessing}
                    title={activeCategories[cat] ? `ค้นหาหมวด ${cat}` : `ข้ามหมวด ${cat}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={`btn-tool ${aiEnabled ? 'active' : ''}`} onClick={toggleAiMode} style={{ borderColor: aiEnabled ? '#9c27b0' : '', color: aiEnabled ? '#9c27b0' : '' }}>
              {aiEnabled ? '✨ AI Mode: ON' : '✨ AI Mode: OFF'}
            </button>
            <button className="btn-tool btn-ocr" onClick={handleAiSettings} style={{ backgroundColor: '#9c27b0', color: '#fff', border: 'none' }}>AI Settings</button>
            <button className="btn-tool" onClick={() => setShowHelp(true)}>คู่มือ</button>
            <button className="btn-tool btn-ocr" onClick={handleOpenOcrConfig}>ตั้งค่า OCR</button>
            <button className={`btn-tool ${!isDarkMode ? 'active' : ''}`} onClick={() => setIsDarkMode(!isDarkMode)}>
              {isDarkMode ? 'สว่าง (LIGHT)' : 'มืด (DARK)'}
            </button>
            <button className="btn-tool btn-reset" onClick={handleReset}>เริ่มใหม่</button>
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
              <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '700', letterSpacing: '0.5px' }}>[1] ไฟล์ MASTER</span>
              {masterFile ? <span style={{ fontSize: '0.85rem', color: 'var(--color-up)', fontWeight: 'bold' }}>เชื่อมต่อแล้ว</span> : <span style={{ fontSize: '0.8rem', color: 'var(--border-color)' }}>รอไฟล์ (AWAITING)</span>}
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
                <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '700', letterSpacing: '0.5px' }}>[2] รายการ CR</span>
                {crFiles.length > 0 && (
                  <button 
                    onClick={(e) => { e.preventDefault(); handleCopyCrNames(); }}
                    style={{ 
                      background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: copied ? 'var(--color-up)' : 'var(--text-muted)', 
                      padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', fontFamily: 'JetBrains Mono', fontWeight: 'bold', transition: 'all 0.2s'
                    }}
                    title="Copy File Names"
                  >
                    {copied ? '✅ คัดลอกแล้ว' : '📋 คัดลอกชื่อ'}
                  </button>
                )}
              </div>
              {crFiles.length > 0 ? <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>พบ {crFiles.length} รายการ</span> : <span style={{ fontSize: '0.8rem', color: 'var(--border-color)' }}>รอไฟล์ (AWAITING)</span>}
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
              letterSpacing: '1.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            {isProcessing ? (
              <><div className="spinner"></div> PROCESSING {progress}%</>
            ) : (
              '⚡ เริ่มทำงาน'
            )}
          </button>
        </div>

        {/* 🌟 Dashboard (สไตล์ Order Book) */}
        {(crSummary.length > 0 || downloadUrl) && (
          <div style={{ display: 'flex', gap: '16px', flexShrink: 0, minHeight: '160px' }}>
            {crSummary.length > 0 && (
              <div className="glass-panel" style={{ flex: 3, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span>รายการทำงาน (ORDER BOOK: {crSummary.length})</span>
                  {isProcessing && <span style={{ color: 'var(--color-warning)' }}>กำลังซิงค์...</span>}
                </div>
                
                <div className="terminal-scroll" style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: '6px', flex: 1, overflowY: 'auto' }}>
                  {crSummary.map((item, idx) => {
                    let color = 'var(--text-muted)';
                    let prefix = '';
                    if (item.status === 'success') { color = 'var(--color-up)'; prefix = 'UPDT'; }
                    else if (item.status === 'new_append') { color = 'var(--color-primary)'; prefix = 'INSR'; }
                    else if (item.status === 'searching') { color = 'var(--color-warning)'; prefix = 'WAIT'; }

                    return (
                      <div key={idx} className={`badge-item ${item.status === 'searching' ? 'status-searching' : ''}`} style={{ borderColor: color, color: color }}>
                        <span className="badge-prefix" style={{ background: color, color: '#fff' }}>{prefix}</span>
                        <span>{item.dwgNo === 'COVER' ? 'COVER_PAGE' : item.dwgNo}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {downloadUrl && (
              <div className="glass-panel" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--color-up)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>สรุปผลการทำงาน (SUMMARY)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace" }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>แทนที่ใหม่ (REPLACED):</span><span style={{ color: 'var(--color-up)' }}>{stats.replaced}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>เพิ่มหน้า (APPENDED):</span><span style={{ color: 'var(--color-primary)' }}>{stats.appended}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>ลบทิ้ง (PURGED):</span><span style={{ color: 'var(--color-down)' }}>{stats.purged}</span></div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <a href={downloadUrl} download={downloadFilename} className="btn-run" style={{ flex: 2, textAlign: 'center', padding: '8px 0', textDecoration: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 'bold', background: 'var(--color-up)' }}>
                    ดาวน์โหลด PDF
                  </a>
                  <button onClick={exportLogReport} className="btn-secondary" style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    Export Log
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
            {!logs.length && <div style={{ color: 'var(--text-muted)' }}>{'>'} สถานะ: รอคำสั่ง (STANDBY)</div>}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;