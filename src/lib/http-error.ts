/**
 * Erro com status HTTP para as rotas de API (converter com errorResponse em lib/session.ts).
 * `code` é um identificador estável para a interface decidir o que mostrar (ex.: "budget_user").
 * Puro: sem dependência de servidor.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
