import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";
import { TransactionChat, type ChatMode } from "@/components/TransactionChat";
import { ScrollProgress, useScrollMotion } from "@/lib/scrollMotion";

const navigation = [
  { label: "Home", to: "/" as const },
  { label: "AI Analyser", to: "/ai-analyser" as const },
  { label: "Blog", to: "/blog" as const },
  { label: "Live Market", to: "/live-market" as const },
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

/**
 * Phone menu: a clean full-screen panel in the site's own light background.
 * The logo and close button sit exactly where they do in the header. Large links with hairline
 * dividers glide in one after another. Closes with the X button, the Escape key,
 * or by choosing a link.
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

  const eyebrow = reveal(open, 0);
  const buttons = reveal(open, navigation.length + 1);

  return (
    <div
      id="mobile-menu"
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      inert={!open}
      className={`fixed inset-0 z-50 flex flex-col overflow-hidden bg-background transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none md:hidden ${open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"}`}
    >
      {/* a very soft yellow glow in the corner */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />

      {/* same height and padding as the header, so the logo doesn't move */}
      <div className="relative flex h-[4.5rem] shrink-0 items-center justify-between px-5 sm:h-20 sm:px-8">
        <div onClick={onClose}>
          <Logo />
        </div>
        <Button
          ref={closeRef}
          variant="ghost"
          size="icon"
          className="rounded-full border border-border/60 bg-background/50 transition-transform duration-300 hover:rotate-90 active:scale-90 motion-reduce:transform-none"
          onClick={onClose}
          aria-label="Close menu"
        >
          <X size={21} />
        </Button>
      </div>

      <p
        className={`relative px-6 pb-3 pt-8 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:px-8 ${eyebrow.className}`}
        style={eyebrow.style}
      >
        Menu
      </p>

      <nav className="relative flex-1 overflow-y-auto px-6 sm:px-8" aria-label="Mobile navigation">
        <ul className="border-t border-border/70">
          {navigation.map((item, index) => {
            const active = isActivePage(pathname, item.to);
            const motion = reveal(open, index + 1);
            return (
              <li key={item.to} className={motion.className} style={motion.style}>
                <Link
                  to={item.to}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center justify-between gap-4 border-b border-border/70 py-5 transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${active ? "text-foreground" : "text-foreground/60 hover:text-foreground"}`}
                >
                  <span className="flex items-center gap-3">
                    {active && <span className="size-2 shrink-0 rounded-full bg-primary shadow-[0_0_0_4px_rgba(255,203,5,0.25)]" aria-hidden="true" />}
                    <span className={`text-[26px] leading-none tracking-tight ${active ? "font-bold" : "font-medium"}`}>{item.label}</span>
                  </span>
                  <ArrowRight
                    size={20}
                    strokeWidth={1.75}
                    className="shrink-0 text-foreground/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-foreground motion-reduce:transform-none"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={`relative grid gap-3 px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-5 sm:px-8 ${buttons.className}`}
        style={buttons.style}
      >
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
              <a href="#contact" onClick={goToContact}>Contact us</a>
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