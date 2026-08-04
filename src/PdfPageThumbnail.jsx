import React, { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

const PdfPageThumbnail = ({ file, pageNumber, width = 150 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!file || !pageNumber || !canvasRef.current) {
      return;
    }

    let isMounted = true;

    const renderPage = async () => {
      try {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        const fileReader = new FileReader();
        fileReader.onload = async function() {
          if (!isMounted) return;
          const typedarray = new Uint8Array(this.result);
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          const page = await pdf.getPage(pageNumber);
          
          const viewport = page.getViewport({ scale: 1 });
          const scale = width / viewport.width;
          const scaledViewport = page.getViewport({ scale });

          canvas.height = scaledViewport.height;
          canvas.width = scaledViewport.width;

          const renderContext = {
            canvasContext: context,
            viewport: scaledViewport,
          };
          await page.render(renderContext).promise;
        };
        fileReader.readAsArrayBuffer(file);

      } catch (error) {
        console.error(`Error rendering PDF page thumbnail for page ${pageNumber}:`, error);
      }
    };

    renderPage();

    return () => { isMounted = false; };
  }, [file, pageNumber, width]);

  return <canvas ref={canvasRef} style={{ border: '1px solid var(--border-color)', borderRadius: '2px', background: 'var(--bg-panel)' }} />;
};

export default PdfPageThumbnail;