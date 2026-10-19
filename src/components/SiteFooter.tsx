import { Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

// ---- Edit your details here ----------------------------------------------------------
const PHONE = { display: "+263 78 429 3089", href: "tel:+263784293089" };
const EMAIL = "theforexmafia2024@gmail.com";
const ADDRESS = "Pioneer House, 6th Floor, Office 601";

const CHANNEL_URL = "https://whatsapp.com/channel/0029VbCnv2E1iUxUEErWne37";

// TikTok and Instagram: replace these with your full profile links (e.g. https://www.instagram.com/yourname).
const SOCIALS = [
  { label: "TikTok", href: "https://www.tiktok.com/", icon: "tiktok" },
  { label: "WhatsApp", href: "https://wa.me/263784293089", icon: "whatsapp" },
  { label: "Instagram", href: "https://www.instagram.com/", icon: "instagram" },
] as const;

const links = [
  { label: "Home", to: "/" as const },
  { label: "AI Analyser", to: "/ai-analyser" as const },
  { label: "Blog", to: "/blog" as const },
  { label: "Live Market", to: "/live-market" as const },
];

// Brand icons: Font Awesome Free (CC BY 4.0), https://fontawesome.com/license/free
const iconPaths = {
  tiktok: "M448.5 209.9c-44 .1-87-13.6-122.8-39.2l0 178.7c0 33.1-10.1 65.4-29 92.6s-45.6 48-76.6 59.6-64.8 13.5-96.9 5.3-60.9-25.9-82.7-50.8-35.3-56-39-88.9 2.9-66.1 18.6-95.2 40-52.7 69.6-67.7 62.9-20.5 95.7-16l0 89.9c-15-4.7-31.1-4.6-46 .4s-27.9 14.6-37 27.3-14 28.1-13.9 43.9 5.2 31 14.5 43.7 22.4 22.1 37.4 26.9 31.1 4.8 46-.1 28-14.4 37.2-27.1 14.2-28.1 14.2-43.8l0-349.4 88 0c-.1 7.4 .6 14.9 1.9 22.2 3.1 16.3 9.4 31.9 18.7 45.7s21.3 25.6 35.2 34.6c19.9 13.1 43.2 20.1 67 20.1l0 87.4z",
  whatsapp: "M380.9 97.1c-41.9-42-97.7-65.1-157-65.1-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480 117.7 449.1c32.4 17.7 68.9 27 106.1 27l.1 0c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3 18.6-68.1-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1s56.2 81.2 56.1 130.5c0 101.8-84.9 184.6-186.6 184.6zM325.1 300.5c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8s-14.3 18-17.6 21.8c-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7s-12.5-30.1-17.1-41.2c-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2s-9.7 1.4-14.8 6.9c-5.1 5.6-19.4 19-19.4 46.3s19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4s4.6-24.1 3.2-26.4c-1.3-2.5-5-3.9-10.5-6.6z",
  instagram: "M224.3 141a115 115 0 1 0 -.6 230 115 115 0 1 0 .6-230zm-.6 40.4a74.6 74.6 0 1 1 .6 149.2 74.6 74.6 0 1 1 -.6-149.2zm93.4-45.1a26.8 26.8 0 1 1 53.6 0 26.8 26.8 0 1 1 -53.6 0zm129.7 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM399 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z",
};

// Light outline so keyboard focus is visible on the dark footer
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background";

function BrandIcon({ name }: { name: keyof typeof iconPaths }) {
  return (
    <svg viewBox="0 0 448 512" className="size-[18px]" fill="currentColor" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  );
}

/** One line in the contact column: a small yellow icon and the text next to it. */
function ContactLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
      <span className="min-w-0 text-sm leading-6 text-background/80 [overflow-wrap:anywhere]">{children}</span>
    </li>
  );
}

/** Yellow panel above the footer inviting people to the WhatsApp channel. Delete <FooterCta /> below if you don't want it. */
function FooterCta() {
  return (
    <section aria-labelledby="footer-cta" className="page-container pb-14 pt-16 sm:pb-16 sm:pt-20">
      <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-10 text-primary-foreground sm:px-12 sm:py-14 lg:px-16">
        {/* The logo's open ring, cropped and faint */}
        <svg viewBox="0 0 50 50" aria-hidden="true" className="pointer-events-none absolute -bottom-14 -right-14 size-56 text-foreground/10 sm:-bottom-32 sm:-right-24 sm:size-[26rem]">
          <circle cx="25" cy="25" r="19" fill="none" stroke="currentColor" strokeWidth="12" strokeDasharray="92 28" transform="rotate(-35 25 25)" />
        </svg>
        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between xl:gap-12">
          <div className="max-w-xl">
            <h2 id="footer-cta" className="text-balance text-3xl font-extrabold leading-[1.05] sm:text-4xl xl:text-5xl">
              Join our WhatsApp channel.
            </h2>
            <p className="mt-4 max-w-md text-balance text-base leading-7 sm:text-lg">Follow Coinspace on WhatsApp to get our updates straight to your phone.</p>
          </div>
          <Button asChild variant="dark" className="sm:self-start xl:self-auto">
            <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">
              <BrandIcon name="whatsapp" /> Join the channel
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Site-wide footer. Pass the logo in so this file doesn't depend on the header file. */
export function SiteFooter({ logo }: { logo: ReactNode }) {
  return (
    <>
      <FooterCta />
      <footer className="bg-foreground text-background">
        {/* Top: logo and note on the left, page links and contact details on the right.
            The "Contact us" buttons scroll to this block (id="contact"). */}
        <div id="contact" className="page-container scroll-mt-20 grid gap-12 pb-12 pt-14 sm:pb-14 sm:pt-16 lg:grid-cols-[minmax(0,1.15fr)_auto_auto] lg:gap-20">
          <div>
            {/* The logo artwork is black, so it is turned white to show on the dark background */}
            <div className="inline-block brightness-0 invert">{logo}</div>
            <p className="mt-5 max-w-xs text-sm leading-6 text-background/60">
              Deposit and withdraw for forex and crypto trading through simple chat steps. Markets move fast and trading carries risk, so
              only trade with money you can afford to lose.
            </p>
          </div>

          <nav aria-label="Footer navigation">
            <ul className="grid gap-3">
              {links.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`text-xs font-semibold uppercase tracking-[0.12em] text-background/80 transition-colors hover:text-primary ${focusRing}`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <ul className="grid content-start gap-3 lg:max-w-[16rem]">
            <ContactLine icon={<Phone size={16} />}>
              <a href={PHONE.href} className={`transition-colors hover:text-primary ${focusRing}`}>{PHONE.display}</a>
            </ContactLine>
            <ContactLine icon={<Mail size={16} />}>
              <a href={`mailto:${EMAIL}`} className={`transition-colors hover:text-primary ${focusRing}`}>{EMAIL}</a>
            </ContactLine>
            <ContactLine icon={<MapPin size={16} />}>{ADDRESS}</ContactLine>
          </ul>
        </div>

        {/* Divider, then centered social icons and copyright. Extra bottom space on phones keeps the floating chat button clear. */}
        <div className="page-container">
          <div className="border-t border-background/20" />
          <div className="flex flex-col items-center pb-24 pt-10 sm:pb-12">
            <ul className="flex items-center justify-center gap-3">
              {SOCIALS.map(({ label, href, icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={`grid size-10 place-items-center rounded-full border border-background/60 text-background transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground ${focusRing}`}
                  >
                    <BrandIcon name={icon} />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-center text-xs text-background/60">&copy; {new Date().getFullYear()} Coinspace. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}