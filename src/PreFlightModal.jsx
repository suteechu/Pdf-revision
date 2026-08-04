import React from 'react';
import PdfPageThumbnail from './PdfPageThumbnail';

const PreFlightModal = ({
  reviewData,
  masterFile,
  crFiles,
  manualInputs,
  setManualInputs,
  setReviewData,
  handleConfirmExecute,
  onExcludeItem,
}) => {
  if (!reviewData) {
    return null;
  }

  const { replaced = [], appended = [], purged = [], unresolved = [] } = reviewData;

  const crFileMap = new Map((crFiles || []).map(f => [f.name, f]));

  const handleClose = () => setReviewData(null);

  const handleConfirm = () => {
    handleConfirmExecute();
  };

  const handleManualInputChange = (dwgNo, value) => {
    setManualInputs(prev => ({ ...prev, [dwgNo]: value }));
  };

  const renderItem = (item, type) => {
    let color = 'var(--text-muted)';
    let label = '';
    let details = `CR: ${item.crName} (p.${item.crPageNum})`;

    if (type === 'replaced') {
      color = 'var(--color-up)';
      label = 'REPLACE';
      details += ` ➔ Master p.${item.masterPageNum}`;
    } else if (type === 'appended') {
      color = 'var(--color-primary)';
      label = 'APPEND';
    } else if (type === 'purged') {
      color = 'var(--color-down)';
      label = 'PURGE';
      details = `Master p.${item.masterPageNum}`;
    }

    return (
      <div key={`${type}-${item.dwgNo || item.masterPageNum}`} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px',
        background: 'var(--bg-app)',
        borderLeft: `4px solid ${color}`,
        borderRadius: '2px',
        marginBottom: '8px'
      }} className="preflight-item">
        <button 
          onClick={() => onExcludeItem(item, type)}
          title={`Exclude this ${type} action`}
          className="exclude-btn"
        >&times;</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ color, fontWeight: 'bold', fontFamily: 'JetBrains Mono', fontSize: '0.8rem' }}>[{label}]</span>
            <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{item.dwgNo}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
            {details}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {type === 'purged' && masterFile && (
            <div style={{ textAlign: 'center' }}>
              <PdfPageThumbnail file={masterFile} pageNumber={item.masterPageNum} width={100} />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Original Page</div>
            </div>
          )}
          {/* This includes changes from suggestion 1 */}
          {type === 'replaced' && masterFile && crFileMap.has(item.crName) && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <PdfPageThumbnail file={masterFile} pageNumber={item.masterPageNum} width={100} />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Original</div>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '1.5rem' }}>→</span>
              <div style={{ textAlign: 'center' }}>
                <PdfPageThumbnail file={crFileMap.get(item.crName)} pageNumber={item.crPageNum} width={100} />
                <div style={{ fontSize: '0.7rem', color: 'var(--color-up)', marginTop: '4px' }}>New</div>
              </div>
            </div>
          )}
          {type === 'appended' && crFileMap.has(item.crName) && (
            <div style={{ textAlign: 'center' }}>
              <PdfPageThumbnail file={crFileMap.get(item.crName)} pageNumber={item.crPageNum} width={100} />
              <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', marginTop: '4px' }}>New Page</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '900px', width: '95%' }}>
        <button onClick={handleClose} className="modal-close">&times;</button>
        <h2 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Pre-flight Check</h2>

        <div style={{ display: 'flex', gap: '20px', maxHeight: '70vh' }}>
          
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
              Please review the changes below. The process will be executed based on this plan.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-around', background: 'var(--bg-app)', padding: '10px', borderRadius: '4px', fontFamily: 'JetBrains Mono', fontWeight: 'bold' }}>
              <span style={{ color: 'var(--color-up)' }}>REPLACED: {replaced.length}</span>
              <span style={{ color: 'var(--color-primary)' }}>APPENDED: {appended.length}</span>
              <span style={{ color: 'var(--color-down)' }}>PURGED: {purged.length}</span>
              {unresolved.length > 0 && <span style={{ color: 'var(--color-warning)' }}>UNRESOLVED: {unresolved.length}</span>}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }} className="terminal-scroll">
              {purged.length > 0 && (
                <>
                  <h3 style={{ color: 'var(--color-down)', marginTop: 0 }}>Pages to be Purged</h3>
                  {purged.map(item => renderItem(item, 'purged'))}
                </>
              )}
              {replaced.length > 0 && (
                <>
                  <h3 style={{ color: 'var(--color-up)' }}>Pages to be Replaced</h3>
                  {replaced.map(item => renderItem(item, 'replaced'))}
                </>
              )}
              {appended.length > 0 && (
                <>
                  <h3 style={{ color: 'var(--color-primary)' }}>Pages to be Appended</h3>
                  {appended.map(item => renderItem(item, 'appended'))}
                </>
              )}
            </div>
          </div>

          <div style={{ flex: 1, borderLeft: '1px solid var(--border-color)', paddingLeft: '20px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginTop: 0 }}>Actions</h3>
            {unresolved.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: 'var(--color-warning)' }}>Unresolved CR files</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Enter page number to replace, or leave blank to append.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }} className="terminal-scroll">
                  {unresolved.map(item => (
                    <div key={item.dwgNo}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>{item.dwgNo}</label>
                      <input type="number" className="manual-input" placeholder="Master page # to replace" value={manualInputs[item.dwgNo] || ''} onChange={(e) => handleManualInputChange(item.dwgNo, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={handleClose} style={{ padding: '10px 20px' }}>Cancel</button>
              <button className="btn-run" onClick={handleConfirm} style={{ padding: '10px 30px', fontSize: '1rem' }}>Confirm & Execute</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreFlightModal;