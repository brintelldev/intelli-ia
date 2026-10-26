import { buildDocument, PAGE_BREAK } from "./document";
import { HttpError } from "@/lib/http-error";
import type { ExtractedDocument } from "./types";

/** 1ª conversão carrega os modelos (medido: ~4 s para 1 página); folga para PDFs grandes. */
const TIMEOUT_MS = 120_000;

/** PDF escaneado ou complexo: OCR no docling-serve (POST /v1/convert/file, saída em markdown). */
export async function extractWithDocling(file: Blob, filename: string): Promise<ExtractedDocument> {
  const base = process.env.DOCLING_URL;
  if (!base) throw new HttpError(503, "Leitura de PDF escaneado indisponível no momento.", "docling_unavailable");

  const form = new FormData();
  form.append("files", file, filename);
  form.append("to_formats", "md");
  form.append("do_ocr", "true");
  form.append("md_page_break_placeholder", PAGE_BREAK);

  let res: Response;
  try {
    res = await fetch(`${base}/v1/convert/file`, { method: "POST", body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    console.error("docling:", e instanceof Error ? e.message : e);
    throw new HttpError(503, "Leitura de PDF escaneado indisponível no momento.", "docling_unavailable");
  }
  if (!res.ok) {
    console.error("docling: HTTP", res.status);
    throw new HttpError(502, "Não foi possível ler este PDF.", "docling_failed");
  }

  const body = (await res.json()) as { status?: string; document?: { md_content?: string } };
  const markdown = body.document?.md_content;
  if (body.status !== "success" || typeof markdown !== "string") {
    throw new HttpError(502, "Não foi possível ler este PDF.", "docling_failed");
  }
  const doc = buildDocument(markdown);
  // OCR sem texto nenhum: não devolver "documento vazio" como se fosse sucesso.
  if (!doc.text.trim()) throw new HttpError(422, "Nenhum texto foi encontrado neste PDF.", "no_text");
  return doc;
}
