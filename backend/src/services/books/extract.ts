/**
 * Book text extraction.
 *
 * Supports:
 *  - PDF (text layer via pdf-parse, page-aware)
 *  - DOCX (via mammoth)
 *  - Plain text / Markdown
 *  - Images and scanned PDFs via OCR (tesseract.js) when enabled
 *
 * LIMITATION: OCR of *scanned PDFs* requires rasterising PDF pages to bitmaps
 * (a native canvas dependency). This build OCRs image files directly and, when
 * a PDF yields almost no text, records an explicit warning instead of silently
 * returning empty content. A rasterisation step can be plugged into
 * `rasterisePdf` without changing the rest of the pipeline.
 */

export interface ExtractedPage {
  page: number;
  text: string;
}

export interface ExtractionResult {
  text: string;
  pages: ExtractedPage[];
  pageCount: number;
  usedOcr: boolean;
  warnings: string[];
  info: Record<string, unknown>;
}

const MIN_TEXT_CHARS = 200;

export function detectMime(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
    md: 'text/markdown',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    tif: 'image/tiff',
    tiff: 'image/tiff',
  };
  return map[ext] || 'application/octet-stream';
}

interface PdfPageData {
  getTextContent: (opts: unknown) => Promise<{ items: { str: string }[] }>;
}

async function extractPdf(buffer: Buffer): Promise<{ text: string; pages: ExtractedPage[]; info: Record<string, unknown> }> {
  // pdf-parse is CommonJS; require lazily for ESM/TS interop safety.
  const pdfParse = require('pdf-parse') as (
    b: Buffer,
    opts?: unknown,
  ) => Promise<{ text: string; numpages: number; info: unknown }>;

  const pages: ExtractedPage[] = [];
  let pageCounter = 0;

  const data = await pdfParse(buffer, {
    pagerender: async (pageData: PdfPageData) => {
      pageCounter += 1;
      const pageNumber = pageCounter;
      const content = await pageData.getTextContent({ normalizeWhitespace: true });
      const text = content.items.map((it) => it.str).join(' ');
      pages.push({ page: pageNumber, text });
      return text;
    },
  });

  return { text: data.text || '', pages, info: (data.info as Record<string, unknown>) || {} };
}

async function extractDocx(buffer: Buffer): Promise<{ text: string; pages: ExtractedPage[] }> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value || '';
  const pages: ExtractedPage[] = [];
  const chunkSize = 3000;
  let page = 1;
  for (let i = 0; i < text.length; i += chunkSize) {
    pages.push({ page, text: text.slice(i, i + chunkSize) });
    page += 1;
  }
  if (pages.length === 0) pages.push({ page: 1, text: '' });
  return { text, pages };
}

async function ocrImage(buffer: Buffer, languages: string): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(languages);
  try {
    const { data } = await worker.recognize(buffer);
    return data.text || '';
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

export async function extractText(
  filename: string,
  buffer: Buffer,
  _opts: { ocrEnabled?: boolean; ocrLanguages?: string } = {},
): Promise<ExtractionResult> {
  const mime = detectMime(filename);
  const warnings: string[] = [];
  let usedOcr = false;
  let text = '';
  let pages: ExtractedPage[] = [];
  let info: Record<string, unknown> = {};

  if (mime === 'application/pdf') {
    const res = await extractPdf(buffer);
    text = res.text;
    pages = res.pages;
    info = res.info;
    if (text.trim().length < MIN_TEXT_CHARS) {
      warnings.push(
        'This PDF appears to be scanned (little or no embedded text). OCR of scanned PDFs requires page rasterisation, which is not enabled in this build; the administrator should provide a text-based PDF or OCR it upstream.',
      );
    }
  } else if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/msword'
  ) {
    const res = await extractDocx(buffer);
    text = res.text;
    pages = res.pages;
  } else if (mime === 'text/plain' || mime === 'text/markdown') {
    text = buffer.toString('utf8');
    pages = [{ page: 1, text }];
  } else if (mime.startsWith('image/')) {
    if (ocrEnabled()) {
      text = await ocrImage(buffer, ocrLanguages());
      pages = [{ page: 1, text }];
      usedOcr = true;
    } else {
      warnings.push('OCR is disabled; image content was not extracted.');
    }
  } else {
    warnings.push(`Unsupported file type: ${mime}`);
  }

  if (!pages.length) pages = [{ page: 1, text }];

  return {
    text,
    pages,
    pageCount: pages.length,
    usedOcr,
    warnings,
    info,
  };
}

function ocrEnabled(): boolean {
  return process.env.OCR_ENABLED !== 'false';
}

function ocrLanguages(): string {
  return process.env.OCR_LANGUAGES || 'eng';
}
