import { useEffect, useState } from "react";

const KEY = "cs_consent";
const MAX_AGE = 365 * 24 * 60 * 60 * 1000; // we ask again after 12 months

export type Consent = { v: 1; thirdParty: boolean; at: number };

function read(): Consent | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    if (c?.v === 1 && Date.now() - Number(c.at) < MAX_AGE) return c as Consent;
  } catch { /* ignore */ }
  return null;
}

/** Saves the visitor's choice for optional third-party content (TradingView charts). */
export function setConsent(thirdParty: boolean) {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, thirdParty, at: Date.now() })); } catch { /* ignore */ }
  window.dispatchEvent(new Event("coinspace:consent"));
}

/** Reopens the cookie settings (used by the footer link). */
export function openCookieSettings() {
  window.dispatchEvent(new Event("coinspace:cookie-open"));
}

export function useConsent() {
  const [consent, setState] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => { setState(read()); setReady(true); };
    sync();
    window.addEventListener("coinspace:consent", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("coinspace:consent", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return { consent, ready };
}

/** Cookie card in the bottom-left corner. Shows until the visitor chooses, and again from "Cookie settings" in the footer. */
export function CookieBanner() {
  const { consent, ready } = useConsent();
  const [forced, setForced] = useState(false); // opened from the footer
  const [manage, setManage] = useState(false);
  const [thirdParty, setThirdParty] = useState(false);

  useEffect(() => {
    const show = () => {
      setThirdParty(read()?.thirdParty ?? false);
      setManage(true);
      setForced(true);
    };
    window.addEventListener("coinspace:cookie-open", show);
    return () => window.removeEventListener("coinspace:cookie-open", show);
  }, []);

  if (!ready || (consent && !forced)) return null;

  const close = () => { setForced(false); setManage(false); };
  const choose = (value: boolean) => { setConsent(value); close(); };
  const back = () => (forced ? close() : setManage(false));

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="anim-rise fixed bottom-3 left-3 right-3 z-[70] sm:bottom-5 sm:left-5 sm:right-auto sm:w-[26rem]"
    >
      <div className="rounded-3xl bg-white p-6 text-[#1c1f22] shadow-[0_24px_70px_-14px_rgba(0,0,0,0.4)] sm:p-8">
        {!manage ? (
          <>
            <h2 className="text-[1.65rem] font-extrabold leading-tight tracking-tight">Choose your cookies</h2>
            <p className="mt-3 text-[15px] leading-6 text-[#1c1f22]/85">
              Cookies help Coinspace work and improve your experience. Essential cookies are always on. You decide whether we may show optional third-party content such as live charts.{" "}
              <button type="button" onClick={() => setManage(true)} className="no-lift underline underline-offset-2 hover:no-underline">
                Learn more and manage
              </button>
            </p>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => choose(true)}
                className="h-14 rounded-full bg-[#1c1f22] px-4 text-base font-semibold text-white hover:bg-black"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => choose(false)}
                className="h-14 rounded-full border-2 border-[#1c1f22] bg-[#eceefe] px-4 text-base font-semibold text-[#1c1f22] hover:bg-[#dfe2fd]"
              >
                Reject non-essential cookies
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[1.65rem] font-extrabold leading-tight tracking-tight">Cookie settings</h2>
            <p className="mt-3 text-[15px] leading-6 text-[#1c1f22]/85">
              Choose what we may use. You can change this any time with “Cookie settings” at the bottom of the page.
            </p>
            <ul className="mt-5 grid gap-3">
              <li className="flex items-start justify-between gap-4 rounded-2xl bg-[#f4f4f1] p-4">
                <div>
                  <p className="font-bold">Essential</p>
                  <p className="mt-1 text-sm leading-5 text-[#1c1f22]/70">Remembers your name and your chat so the site works. Always on.</p>
                </div>
                <span className="mt-0.5 shrink-0 rounded-full bg-[#1c1f22] px-3 py-1 text-xs font-semibold text-white">Always on</span>
              </li>
              <li className="flex items-start justify-between gap-4 rounded-2xl bg-[#f4f4f1] p-4">
                <div>
                  <p className="font-bold">Third-party content</p>
                  <p className="mt-1 text-sm leading-5 text-[#1c1f22]/70">
                    Live charts, tickers and market data from TradingView. TradingView may set its own cookies.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={thirdParty}
                  aria-label="Allow third-party content"
                  onClick={() => setThirdParty((v) => !v)}
                  className={`no-lift relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${thirdParty ? "bg-[#1c1f22]" : "bg-[#c9ccd4]"}`}
                >
                  <span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${thirdParty ? "left-6" : "left-1"}`} />
                </button>
              </li>
            </ul>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => choose(thirdParty)}
                className="h-14 rounded-full bg-[#1c1f22] px-4 text-base font-semibold text-white hover:bg-black"
              >
                Save my choices
              </button>
              <button
                type="button"
                onClick={back}
                className="h-14 rounded-full border-2 border-[#1c1f22] bg-[#eceefe] px-4 text-base font-semibold text-[#1c1f22] hover:bg-[#dfe2fd]"
              >
                {forced ? "Cancel" : "Back"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Your __root.tsx already renders <CookieConsent />, so the banner answers to that name too. */
export { CookieBanner as CookieConsent };