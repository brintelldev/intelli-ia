import { buildDocument, protectedDocument } from "./document";
import type { ExtractedDocument } from "./types";

/**
 * SOMENTE no navegador: o texto do PDF é extraído na máquina da pessoa e só ele vai para a API.
 * `isScanned` => a tela deve mandar o arquivo para /api/documentos/parse-pdf (docling, com OCR).
 */
export async function extractPDF(file: File): Promise<ExtractedDocument> {
  const { default: pdf2md } = await import("@opendocsg/pdf2md");
  try {
    return buildDocument(await pdf2md(await file.arrayBuffer()));
  } catch (e) {
    if (e instanceof Error && e.name === "PasswordException") return protectedDocument();
    throw e;
  }
}
