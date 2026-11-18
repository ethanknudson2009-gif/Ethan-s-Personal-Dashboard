"use client";

/**
 * Pulls the text out of a PDF right in the browser with pdf.js (free, by
 * Mozilla, installed as a package). Nothing is sent anywhere to do this.
 * Scanned PDFs have no text layer: then this returns "" and Claude reads
 * the file directly instead.
 */
const MAX_CHARS = 400_000;

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const pages: string[] = [];
  let total = 0;
  for (let i = 1; i <= doc.numPages && total < MAX_CHARS; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Rebuild lines: pdf.js gives pieces of text; hasEOL marks line ends.
    let line = "";
    const lines: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line.trim());
        line = "";
      } else line += " ";
    }
    if (line.trim()) lines.push(line.trim());
    const text = lines.filter(Boolean).join("\n");
    pages.push(`--- Page ${i} ---\n${text}`);
    total += text.length;
  }
  await task.destroy();
  const all = pages.join("\n\n");
  // A PDF with almost no text is probably a scan.
  return all.replace(/--- Page \d+ ---/g, "").trim().length < 40 ? "" : all.slice(0, MAX_CHARS);
}
