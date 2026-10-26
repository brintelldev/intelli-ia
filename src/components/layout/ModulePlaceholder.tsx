// Provisório (T-03): a T-04 troca por layout com sidebar e as páginas reais.
export function ModulePlaceholder({ title }: { title: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="text-text-secondary">Em construção.</p>
    </main>
  );
}
