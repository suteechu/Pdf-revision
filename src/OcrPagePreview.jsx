import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

const OcrPagePreview = ({ file, pageNumber, cropConfigs, activeChannel, onUpdateConfig }) => {
  const pdfCanvasRef = useRef(null);
  const uiCanvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [pdfRendered, setPdfRendered] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);

  // Render PDF only when file or pageNumber changes
  useEffect(() => {
    if (!file || !pageNumber || !pdfCanvasRef.current) return;
    let isMounted = true;
    setPdfRendered(false);

    const renderPdf = async () => {
      try {
        const canvas = pdfCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const fileReader = new FileReader();
        fileReader.onload = async function() {
          if (!isMounted) return;
          const typedarray = new Uint8Array(this.result);
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          const page = await pdf.getPage(pageNumber);
          
          const viewport = page.getViewport({ scale: 1 });
          const scale = 450 / viewport.width; 
          setCanvasScale(scale);
          const scaledViewport = page.getViewport({ scale });

          canvas.height = scaledViewport.height;
          canvas.width = scaledViewport.width;
          
          if (uiCanvasRef.current) {
            uiCanvasRef.current.width = scaledViewport.width;
            uiCanvasRef.current.height = scaledViewport.height;
          }

          await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
          setPdfRendered(true);
        };
        fileReader.readAsArrayBuffer(file);
      } catch (error) {
        console.error('Error rendering PDF:', error);
      }
    };
    renderPdf();
    return () => { isMounted = false; };
  }, [file, pageNumber]);

  // Render UI boxes whenever configs, dragging state, or active channel changes
  useEffect(() => {
    if (!pdfRendered || !uiCanvasRef.current) return;
    const canvas = uiCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawRect = (rect, color, label, isActive) => {
      ctx.globalAlpha = isActive ? 0.9 : 0.4;
      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 2.5 : 1.5;
      
      if (isActive) ctx.setLineDash([5, 3]);
      else ctx.setLineDash([]);
      
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      ctx.setLineDash([]);

      ctx.globalAlpha = isActive ? 1.0 : 0.6;
      ctx.fillStyle = color;
      ctx.fillRect(rect.x, rect.y > 14 ? rect.y - 14 : rect.y, ctx.measureText(label).width + 8, 14);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 10px Arial';
      ctx.fillText(label, rect.x + 4, rect.y > 14 ? rect.y - 3 : rect.y + 10);
    };

    const { main, alt, cover, crList } = cropConfigs;

    const getBottomRightRect = (cfg) => {
      const w = canvas.width * (cfg.width / 100);
      const h = canvas.height * (cfg.height / 100);
      const x = canvas.width - w - (canvas.width * ((cfg.xOffset || 0) / 100));
      const y = canvas.height - h - (canvas.height * ((cfg.yOffset || 0) / 100));
      return { x: Math.max(0, x), y: Math.max(0, y), width: w, height: h };
    };

    const getTopLeftRect = (cfg) => {
      const w = canvas.width * (cfg.width / 100);
      const h = canvas.height * (cfg.height / 100);
      const x = canvas.width * ((cfg.xOffset || 0) / 100);
      const y = canvas.height * ((cfg.yOffset || 0) / 100);
      return { x: Math.min(x, canvas.width - w), y: Math.min(y, canvas.height - h), width: w, height: h };
    };

    if (main) drawRect(getBottomRightRect(main), 'rgba(14, 203, 129, 0.9)', 'CH:1 MAIN', activeChannel === 'main');
    if (alt) drawRect(getBottomRightRect(alt), 'rgba(246, 70, 93, 0.9)', 'CH:2 ALT', activeChannel === 'alt');
    if (cover) drawRect(getTopLeftRect(cover), 'rgba(252, 213, 53, 0.9)', 'CH:3 COVER', activeChannel === 'cover');
    if (crList) drawRect(getBottomRightRect(crList), 'rgba(142, 68, 173, 0.9)', 'CH:4 CR_LIST', activeChannel === 'crList');

    // Draw active dragging box
    if (isDragging && activeChannel) {
      let dragColor = '#0096FF'; // default blue
      if (activeChannel === 'main') dragColor = 'rgba(14, 203, 129, 1)';
      else if (activeChannel === 'alt') dragColor = 'rgba(246, 70, 93, 1)';
      else if (activeChannel === 'cover') dragColor = 'rgba(252, 213, 53, 1)';
      else if (activeChannel === 'crList') dragColor = 'rgba(142, 68, 173, 1)';

      const x = Math.min(startPos.x, currentPos.x);
      const y = Math.min(startPos.y, currentPos.y);
      const w = Math.abs(currentPos.x - startPos.x);
      const h = Math.abs(currentPos.y - startPos.y);
      
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = dragColor;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = dragColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, w, h);
    }
  }, [cropConfigs, pdfRendered, activeChannel, isDragging, currentPos, startPos]);

  const handleMouseDown = (e) => {
    if (!activeChannel || !onUpdateConfig) return;
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setCurrentPos({ x, y });
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    setCurrentPos({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDragging || !activeChannel || !onUpdateConfig) return;
    setIsDragging(false);

    const canvas = uiCanvasRef.current;
    const cw = canvas.width;
    const ch = canvas.height;

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const w = Math.abs(currentPos.x - startPos.x);
    const h = Math.abs(currentPos.y - startPos.y);

    // Prevent extremely small boxes
    if (w < 10 || h < 10) return;

    let widthPct = Math.round((w / cw) * 100);
    let heightPct = Math.round((h / ch) * 100);
    let xOffPct = 0;
    let yOffPct = 0;

    if (activeChannel === 'cover') {
      // Top-Left anchor
      xOffPct = Math.round((x / cw) * 100);
      yOffPct = Math.round((y / ch) * 100);
    } else {
      // Bottom-Right anchor (CH1, CH2, CH4)
      xOffPct = Math.round(((cw - x - w) / cw) * 100);
      yOffPct = Math.round(((ch - y - h) / ch) * 100);
    }

    onUpdateConfig(activeChannel, {
      width: Math.max(1, Math.min(100, widthPct)),
      height: Math.max(1, Math.min(100, heightPct)),
      xOffset: Math.max(0, Math.min(99, xOffPct)),
      yOffset: Math.max(0, Math.min(99, yOffPct))
    });
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', border: '1px solid var(--border-color)', background: '#fff' }}>
      <canvas ref={pdfCanvasRef} style={{ display: 'block' }} />
      <canvas 
        ref={uiCanvasRef} 
        style={{ position: 'absolute', top: 0, left: 0, cursor: activeChannel ? 'crosshair' : 'default' }} 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};

export default OcrPagePreview;