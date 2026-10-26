/** Consome um stream de objetos parciais e entrega no máximo um a cada `everyMs` (o objeto cresce a cada token: reenviar tudo seria desperdício). */
export async function pumpPartials<T>(stream: AsyncIterable<T>, everyMs: number, emit: (partial: T) => void): Promise<void> {
  let last = 0;
  for await (const partial of stream) {
    const now = performance.now();
    if (now - last < everyMs) continue;
    last = now;
    emit(partial);
  }
}
