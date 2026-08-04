import React from 'react';
import OcrPagePreview from './OcrPagePreview';

export default function OcrConfigModal({
  showOcrConfig,
  setShowOcrConfig,
  cropConfig,
  setCropConfig,
  altCropConfig,
  setAltCropConfig,
  crListCropConfig,
  setCrListCropConfig,
  coverCropConfig,
  setCoverCropConfig,
  testPageNum,
  setTestPageNum,
  handleTestOcr,
  previewData,
  masterFile,
  crFiles,
  aiEnabled,
  toggleAiMode,
  geminiApiKey,
  setGeminiApiKey
}) {
  const [activeChannel, setActiveChannel] = React.useState('');

  if (!showOcrConfig) return null;

  const handleUpdateConfig = (channel, newConfig) => {
    if (channel === 'main') setCropConfig(newConfig);
    else if (channel === 'alt') setAltCropConfig(newConfig);
    else if (channel === 'cover') setCoverCropConfig(newConfig);
    else if (channel === 'crList') setCrListCropConfig(newConfig);
  };

  const ChannelConfigCard = ({ title, titleColor, config, setConfig, previewImage, previewMatch, previewRaw, hasSettings = true, note, maxRange = 50 }) => (
    <div style={{ border: '1px solid var(--border-color)', padding: '16px', background: 'var(--bg-app)', display: 'flex', flexDirection: 'column', gap: '12px', borderRadius: '4px' }}>
      <strong style={{ color: titleColor, display: 'block', fontSize: '0.9rem' }}>{title}</strong>
      
      {hasSettings && config && setConfig && (
        <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '12px 0' }}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>กว้าง (WIDTH): {config.width}%</label>
            <input type="range" min="5" max={maxRange} value={config.width} onChange={(e) => setConfig({...config, width: parseInt(e.target.value)})} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>สูง (HEIGHT): {config.height}%</label>
            <input type="range" min="5" max={maxRange} value={config.height} onChange={(e) => setConfig({...config, height: parseInt(e.target.value)})} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>เลื่อนซ้าย (X-OFFSET): {config.xOffset || 0}%</label>
            <input type="range" min="0" max="95" value={config.xOffset || 0} onChange={(e) => setConfig({...config, xOffset: parseInt(e.target.value)})} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>เลื่อนขึ้น (Y-OFFSET): {config.yOffset || 0}%</label>
            <input type="range" min="0" max="95" value={config.yOffset || 0} onChange={(e) => setConfig({...config, yOffset: parseInt(e.target.value)})} />
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' }}>
        {previewImage ? 
          <div style={{ textAlign: 'center', background: '#000' }}><img src={previewImage} alt={title} style={{ maxWidth: '100%', maxHeight: '70px' }} /></div> : 
          <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border-color)', fontSize: '0.8rem', background: 'var(--bg-panel)', borderRadius: '2px' }}>N/A</div>
        }
        <div style={{ fontSize: '0.85rem', color: previewMatch && previewMatch.includes('❌') ? 'var(--color-down)' : titleColor, fontWeight: 'bold' }}>{previewMatch || 'N/A'}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>ข้อความดิบ: {note ? (previewRaw ? previewRaw.substring(0,30)+'...' : '-') : (previewRaw || '-')}</div>
      </div>
    </div>
  );
  
  return (
    <div className="modal-overlay" onClick={() => setShowOcrConfig(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px', width: '95%' }}>
        <button className="modal-close" onClick={() => setShowOcrConfig(false)}>&times;</button>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '1.3rem', color: 'var(--color-up)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚙️</span> ตั้งค่าพารามิเตอร์การสแกน (OCR_CONFIG)
        </h2>
        
        <div style={{ display: 'flex', gap: '20px', maxHeight: '75vh' }}>
          {/* Left Column: Main Preview */}
          <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '16px', border: '1px solid var(--border-color)', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>ตำแหน่งการสแกนบนหน้ากระดาษ</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>หน้า (PAGE):</span>
                  <input type="number" min="1" value={testPageNum} onChange={(e) => setTestPageNum(parseInt(e.target.value, 10) || 1)} style={{ width: '60px', padding: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-main)', textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: '0.85rem' }} />
                  <button className="btn-run" onClick={handleTestOcr} disabled={previewData.isLoading || (!masterFile && crFiles.length === 0)} style={{ padding: '6px 14px', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {previewData.isLoading ? 'กำลังสแกน...' : 'ทดสอบสแกน'}
                  </button>
                </div>
              </div>
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-panel)', padding: '10px', border: '1px solid var(--border-color)', minHeight: '300px' }}>
                <div style={{ marginBottom: '10px', display: 'flex', gap: '8px', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>เครื่องมือวาด (DRAW):</span>
                  <button className={`btn-tool ${activeChannel === 'main' ? 'active' : ''}`} onClick={() => setActiveChannel(activeChannel === 'main' ? '' : 'main')} style={{ borderColor: activeChannel==='main'?'rgba(14, 203, 129, 0.9)':'', color: activeChannel==='main'?'rgba(14, 203, 129, 0.9)':'' }}>CH:1</button>
                  <button className={`btn-tool ${activeChannel === 'alt' ? 'active' : ''}`} onClick={() => setActiveChannel(activeChannel === 'alt' ? '' : 'alt')} style={{ borderColor: activeChannel==='alt'?'rgba(246, 70, 93, 0.9)':'', color: activeChannel==='alt'?'rgba(246, 70, 93, 0.9)':'' }}>CH:2</button>
                  <button className={`btn-tool ${activeChannel === 'cover' ? 'active' : ''}`} onClick={() => setActiveChannel(activeChannel === 'cover' ? '' : 'cover')} style={{ borderColor: activeChannel==='cover'?'rgba(252, 213, 53, 0.9)':'', color: activeChannel==='cover'?'rgba(252, 213, 53, 0.9)':'' }}>CH:3</button>
                  <button className={`btn-tool ${activeChannel === 'crList' ? 'active' : ''}`} onClick={() => setActiveChannel(activeChannel === 'crList' ? '' : 'crList')} style={{ borderColor: activeChannel==='crList'?'rgba(142, 68, 173, 0.9)':'', color: activeChannel==='crList'?'rgba(142, 68, 173, 0.9)':'' }}>CH:4</button>
                </div>
                {previewData.isLoading ? <span style={{color: 'var(--text-muted)'}}>กำลังโหลด...</span> : 
                 (masterFile || (crFiles && crFiles.length > 0)) ? (
                  <OcrPagePreview 
                    file={masterFile || crFiles[0]}
                    pageNumber={testPageNum}
                    cropConfigs={{ main: cropConfig, alt: altCropConfig, cover: coverCropConfig, crList: crListCropConfig }}
                    activeChannel={activeChannel}
                    onUpdateConfig={handleUpdateConfig}
                  />
                ) : <span style={{color: 'var(--text-muted)'}}>กรุณาเลือกไฟล์เพื่อดูตัวอย่าง</span>}
              </div>
            </div>
          </div>

          {/* Right Column: Settings & Individual Previews */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }} className="terminal-scroll">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              
              {/* AI Settings Section */}
              <div style={{ border: '1px solid var(--border-color)', padding: '16px', background: 'var(--bg-app)', display: 'flex', flexDirection: 'column', gap: '12px', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: '#9c27b0', display: 'block', fontSize: '0.9rem' }}>✨ ตั้งค่า AI (Gemini)</strong>
                  <button className={`btn-tool ${aiEnabled ? 'active' : ''}`} onClick={toggleAiMode} style={{ borderColor: aiEnabled ? '#9c27b0' : 'var(--border-color)', color: aiEnabled ? '#9c27b0' : 'var(--text-muted)', padding: '4px 8px', fontSize: '0.75rem' }}>
                    {aiEnabled ? 'เปิดใช้งาน (ON)' : 'ปิดใช้งาน (OFF)'}
                  </button>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Gemini API Key (เฉพาะแฟลชโมเดล):</label>
                  <input 
                    type="password" 
                    value={geminiApiKey} 
                    onChange={(e) => setGeminiApiKey(e.target.value)} 
                    placeholder="AIzaSy..." 
                    style={{ 
                      width: '100%', 
                      padding: '8px', 
                      background: 'var(--bg-panel)', 
                      border: '1px solid var(--border-color)', 
                      color: 'var(--text-main)', 
                      borderRadius: '4px',
                      fontFamily: 'monospace'
                    }} 
                  />
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    * ข้อมูล API Key จะถูกบันทึกไว้ในเบราว์เซอร์ของคุณเท่านั้น
                  </div>
                </div>
              </div>

              <ChannelConfigCard 
                title="CH:1 เช็ค (DWG NO)"
                titleColor="var(--color-up)"
                config={cropConfig}
                setConfig={setCropConfig}
                previewImage={previewData.image1}
                previewMatch={previewData.match1}
                previewRaw={previewData.rawText1}
              />
              <ChannelConfigCard 
                title="CH:2 เช็ค (DWG NO) สำรอง"
                titleColor="var(--color-primary)"
                config={altCropConfig}
                setConfig={setAltCropConfig}
                previewImage={previewData.image2}
                previewMatch={previewData.match2}
                previewRaw={previewData.rawText2}
                maxRange={80}
              />
              <ChannelConfigCard 
                title="CH:3 อ่านหน้าปก (COVER)"
                titleColor="var(--color-warning)"
                hasSettings={true}
                config={coverCropConfig}
                setConfig={setCoverCropConfig}
                previewImage={previewData.image3}
                previewMatch={previewData.match3}
                previewRaw={previewData.rawText3}
                note={true}
              />
              <ChannelConfigCard 
                title="CH:4 อ่านรายการ CR"
                titleColor="#8E44AD"
                config={crListCropConfig}
                setConfig={setCrListCropConfig}
                previewImage={previewData.image4}
                previewMatch={previewData.match4}
                previewRaw={previewData.rawText4}
              />
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <button className="btn-secondary" onClick={() => setShowOcrConfig(false)} style={{ padding: '10px 24px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>ปิดหน้าต่าง</button>
        </div>
      </div>
    </div>
  );
}