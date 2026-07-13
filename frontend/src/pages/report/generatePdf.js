import { toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';

const PDF_W_MM = 297;
const PDF_H_MM = 210;

// Inserts spacers before data-pdf-block elements that would straddle a page boundary.
// Returns a cleanup fn that removes the inserted spacers.
function applyBlockPageBreaks(element) {
  const pageH = (PDF_H_MM / PDF_W_MM) * (element.scrollWidth || 1400);
  const blocks = Array.from(element.querySelectorAll('[data-pdf-block]'));
  const containerTop = element.getBoundingClientRect().top;
  const spacers = [];
  let cumulativeOffset = 0;

  blocks.forEach((block) => {
    const rect = block.getBoundingClientRect();
    const blockTop    = rect.top - containerTop + cumulativeOffset;
    const blockHeight = rect.height;
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

  return () => spacers.forEach(s => s.remove());
}

async function captureElement(el, bgColor = '#ffffff') {
  const cleanup = applyBlockPageBreaks(el);
  try {
    return await toJpeg(el, {
      cacheBust: true,
      pixelRatio: 2,
      quality: 0.92,
      backgroundColor: bgColor,
      width:  el.scrollWidth,
      height: el.scrollHeight,
      skipFonts: true,
    });
  } finally {
    cleanup();
  }
}

async function loadImage(dataUrl) {
  const img = new Image();
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = dataUrl; });
  return img;
}

export async function generatePdfFromElement(element, filename) {
  const pdf   = new jsPDF('l', 'mm', 'a4', { compress: true });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // ReportDocument renders one root div; iterate its direct children per-section.
  const rootDiv  = element.firstElementChild;
  const footerEl = rootDiv.querySelector('[data-pdf-footer]');

  // Sections: direct children, excluding the footer and tiny spacer divs (<50px).
  const sections = Array.from(rootDiv.children).filter(
    child => child !== footerEl && child.scrollHeight >= 50
  );

  let firstPage = true;

  for (const section of sections) {
    // Use the section's own computed background so dark cover pages render correctly.
    const computedBg = window.getComputedStyle(section).backgroundColor;
    const isTransparent = !computedBg || computedBg === 'rgba(0, 0, 0, 0)' || computedBg === 'transparent';
    const bgColor = isTransparent ? '#ffffff' : computedBg;

    const dataUrl = await captureElement(section, bgColor);
    const img     = await loadImage(dataUrl);

    const imgW = pageW;
    const imgH = (img.naturalHeight * imgW) / img.naturalWidth;

    let yOffset = 0;
    while (yOffset < imgH) {
      if (!firstPage) pdf.addPage();
      firstPage = false;
      pdf.addImage(dataUrl, 'JPEG', 0, -yOffset, imgW, imgH);
      yOffset += pageH;
    }
  }

  // Footer: overlay at the bottom of the last page (no new page).
  if (footerEl) {
    try {
      const footerDataUrl = await toJpeg(footerEl, {
        cacheBust: true,
        pixelRatio: 2,
        quality: 0.92,
        backgroundColor: '#1e1b4b',
        width:  footerEl.scrollWidth,
        height: footerEl.scrollHeight,
        skipFonts: true,
      });
      const footerImg = await loadImage(footerDataUrl);
      const footerH   = (footerImg.naturalHeight * pageW) / footerImg.naturalWidth;
      pdf.addImage(footerDataUrl, 'JPEG', 0, pageH - footerH, pageW, footerH);
    } catch (_) { /* footer is decorative; skip silently on error */ }
  }

  pdf.save(filename);
}
