import { useEffect, useState } from "react";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(!localStorage.getItem("cs_cookie_consent"));
    } catch {
      setShow(true);
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem("cs_cookie_consent", String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4">
      <div className="mx-auto flex max-w-xl flex-col gap-3 rounded-2xl bg-[#0a0c0c] p-4 text-white shadow-2xl sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-white/80">
          We use cookies to keep your chat session secure, remember your preferences and improve your experience. By continuing to use this site you accept our use of cookies.
        </p>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 rounded-full bg-[#f0b90b] px-5 py-2 text-sm font-bold text-black transition-opacity hover:brightness-95"
        >
          Accept
        </button>
      </div>
    </div>
  );
}