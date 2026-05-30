/**
 * Server-side resume text extraction for PDF / DOCX / plain text.
 * pdf-parse and mammoth are CommonJS server-only modules.
 *
 * NOTE: we import "pdf-parse/lib/pdf-parse.js" rather than "pdf-parse".
 * The package's index.js runs debug code on import that reads a bundled
 * test PDF from disk and throws ENOENT in a server/bundler context.
 * Importing the internal lib avoids that and is the documented workaround.
 */

export async function extractResumeText(
  buffer: Buffer,
  filename: string,
  mime?: string
): Promise<string> {
  const name = filename.toLowerCase();
  const isPdf = name.endsWith(".pdf") || mime === "application/pdf";
  const isDocx =
    name.endsWith(".docx") ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (isPdf) {
    let pdfParse: (b: Buffer) => Promise<{ text: string }>;
    try {
      // @ts-expect-error - no type declarations for deep import path
      const mod: any = await import("pdf-parse/lib/pdf-parse.js");
      pdfParse = mod.default || mod;
    } catch {
      const mod: any = await import("pdf-parse");
      pdfParse = mod.default || mod;
    }
    const data = await pdfParse(buffer);
    const text = clean(data.text || "");
    if (text.length < 20) {
      throw new Error(
        "This PDF has no extractable text (it may be a scanned image). Please paste the resume text instead."
      );
    }
    return text;
  }

  if (isDocx) {
    const mod: any = await import("mammoth");
    const mammoth = mod.default || mod;
    const res = await mammoth.extractRawText({ buffer });
    const text = clean(res.value || "");
    if (text.length < 20) {
      throw new Error("Could not extract text from this DOCX file.");
    }
    return text;
  }

  // plain text / fallback
  return clean(buffer.toString("utf8"));
}

function clean(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
