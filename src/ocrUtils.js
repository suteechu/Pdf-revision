import Tesseract from 'tesseract.js';

export const getPageImageBase64 = async (pdf, pageNum) => {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1.5 }); // scale 1.5 is enough for AI to read
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport: viewport }).promise;
  const imageUrl = canvas.toDataURL('image/png');
  canvas.width = 0; canvas.height = 0;
  return imageUrl;
};

export const processOcrOnPage = async (pdf, pageNum, config, activeCats, worker = null) => {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 3.0 }); 
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport: viewport }).promise;

  const cropWidth = viewport.width * (config.width / 100); 
  const cropHeight = viewport.height * (config.height / 100); 
  // xOffset moves it left from the right edge, yOffset moves it up from the bottom edge.
  // Wait, if they want to push it DOWN from the TOP, we might need a different anchor.
  // Let's use xOffset (Right to Left) and yOffset (Bottom to Top)
  const cropX = viewport.width - cropWidth - (viewport.width * ((config.xOffset || 0) / 100));
  let cropY = viewport.height - cropHeight - (viewport.height * ((config.yOffset || 0) / 100));
  
  // Ensure it doesn't go out of bounds
  if (cropX < 0) cropX = 0;
  if (cropY < 0) cropY = 0;
  if (cropY > viewport.height - cropHeight) cropY = viewport.height - cropHeight;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedContext = croppedCanvas.getContext('2d');
  croppedContext.imageSmoothingEnabled = false; 
  croppedContext.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  
  const imageUrl = croppedCanvas.toDataURL('image/png');
  
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
      suffix = suffix.replace(/[OQDG]/g, '0').replace(/[IL|!]/g, '1').replace(/Z/g, '2').replace(/S/g, '5').replace(/B/g, '8').replace(/[~:\\]/g, '-'); 
      matchedStr = prefix + suffix; 
      const parts = matchedStr.split(/[-_.]/);
      if (parts.length >= 3) finalMatch = `${parts[0]}-${parts[1]}_${parts[2]}`;
      else if (parts.length === 2) finalMatch = `${parts[0]}-${parts[1]}`;
      else finalMatch = matchedStr;
    }
  }
  return { imageUrl, cleanText, finalMatch };
};

export const processCoverOcr = async (pdf, pageNum, config, worker = null) => {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 }); 
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport: viewport }).promise;

  const cropWidth = viewport.width * (config.width / 100);
  const cropHeight = viewport.height * (config.height / 100);
  // Cover is usually anchored top-left. Let's use xOffset/yOffset to push from top-left.
  let cropX = viewport.width * ((config.xOffset || 0) / 100);
  let cropY = viewport.height * ((config.yOffset || 0) / 100);
  
  if (cropX > viewport.width - cropWidth) cropX = viewport.width - cropWidth;
  if (cropY > viewport.height - cropHeight) cropY = viewport.height - cropHeight;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedContext = croppedCanvas.getContext('2d');
  croppedContext.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  
  const imageUrl = croppedCanvas.toDataURL('image/png');
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