import { errorResponse, requireRole } from "@/lib/session";
import { HttpError } from "@/lib/http-error";
import { readPdfUpload } from "@/lib/upload";
import { extractWithDocling } from "@/lib/pdf/docling";
import { track } from "@/lib/usage";

// PDF escaneado ou complexo: o navegador não conseguiu extrair texto (isScanned) e manda o arquivo para o
// docling (OCR). PDF digital NÃO passa por aqui: o texto é extraído no navegador e só ele vai para a API.
export async function POST(req: Request) {
  const t0 = Date.now();
  try {
    const session = await requireRole(["Admin", "Analista"]);

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Envie o PDF no campo \"file\".", "no_file");

    const bytes = await readPdfUpload(file); // tipo pelos bytes, tamanho e vazio: ver lib/upload.ts
    let doc;
    try {
      doc = await extractWithDocling(new Blob([bytes as BlobPart], { type: "application/pdf" }), file.name || "documento.pdf");
    } catch (e) {
      void track({ module: "demo1", action: "pdf_parse", userId: session.user.id, status: "error", durationMs: Date.now() - t0, metadata: { title: file.name, bytes: file.size } });
      throw e;
    }

    void track({
      module: "demo1",
      action: "pdf_parse",
      userId: session.user.id,
      status: "success",
      durationMs: Date.now() - t0,
      metadata: { title: file.name, bytes: file.size, pages: doc.pages.length },
    });
    return Response.json(doc, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
