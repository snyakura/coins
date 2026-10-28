import { useEffect, useRef } from "react";

/** Site-wide scroll motion: reveals page blocks + grid cards, and parallax on [data-parallax]. */
export function useScrollMotion(key: string) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-state", "shown");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    const arm = (el: HTMLElement, delay = 0) => {
      const state = el.getAttribute("data-state");
      if (state === "shown") return;
      if (state === "hidden") { io.observe(el); return; }
      if (el.classList.contains("reveal") || el.hasAttribute("data-no-reveal")) return;
      if (getComputedStyle(el).position === "fixed") return;
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // already on screen
      el.classList.add("reveal");
      el.style.setProperty("--d", `${delay}ms`);
      el.setAttribute("data-state", "hidden");
      io.observe(el);
    };

    const scan = () => {
      document.querySelectorAll<HTMLElement>("main > *, footer").forEach((el) => arm(el));
      document.querySelectorAll<HTMLElement>("main .grid").forEach((grid) =>
        Array.from(grid.children).forEach((el, i) => arm(el as HTMLElement, Math.min(i, 5) * 90)),
      );
    };

    const first = window.setTimeout(scan, 60);
    let t = 0;
    const main = document.querySelector("main");
    const mo = new MutationObserver(() => { window.clearTimeout(t); t = window.setTimeout(scan, 150); });
    if (main) mo.observe(main, { childList: true, subtree: true });

    // gentle parallax
    let raf = 0;
    const parallax = () => {
      raf = 0;
      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        const speed = Number(el.getAttribute("data-parallax")) || 0;
        el.style.translate = `0 ${Math.round(window.scrollY * speed)}px`;
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(parallax); };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(t);
      mo.disconnect();
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [key]);
}

/** Thin gold bar at the top showing how far down the page you are. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (ref.current) ref.current.style.transform = `scaleX(${h > 0 ? Math.min(1, window.scrollY / h) : 0})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return <div ref={ref} aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-primary" style={{ transform: "scaleX(0)" }} />;
}