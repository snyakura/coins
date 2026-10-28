import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home, LineChart, Menu, MessageCircle, Newspaper, Sparkles, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { BrandIcon, SiteFooter, SOCIALS } from "@/components/SiteFooter";
import { TransactionChat, type ChatMode } from "@/components/TransactionChat";
import { ScrollProgress, useScrollMotion } from "@/lib/scrollMotion";
import { LINKS } from "@/lib/links";

const navigation = [
  { label: "Home", to: "/" as const, icon: Home },
  { label: "Accounts", to: "/accounts" as const, icon: UserPlus },
  { label: "AI Analyser", to: "/ai-analyser" as const, icon: Sparkles },
  { label: "Blog", to: "/blog" as const, icon: Newspaper },
  { label: "Live Market", to: "/live-market" as const, icon: LineChart },
];

/** A page counts as selected on its own address and on anything under it (e.g. /blog/my-post). */
function isActivePage(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
}

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
    <Link
      to="/"
      className="flex shrink-0 items-center transition-transform duration-300 hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none"
      aria-label="Coinspace home"
    >
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
 * Desktop navigation: a frosted pill-shaped bar. The yellow highlight slides from page to page
 * when you navigate, instead of jumping.
 */
function DesktopNav({ pathname }: { pathname: string }) {
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const [animate, setAnimate] = useState(false); // stays off for the first paint so the pill doesn't fly in from the left

  useEffect(() => {
    const measure = () => {
      const active = navRef.current?.querySelector<HTMLElement>('[data-active="true"]');
      setPill(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (navRef.current) observer.observe(navRef.current);
    void document.fonts?.ready.then(measure);
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      className="relative mx-auto hidden items-center gap-1 rounded-full border border-border/60 bg-background/40 p-1.5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset] backdrop-blur-md md:flex"
      aria-label="Primary navigation"
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-1.5 left-0 rounded-full bg-primary shadow-[0_6px_16px_-4px_rgba(0,0,0,0.25)] ${animate ? "transition-[transform,width,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none" : ""}`}
        style={{
          width: pill?.width ?? 0,
          transform: `translateX(${pill?.left ?? 0}px)`,
          opacity: pill ? 1 : 0,
        }}
      />
      {navigation.map((item) => {
        const active = isActivePage(pathname, item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            data-active={active}
            aria-current={active ? "page" : undefined}
            className={`relative z-10 rounded-full px-5 py-2.5 text-sm transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${active ? "font-bold text-foreground" : "font-medium text-foreground/60 hover:text-foreground"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Slide-and-fade entrance for one item of the phone menu. Each item starts a little later than the one before. */
function reveal(open: boolean, order: number) {
  return {
    className: `transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${open ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`,
    style: { transitionDelay: open ? `${140 + order * 60}ms` : "0ms" },
  };
}

/** Phone menu: a side panel that slides in from the left. Closes with X, Escape, the dimmed area, or a link. */
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
    document.body.style.overflow = "hidden";

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

  const bottom = reveal(open, navigation.length + 1);

  return (
    <div
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      inert={!open}
      className={`fixed inset-0 z-50 md:hidden ${open ? "" : "pointer-events-none"}`}
    >
      {/* dimmed page behind the panel */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close menu"
        onClick={onClose}
        className={`no-lift absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
      />

      <div
        ref={panelRef}
                className={`absolute inset-y-0 right-0 flex w-[86%] max-w-[22rem] flex-col overflow-hidden rounded-l-3xl bg-card shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex h-[4.5rem] shrink-0 items-center justify-between px-5">
          <div onClick={onClose}>
            <Logo />
          </div>
          <Button
            ref={closeRef}
            variant="ghost"
            size="icon"
            className="rounded-full border border-border/60 bg-background/50 hover:rotate-90"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={20} />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-3" aria-label="Mobile navigation">
          <ul className="grid gap-1.5">
            {navigation.map((item, index) => {
              const active = isActivePage(pathname, item.to);
              const motion = reveal(open, index);
              const Icon = item.icon;
              return (
                <li key={item.to} className={motion.className} style={motion.style}>
                  <Link
                    to={item.to}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-14 items-center gap-3 rounded-2xl px-4 text-base transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
                      active ? "bg-muted font-bold text-foreground" : "font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-[22px] shrink-0" strokeWidth={1.75} />
                    <span className="flex-1">{item.label}</span>
                    {active ? (
                      <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="size-4 text-foreground/25" aria-hidden="true" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div
          className={`grid gap-3 border-t border-border/70 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 ${bottom.className}`}
          style={bottom.style}
        >
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => onChat("deposit")}>Deposit</Button>
            <Button variant="outline" onClick={() => onChat("withdraw")}>Withdraw</Button>
          </div>
          <Button asChild variant="dark" className="w-full">
            <a href={LINKS.whatsapp} target="_blank" rel="noopener noreferrer" onClick={onClose}>
              <MessageCircle size={17} /> Contact us
            </a>
          </Button>
          <div className="flex items-center justify-center gap-3">
            {SOCIALS.map(({ label, href, icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="grid size-11 place-items-center rounded-full border border-border transition-colors hover:border-primary hover:bg-primary"
              >
                <BrandIcon name={icon} />
              </a>
            ))}
            <a
              href={LINKS.tfmChannel}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center gap-2 rounded-full border border-border px-4 text-xs font-semibold transition-colors hover:border-primary hover:bg-primary"
            >
              <BrandIcon name="whatsapp" /> Forex Mafia channel
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CoinspaceShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useScrollMotion(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chat, setChat] = useState<ChatMode | null>(null);
  const [scrolled, setScrolled] = useState(false);
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

  // Once the page has scrolled a little, the header gets a soft shadow and a touch more frost.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ScrollProgress />
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-xl backdrop-saturate-150 transition-[background-color,box-shadow,border-color] duration-300 motion-reduce:transition-none ${
          scrolled
            ? "border-border/60 bg-background/70 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.15)]"
            : "border-transparent bg-background/40"
        }`}
      >
        <div className="mx-auto grid h-[4.5rem] max-w-[1240px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 sm:flex sm:h-20 sm:px-8">
          <Logo />
          <DesktopNav pathname={pathname} />
          <div className="ml-auto flex items-center gap-2">
            <Button
              asChild
              variant="dark"
              size="sm"
              className={`hidden px-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95 motion-reduce:transform-none md:inline-flex ${contactButton}`}
            >
              <a href={LINKS.whatsapp} target="_blank" rel="noopener noreferrer">Contact us</a>
            </Button>
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              className="rounded-full border border-border/60 bg-background/50 backdrop-blur transition-transform duration-200 active:scale-90 motion-reduce:transform-none md:hidden"
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
           <button
        type="button"
        onClick={() => setChat("support")}
        aria-label="Chat with Coinspace"
        className="fixed bottom-4 right-4 z-20 grid size-14 place-items-center rounded-full bg-[#f0b90b] shadow-panel transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transform-none sm:bottom-5 sm:right-5 sm:size-16"
      >
        <img src="/bull.svg" alt="" className="size-10 sm:size-11" />
      </button>
      <TransactionChat mode={chat} onClose={() => setChat(null)} />
    </div>
  );
}

export function useTransactionActions() {
  return (mode: ChatMode) => window.dispatchEvent(new CustomEvent("coinspace:chat", { detail: mode }));
}