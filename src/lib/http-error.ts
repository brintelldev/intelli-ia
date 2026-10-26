/** Erro com status HTTP para as rotas de API (converter com errorResponse em lib/session.ts). Puro: sem dependência de servidor. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
