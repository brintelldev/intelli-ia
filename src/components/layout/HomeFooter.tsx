import Link from "next/link";
import { SystemStatus } from "./SystemStatus";

export function HomeFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-text-muted sm:flex-row md:px-6">
        <p>© {process.env.BUILD_YEAR} Intelli AI. All rights reserved.</p>
        <nav aria-label="Rodapé">
          <Link href="/privacidade" className="rounded underline-offset-2 hover:text-text-secondary hover:underline focus-visible:ring-2 focus-visible:ring-accent-primary">
            Privacidade
          </Link>
        </nav>
        <SystemStatus />
      </div>
    </footer>
  );
}
