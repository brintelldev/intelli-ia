/** Texto do relatório para citações e contexto, sem expor sua serialização interna. */
export function reportCitationText(report: unknown, limit = 1200): string {
  if (!report || typeof report !== 'object' || !('sections' in report) || !Array.isArray(report.sections)) return '';
  return report.sections.flatMap((section: unknown) => {
    if (!section || typeof section !== 'object' || !('heading' in section) || !('content' in section)) return [];
    if (typeof section.heading !== 'string' || typeof section.content !== 'string') return [];
    return [section.heading, section.content];
  }).join('\n\n').replace(/\[(\d+)\]/g, '(referência original nº $1)').slice(0, limit);
}
