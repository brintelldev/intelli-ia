import { HttpError } from "@/lib/http-error";

// Validação de uploads no SERVIDOR. A interface também filtra, mas isso não protege nada: quem chama a
// API direto manda o que quiser. O tipo é decidido pelos bytes do arquivo, nunca pelo nome ou pelo
// Content-Type informado pelo cliente (ambos são livres).

export const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB (o Nginx aceita até 100 MB de corpo)
export const MAX_TEXT_BYTES = 2 * 1024 * 1024; // texto puro (≈ 400 páginas)

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const PDF_HEADER_WINDOW = 1024; // a especificação do PDF admite lixo antes do cabeçalho, até 1 KB

const MB = (n: number) => Math.round(n / 1024 / 1024);

function fits(bytes: Uint8Array, magic: readonly number[]): boolean {
  const end = Math.min(bytes.length, PDF_HEADER_WINDOW) - magic.length;
  for (let i = 0; i <= end; i++) {
    if (magic.every((b, j) => bytes[i + j] === b)) return true;
  }
  return false;
}

/** Confere um PDF já lido: não vazio, dentro do limite e com o cabeçalho `%PDF-`. */
export function assertPdf(bytes: Uint8Array): void {
  if (bytes.length === 0) throw new HttpError(400, "O arquivo está vazio.", "empty_file");
  if (bytes.length > MAX_PDF_BYTES) {
    throw new HttpError(413, `O PDF passa do limite de ${MB(MAX_PDF_BYTES)} MB.`, "file_too_large");
  }
  if (!fits(bytes, PDF_MAGIC)) {
    throw new HttpError(400, "O arquivo enviado não é um PDF válido.", "invalid_pdf");
  }
}

/**
 * Lê o upload de uma rota (multipart). O tamanho é conferido ANTES de ler o arquivo para a memória,
 * então um arquivo gigante é recusado sem custo.
 */
export async function readPdfUpload(file: File): Promise<Uint8Array> {
  if (file.size > MAX_PDF_BYTES) {
    throw new HttpError(413, `O PDF passa do limite de ${MB(MAX_PDF_BYTES)} MB.`, "file_too_large");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  assertPdf(bytes);
  return bytes;
}

/** Texto colado ou arquivo de texto: não vazio, dentro do limite e sem bytes nulos (sinal de arquivo binário). */
export function assertText(text: string): void {
  if (!text.trim()) throw new HttpError(400, "O texto está vazio.", "empty_text");
  if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) {
    throw new HttpError(413, `O texto passa do limite de ${MB(MAX_TEXT_BYTES)} MB.`, "file_too_large");
  }
  if (text.includes("\0")) throw new HttpError(400, "O arquivo parece ser binário, não texto.", "invalid_text");
}
