import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TransactionChat, type ChatMode } from "@/components/TransactionChat";

const navigation = [
  { label: "Home", to: "/" as const },
  { label: "AI Analyser", to: "/ai-analyser" as const },
  { label: "Blog", to: "/blog" as const },
  { label: "Live Market", to: "/live-market" as const },
];

type LogoData = { html: string; ratio: number };
let cachedLogo: LogoData | null = null; // measured once, reused when you change pages

/**
 * Loads /logo.svg and crops it to the real artwork, so empty space inside the file
 * never makes the logo look small. Works with any logo SVG, whatever its padding.
 */
export async function loadCroppedLogo(): Promise<LogoData | null> {
  const response = await fetch("/logo.svg");
  if (!response.ok) return null;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:absolute;left:-9999px;top:0;width:200px;height:200px;opacity:0;pointer-events:none";
  host.innerHTML = await response.text();
  document.body.appendChild(host);
  try {
    const svg = host.querySelector("svg");
    if (!svg) return null;
    const box = svg.getBBox(); // the true size of the drawing, ignoring empty space
    if (!box.width || !box.height) return null;
    const pad = Math.max(box.width, box.height) * 0.02;
    const w = box.width + pad * 2;
    const h = box.height + pad * 2;
    svg.setAttribute("viewBox", `${box.x - pad} ${box.y - pad} ${w} ${h}`);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    return { html: svg.outerHTML, ratio: w / h };
  } finally {
    host.remove();
  }
}

const logoSize = "h-10 sm:h-11 lg:h-12"; // change these three numbers to make the logo bigger or smaller

export function Logo() {
  const [logo, setLogo] = useState<LogoData | "failed" | null>(cachedLogo);

  useEffect(() => {
    if (cachedLogo) return;
    let active = true;
    loadCroppedLogo()
      .then((data) => {
        cachedLogo = data;
        if (active) setLogo(data ?? "failed");
      })
      .catch(() => active && setLogo("failed"));
    return () => {
      active = false;
    };
  }, []);

  return (
    <Link to="/" className="flex shrink-0 items-center" aria-label="Coinspace home">
      {logo && logo !== "failed" ? (
        <span
          className={`block max-w-[60vw] ${logoSize} [&>svg]:block [&>svg]:h-full [&>svg]:w-full`}
          style={{ aspectRatio: logo.ratio }}
          dangerouslySetInnerHTML={{ __html: logo.html }}
        />
      ) : logo === "failed" ? (
        <img src="/logo.svg" alt="Coinspace" className={`${logoSize} w-auto max-w-[60vw] object-contain`} />
      ) : (
        <span className={`block w-36 ${logoSize}`} aria-hidden="true" />
      )}
    </Link>
  );
}

export function CoinspaceShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const [chat, setChat] = useState<ChatMode | null>(null);

  useEffect(() => {
    const openChat = (event: Event) => setChat((event as CustomEvent<ChatMode>).detail);
    window.addEventListener("coinspace:chat", openChat);
    return () => window.removeEventListener("coinspace:chat", openChat);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto grid h-16 max-w-[1240px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 sm:flex sm:px-8">
          <Logo />
          <nav className="mx-auto hidden items-center gap-3 md:flex" aria-label="Primary navigation">
            {navigation.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${pathname === item.to ? "bg-primary" : "hover:bg-muted"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation">
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </Button>
          </div>
        </div>
        {menuOpen && (
          <nav className="grid border-t border-border px-5 py-3 md:hidden" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)} className={`rounded-md px-3 py-3 text-sm font-medium ${pathname === item.to ? "bg-primary" : "hover:bg-muted"}`}>
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      {children}
      <Button variant="chat" className="fixed bottom-4 right-4 z-20 shadow-panel sm:bottom-5 sm:right-5" onClick={() => setChat("support")}>
        <span className="grid size-5 place-items-center rounded-full border border-current text-xs">C</span>
        <span className="sm:hidden">Chat</span>
        <span className="hidden sm:inline">Chat with Coinspace</span>
      </Button>
      <TransactionChat mode={chat} onClose={() => setChat(null)} />
    </div>
  );
}

export function useTransactionActions() {
  return (mode: ChatMode) => window.dispatchEvent(new CustomEvent("coinspace:chat", { detail: mode }));
}