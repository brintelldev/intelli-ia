/** "Maria da Silva" -> "MS"; "Admin" -> "AD". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** "agora", "há 5 minutos", "há 2 horas", "ontem", "há 3 dias"; passado de 30 dias, a data. */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000); // negativo = passado
  const abs = Math.abs(seconds);
  if (abs < 45) return rtf.format(0, "second"); // "agora"
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 30 * 86_400) return rtf.format(Math.round(seconds / 86_400), "day");
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
