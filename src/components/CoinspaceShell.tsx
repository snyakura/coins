import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";
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

// Logo heights. Header: 36px on phones, 40px from tablets up. Footer: a little larger.
const headerLogoSize = "h-9 sm:h-10";
const footerLogoSize = "h-10 sm:h-11 lg:h-12";

// Black "Contact us" button that turns yellow on hover
const contactButton = "hover:bg-primary hover:text-primary-foreground";

/** Scrolls to the contact details in the footer (the footer is on every page). */
function goToContact(event: MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById("contact");
  if (!target) return; // no footer found: the plain #contact link still works
  event.preventDefault();
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
}

export function Logo({ size = headerLogoSize }: { size?: string }) {
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
          className={`block max-w-[60vw] ${size} [&>svg]:block [&>svg]:h-full [&>svg]:w-full`}
          style={{ aspectRatio: logo.ratio }}
          dangerouslySetInnerHTML={{ __html: logo.html }}
        />
      ) : logo === "failed" ? (
        <img src="/logo.svg" alt="Coinspace" className={`${size} w-auto max-w-[60vw] object-contain`} />
      ) : (
        <span className={`block w-36 ${size}`} aria-hidden="true" />
      )}
    </Link>
  );
}

/**
 * Phone menu: a panel that slides in from the right while the page behind it is dimmed and blurred.
 * Closes with the X button, the Escape key, a tap on the blurred area, or by choosing a link.
 */
function MobileMenu({
  open,
  pathname,
  onClose,
  onChat,
  returnFocusRef,
}: {
  open: boolean;
  pathname: string;
  onClose: () => void;
  onChat: (mode: ChatMode) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) {
        wasOpen.current = false;
        returnFocusRef.current?.focus({ preventScroll: true });
      }
      return;
    }
    wasOpen.current = true;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind doesn't scroll while the menu is open

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return onClose();
      if (event.key !== "Tab") return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!items?.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, returnFocusRef]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <div
        id="mobile-menu"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-[88%] max-w-sm flex-col bg-background shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none md:hidden ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-start justify-between border-b border-border px-6 pb-5 pt-6">
          <div>
            <p className="text-xl font-bold leading-tight">Menu</p>
            <p className="mt-1 text-sm text-muted-foreground">Explore Coinspace</p>
          </div>
          <Button ref={closeRef} variant="ghost" size="icon" className="-mr-3 -mt-2" onClick={onClose} aria-label="Close menu">
            <X size={22} />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-6 py-2" aria-label="Mobile navigation">
          <ul className="divide-y divide-border">
            {navigation.map((item) => {
              const active = pathname === item.to;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between rounded py-5 text-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${active ? "font-bold text-foreground" : "font-medium text-muted-foreground hover:text-foreground"}`}
                  >
                    {item.label}
                    {active && <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="grid gap-3 px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="hover:border-primary hover:bg-primary" onClick={() => onChat("deposit")}>
              Deposit
            </Button>
            <Button variant="outline" className="hover:border-primary hover:bg-primary" onClick={() => onChat("withdraw")}>
              Withdraw
            </Button>
          </div>
          <Button asChild variant="dark" className={`w-full ${contactButton}`}>
            <a
              href="#contact"
              onClick={(event) => {
                onClose();
                goToContact(event);
              }}
            >
              Contact us
            </a>
          </Button>
        </div>
      </div>
    </>
  );
}

export function CoinspaceShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const [chat, setChat] = useState<ChatMode | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const chatFromMenu = useCallback((mode: ChatMode) => {
    setMenuOpen(false);
    setChat(mode);
  }, []);

  // If the window grows to desktop size while the phone menu is open, close it.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const onChange = () => query.matches && setMenuOpen(false);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

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
            <Button asChild variant="dark" size="sm" className={`hidden px-5 md:inline-flex ${contactButton}`}>
              <a href="#contact" onClick={goToContact}>Contact us</a>
            </Button>
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              <Menu size={21} />
            </Button>
          </div>
        </div>
      </header>
      <MobileMenu open={menuOpen} pathname={pathname} onClose={closeMenu} onChat={chatFromMenu} returnFocusRef={menuButtonRef} />
      {children}
      <SiteFooter logo={<Logo size={footerLogoSize} />} />
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