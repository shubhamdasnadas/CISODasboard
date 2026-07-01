import { toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';

const PDF_W_MM = 297;
const PDF_H_MM = 210;

function applySmartPageBreaks(element) {
  const pageH = (PDF_H_MM / PDF_W_MM) * (element.scrollWidth || 1100);
  const blocks = Array.from(element.querySelectorAll('[data-pdf-block], [data-pdf-section]'));
  const containerTop = element.getBoundingClientRect().top;
  const spacers = [];

  const rects = blocks.map(b => b.getBoundingClientRect());

  let cumulativeOffset = 0;

  blocks.forEach((block, idx) => {
    const rect = rects[idx];
    const blockTop    = rect.top - containerTop + cumulativeOffset;
    const blockHeight = rect.height;

    if (block.hasAttribute('data-pdf-section')) {
      // Force section to start at the next page boundary
      const posOnPage = blockTop % pageH;
      if (posOnPage > 1) {
        const push   = pageH - posOnPage;
        const spacer = document.createElement('div');
        spacer.style.height = `${push}px`;
        block.parentNode.insertBefore(spacer, block);
        spacers.push(spacer);
        cumulativeOffset += push;
      }
      return;
    }

    // data-pdf-block: push down only if it straddles a page boundary
    if (blockHeight >= pageH) return;

    const startPage = Math.floor(blockTop / pageH);
    const endPage   = Math.floor((blockTop + blockHeight - 1) / pageH);

    if (startPage !== endPage) {
      const push   = (startPage + 1) * pageH - blockTop;
      const spacer = document.createElement('div');
      spacer.style.height = `${push}px`;
      block.parentNode.insertBefore(spacer, block);
      spacers.push(spacer);
      cumulativeOffset += push;
    }
  });

  return function cleanup() {
    spacers.forEach(s => s.remove());
  };
}

export async function generatePdfFromElement(element, filename) {
  const cleanup = applySmartPageBreaks(element);

  let dataUrl;
  try {
    const contentWidth  = element.scrollWidth  || element.offsetWidth  || 1100;
    const contentHeight = element.scrollHeight || element.offsetHeight;

    dataUrl = await toJpeg(element, {
      cacheBust: true,
      pixelRatio: 1.5,
      quality: 0.85,
      backgroundColor: '#ffffff',
      width:  contentWidth,
      height: contentHeight,
    });
  } finally {
    cleanup();
  }

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });

  const pdf   = new jsPDF('l', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const imgW = pageW;
  const imgH = (img.naturalHeight * imgW) / img.naturalWidth;

  let yOffset = 0;
  while (yOffset < imgH) {
    if (yOffset > 0) pdf.addPage();
    pdf.addImage(dataUrl, 'JPEG', 0, -yOffset, imgW, imgH);
    yOffset += pageH;
  }

  pdf.save(filename);
}
