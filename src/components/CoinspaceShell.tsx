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

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Coinspace home">
      <span className="grid size-8 place-items-center rounded-full border-[7px] border-primary border-r-transparent" />
      <span className="text-xl font-bold">Coinspace</span>
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
        <div className="mx-auto grid h-16 max-w-[1240px] grid-cols-[minmax(0,1fr)_auto] items-center px-5 sm:flex sm:px-8">
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
            <Button variant="dark" size="sm" onClick={() => setChat("deposit")}>Deposit</Button>
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
      <Button variant="chat" className="fixed bottom-5 right-5 z-20 shadow-panel" onClick={() => setChat("support")}>
        <span className="grid size-5 place-items-center rounded-full border border-current text-xs">C</span>
        Chat with Coinspace
      </Button>
      <TransactionChat mode={chat} onClose={() => setChat(null)} />
    </div>
  );
}

export function useTransactionActions() {
  return (mode: ChatMode) => window.dispatchEvent(new CustomEvent("coinspace:chat", { detail: mode }));
}