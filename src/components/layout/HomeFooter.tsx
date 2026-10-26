import { SystemStatus } from "./SystemStatus";

export function HomeFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-text-muted sm:flex-row md:px-6">
        <p>© {process.env.BUILD_YEAR} Intelli AI. All rights reserved.</p>
        <SystemStatus />
      </div>
    </footer>
  );
}
