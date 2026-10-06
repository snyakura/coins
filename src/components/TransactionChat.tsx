import { Check, Copy, Image as ImageIcon, Send, X, Zap } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

export type ChatMode = "deposit" | "withdraw" | "support";

type Flow = "deposit" | "withdraw";
type Asset = "USDT" | "WELTRADE" | "DERIV" | "OTHER";
type Pending = "coin" | "address" | "weltradeId" | "derivNick" | "";
type Stage =
  | "menu"
  | "asset"
  | "network"
  | "method"
  | "detail"
  | "amount"
  | "pay"
  | "send"
  | "proof"
  | "processing"
  | "number"
  | "ended";

type CardRowData = { label: string; value: string; copy?: boolean };

type Msg =
  | { id: number; role: "bot" | "user"; kind: "text"; text: string; time: string }
  | { id: number; role: "bot"; kind: "pay"; amount: number; destination: string; reference: string }
  | {
      id: number;
      role: "bot";
      kind: "send";
      title: string;
      amount: number;
      reference: string;
      rows: CardRowData[];
      qr?: string;
      steps?: string[];
      note?: string;
    }
  | { id: number; role: "user"; kind: "upload"; name: string; time: string }
  | { id: number; role: "bot"; kind: "read"; amount: number; reference: string; sender: string; confidence: number }
  | { id: number; role: "bot"; kind: "checks"; items: string[] }
  | { id: number; role: "system"; kind: "pill"; tone: "ok" | "wait"; label: string; sub?: string };

type Ctx = {
  flow: Flow | null;
  asset: Asset | "";
  method: string; // network (deposit) or Binance ID / OKX ID / network (withdraw)
  coin: string;
  detail: string; // Weltrade user ID, Deriv nickname or wallet address
  pending: Pending;
  destination: string;
  amount: number;
  reference: string;
};

const emptyCtx = (flow: Flow | null = null): Ctx => ({
  flow,
  asset: "",
  method: "",
  coin: "",
  detail: "",
  pending: "",
  destination: "",
  amount: 0,
  reference: "",
});

const ASSETS: { id: Asset; label: string }[] = [
  { id: "USDT", label: "USDT" },
  { id: "WELTRADE", label: "Weltrade" },
  { id: "DERIV", label: "Deriv" },
  { id: "OTHER", label: "Other" },
];
const NETWORKS = ["POLYGON", "OPTOS", "TRC20"];
const WITHDRAW_METHODS = ["Binance ID", "OKX ID", ...NETWORKS];
const QUICK_COINS = ["BTC", "ETH", "BNB", "SOL"];
const QUICK_AMOUNTS = [10, 20, 50, 100, 250];
const MIN_AMOUNT = 5;
const MAX_DEPOSIT = 2000;
const LARGE_PAYOUT = 200; // payouts at or above this wait for a human check
const MERCHANT = { name: "Coinspace (Pvt) Ltd", code: "100234", number: "+263 77 000 1234" };
const REGISTERED_NUMBER = "+263 77 123 4567";

// TODO: replace these placeholders with your real details and QR images (put QR files in /public/qr).
const OUR_ACCOUNTS: Record<string, { address: string; qr: string }> = {
  TRC20: { address: "TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", qr: "/qr/usdt-trc20.png" },
  OPTOS: { address: "0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", qr: "/qr/usdt-optos.png" },
  POLYGON: { address: "0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", qr: "/qr/usdt-polygon.png" },
};
const EXCHANGE_IDS: Record<string, string> = {
  "Binance ID": "000000000",
  "OKX ID": "000000000",
};
const AGENT_NAME = "Forex Mafia";

const DETAIL_PROMPTS: Record<Exclude<Pending, "">, string> = {
  coin: "Type the coin (e.g. BTC)",
  address: "Wallet address",
  weltradeId: "Weltrade user ID",
  derivNick: "Deriv nickname",
};

let nextId = 0;
const newId = () => ++nextId;
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
const money = (n: number) => `$${n.toFixed(2)}`;
const plain = (n: number) => `$${+n.toFixed(2)}`;
const randomFrom = (chars: string, length: number) =>
  Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
const makeReference = () => `CS-${randomFrom("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5)}`;

const bot = (text: string): Msg => ({ id: newId(), role: "bot", kind: "text", text, time: now() });
const me = (text: string): Msg => ({ id: newId(), role: "user", kind: "text", text, time: now() });

const chip = "rounded-full border border-black bg-white px-4 py-1.5 text-sm font-bold text-black transition-colors hover:bg-black hover:text-white";
const textField = "h-12 min-w-0 flex-1 rounded-full bg-[#e9e9e5] px-5 text-sm outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-black/10";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button type="button" aria-label={`Copy ${label}`} onClick={copy} className="grid size-7 shrink-0 place-items-center rounded-md border border-white/20 text-white/80 hover:bg-white/10">
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function CardRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
      <span className="shrink-0 text-white/60">{label}</span>
      <span className="flex min-w-0 items-center gap-2 font-semibold text-white">{children}</span>
    </div>
  );
}

export function TransactionChat({ mode, onClose }: { mode: ChatMode | null; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [stage, setStage] = useState<Stage>("menu");
  const [flow, setFlow] = useState<Flow | null>(null);
  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [custom, setCustom] = useState("");
  const [numberInput, setNumberInput] = useState("");
  const [detailInput, setDetailInput] = useState("");
  const [pendingKind, setPendingKind] = useState<Pending>("");

  const ctx = useRef<Ctx>(emptyCtx());
  const timers = useRef<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const push = (...items: Msg[]) => setMessages((current) => [...current, ...items]);

  // Shows the typing dots, then reveals each bot message one after another.
  const respond = (items: Msg[], after?: () => void, gap = 750) => {
    setTyping(true);
    items.forEach((item, index) => {
      later(() => {
        setMessages((current) => [...current, item]);
        if (index === items.length - 1) {
          setTyping(false);
          after?.();
        }
      }, gap * (index + 1));
    });
  };

  const startFlow = (next: Flow) => {
    ctx.current = emptyCtx(next);
    setFlow(next);
    setStep(1);
    setStage("asset");
    respond([
      bot(
        next === "deposit"
          ? "Great — let's get that deposit started. What would you like to deposit?"
          : "Let's sort out your withdrawal. What would you like to withdraw?",
      ),
    ]);
  };

  const begin = (next: Flow) => {
    push(me(`I want to ${next}`));
    startFlow(next);
  };

  useEffect(() => {
    clearTimers();
    setMessages([]);
    setStage("menu");
    setFlow(null);
    setStep(0);
    setTyping(false);
    setInput("");
    setCustom("");
    setNumberInput("");
    setDetailInput("");
    setPendingKind("");
    ctx.current = emptyCtx();
    if (mode === "support") {
      respond([bot("Hi! I'm the Coinspace assistant. How can I help you today?")]);
    } else if (mode) {
      begin(mode);
    }
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  if (!mode) return null;

  const askAmount = () => {
    setStage("amount");
    setStep(2);
    respond([
      bot(
        ctx.current.flow === "deposit"
          ? "How much would you like to deposit? (min $5, max $2,000)"
          : "How much would you like to withdraw? (min $5)",
      ),
    ]);
  };

  const askDetail = (pending: Exclude<Pending, "">, text: string) => {
    ctx.current.pending = pending;
    setPendingKind(pending);
    setDetailInput("");
    setStage("detail");
    respond([bot(text)]);
  };

  const pickAsset = (asset: Asset, label: string) => {
    if (typing) return;
    push(me(label));
    ctx.current.asset = asset;
    const deposit = ctx.current.flow === "deposit";

    if (asset === "USDT") {
      setStage(deposit ? "network" : "method");
      respond([
        bot(
          deposit
            ? "Which USDT network would you like to use?"
            : "How will you send us the USDT? Choose Binance ID, OKX ID or a network.",
        ),
      ]);
      return;
    }
    if (asset === "WELTRADE") {
      if (deposit) askDetail("weltradeId", "Please enter your Weltrade user ID.");
      else askAmount();
      return;
    }
    if (asset === "DERIV") {
      if (deposit) askDetail("derivNick", "What's your Deriv nickname?");
      else askAmount();
      return;
    }
    askDetail(
      "coin",
      `Which crypto would you like to ${deposit ? "deposit" : "withdraw"}? Pick one or type the coin name.`,
    );
  };

  const pickMethod = (method: string) => {
    if (typing) return;
    push(me(method));
    ctx.current.method = method;
    if (ctx.current.flow === "deposit") {
      askDetail("address", `Paste the ${method} wallet address where we should send your USDT.`);
    } else {
      askAmount();
    }
  };

  const submitDetail = (raw: string) => {
    if (typing) return;
    const value = raw.trim();
    if (!value) return;
    setDetailInput("");
    push(me(value));
    const deposit = ctx.current.flow === "deposit";

    switch (ctx.current.pending) {
      case "coin": {
        const coin = value.toUpperCase();
        ctx.current.coin = coin;
        if (deposit) askDetail("address", `Paste the ${coin} wallet address where we should send your ${coin}.`);
        else askAmount();
        return;
      }
      default:
        ctx.current.detail = value;
        ctx.current.pending = "";
        askAmount();
    }
  };

  const destinationLabel = () => {
    const { asset, method, detail, coin } = ctx.current;
    if (asset === "USDT") return `USDT · ${method}`;
    if (asset === "WELTRADE") return `Weltrade · ID ${detail}`;
    if (asset === "DERIV") return `Deriv · ${detail}`;
    return `${coin} wallet`;
  };

  // Details the client needs in order to send us their funds (withdrawals).
  const sendCard = (amount: number, reference: string): Msg => {
    const { asset, method, coin } = ctx.current;
    const base = { id: newId(), role: "bot" as const, kind: "send" as const, amount, reference };

    if (asset === "USDT") {
      if (EXCHANGE_IDS[method]) {
        return {
          ...base,
          title: `Send USDT via ${method}`,
          rows: [{ label: `Our ${method}`, value: EXCHANGE_IDS[method], copy: true }],
        };
      }
      const account = OUR_ACCOUNTS[method];
      return {
        ...base,
        title: `Send USDT · ${method}`,
        rows: [
          { label: "Network", value: method },
          { label: "Address", value: account.address, copy: true },
        ],
        qr: account.qr,
      };
    }

    if (asset === "WELTRADE" || asset === "DERIV") {
      const name = asset === "WELTRADE" ? "Weltrade" : "Deriv";
      return {
        ...base,
        title: `Deposit via ${name}`,
        rows: [{ label: "Search for", value: AGENT_NAME, copy: true }],
        steps: [
          `Log in to your ${name} account`,
          asset === "DERIV" ? "Go to Cashier → Deposit → Payment agents" : "Open the Deposit section",
          `Search for “${AGENT_NAME}”`,
          `Enter ${money(amount)} and confirm the deposit`,
          "Take a screenshot of the confirmation",
        ],
      };
    }

    return {
      ...base,
      title: `Send ${coin}`,
      rows: [{ label: "Coin", value: coin }],
      note: `Our team will share the ${coin} deposit address here shortly. Send only after you receive it.`,
    };
  };

  const chooseAmount = (amount: number) => {
    if (typing) return;
    push(me(plain(amount)));
    const reference = makeReference();
    ctx.current.amount = amount;
    ctx.current.reference = reference;

    if (ctx.current.flow === "deposit") {
      const destination = destinationLabel();
      ctx.current.destination = destination;
      setStage("pay");
      setStep(3);
      respond([
        bot(`Pay via EcoCash. Send ${money(amount)} using the details below, then tap “I've paid”.`),
        { id: newId(), role: "bot", kind: "pay", amount, destination, reference },
      ]);
      return;
    }

    setStage("send");
    setStep(3);
    respond([
      bot(`Got it — withdrawing ${money(amount)}. Follow the details below, then tap “I've sent it”.`),
      sendCard(amount, reference),
    ]);
  };

  const submitCustom = (raw: string) => {
    if (typing) return;
    const value = raw.trim();
    if (!value) return;
    setCustom("");
    const amount = parseFloat(value.replace(/[^0-9.]/g, ""));
    const max = ctx.current.flow === "deposit" ? MAX_DEPOSIT : Infinity;
    if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > max) {
      push(me(value));
      respond([
        bot(ctx.current.flow === "deposit" ? "Please enter an amount between $5 and $2,000." : "Please enter an amount of $5 or more."),
      ]);
      return;
    }
    chooseAmount(amount);
  };

  const paid = () => {
    if (typing || stage !== "pay") return;
    push(me("I've paid"));
    setStage("proof");
    setStep(4);
    respond([bot("Thanks! Please upload a screenshot of your EcoCash confirmation so we can verify it.")]);
  };

  const sent = () => {
    if (typing || stage !== "send") return;
    push(me("I've sent it"));
    setStage("proof");
    setStep(4);
    respond([bot("Thanks! Please upload a screenshot of your payment confirmation so we can verify it.")]);
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || stage !== "proof") return;
    const name = file.name.length > 22 ? `${file.name.slice(0, 19)}…` : file.name;
    push({ id: newId(), role: "user", kind: "upload", name, time: now() });
    setStage("processing");

    const { amount, reference, destination, flow: current } = ctx.current;

    // Withdrawals: proof is the client's transfer to us, then we ask where to pay out.
    if (current === "withdraw") {
      respond(
        [
          bot("Proof received — thank you."),
          bot(`Where should we send your ${money(amount)} payout? Use your registered EcoCash number ${REGISTERED_NUMBER}?`),
        ],
        () => {
          setStage("number");
          setStep(4);
        },
        800,
      );
      return;
    }

    respond(
      [
        bot("Reading your proof…"),
        {
          id: newId(),
          role: "bot",
          kind: "read",
          amount,
          reference: `MP${randomFrom("0123456789", 11)}`,
          sender: REGISTERED_NUMBER,
          confidence: 96,
        },
        {
          id: newId(),
          role: "bot",
          kind: "checks",
          items: [
            `Amount matches request (${money(amount)})`,
            "Reference not used before",
            "Within limits ($5 – $2,000)",
            "Sender is the registered number",
          ],
        },
        { id: newId(), role: "system", kind: "pill", tone: "ok", label: "Approved", sub: "system" },
        bot(`${money(amount)} is on its way to ${destination}. Your ref is ${reference} — this chat is your receipt.`),
      ],
      () => {
        setStage("ended");
        setStep(5);
      },
      900,
    );
  };

  const confirmNumber = (raw: string) => {
    const value = raw.trim();
    if (!value || typing) return;
    setNumberInput("");
    push(me(value));
    setStage("processing");
    setStep(4);

    const { amount, reference } = ctx.current;
    const wait: Msg = { id: newId(), role: "system", kind: "pill", tone: "wait", label: "We're checking, please wait" };

    const result: Msg[] =
      amount >= LARGE_PAYOUT
        ? [bot("Large payouts get a human check — our team will confirm shortly.")]
        : [
            { id: newId(), role: "system", kind: "pill", tone: "ok", label: "Approved", sub: "system" },
            bot(`${money(amount)} is on its way to EcoCash ${value}. Your ref is ${reference} — this chat is your receipt.`),
          ];

    respond(
      [wait, ...result],
      () => {
        setStage("ended");
        setStep(5);
      },
      900,
    );
  };

  const submit = () => {
    const value = input.trim();
    if (!value || typing) return;
    setInput("");
    if (stage === "amount") return submitCustom(value);
    if (stage === "number") return confirmNumber(value);
    if (stage === "detail") return submitDetail(value);
    push(me(value));
    respond([bot("Thanks — please pick one of the options above, or a Coinspace specialist will follow up here.")]);
  };

  const accountHelp = () => {
    if (typing) return;
    push(me("Account help"));
    setStage("ended");
    respond([bot("A Coinspace specialist will continue with you here.")]);
  };

  const tag =
    flow === "deposit"
      ? { label: "DEPOSIT", className: "bg-emerald-500/20 text-emerald-400" }
      : flow === "withdraw"
        ? { label: "WITHDRAW", className: "bg-[#f0b90b]/20 text-[#f0b90b]" }
        : { label: "SUPPORT", className: "bg-white/10 text-white/70" };

  const renderMessage = (m: Msg) => {
    switch (m.kind) {
      case "text": {
        const mine = m.role === "user";
        return (
          <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[84%] rounded-2xl px-4 py-2.5 text-[15px] leading-6 ${mine ? "bg-[#0a0c0c] text-white" : "bg-[#fffffc] text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"}`}>
              <span className={mine ? "font-semibold" : ""}>{m.text}</span>
              <div className={`mt-0.5 font-mono text-[11px] ${mine ? "text-white/50" : "text-neutral-400"}`}>{m.time}</div>
            </div>
          </div>
        );
      }
      case "upload":
        return (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[88%] rounded-2xl bg-[#0a0c0c] px-4 py-2.5 text-[15px] text-white">
              <div className="flex items-center gap-2">
                <ImageIcon className="size-4 shrink-0" />
                <span className="truncate font-semibold">{m.name}</span>
                <span className="shrink-0 text-xs font-semibold">✓ Uploaded</span>
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-white/50">{m.time}</div>
            </div>
          </div>
        );
      case "pay":
        return (
          <div key={m.id} className="rounded-2xl bg-[#0a0c0c] p-4 text-white">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold">
                <span className="grid size-6 place-items-center rounded-full border border-[#f0b90b] text-[#f0b90b]">
                  <Zap className="size-3" />
                </span>
                Pay via EcoCash
              </div>
              <span className="text-sm font-bold text-[#f0b90b]">{money(m.amount)}</span>
            </div>
            <CardRow label="Merchant">{MERCHANT.name}</CardRow>
            <CardRow label="Merchant code">{MERCHANT.code}</CardRow>
            <CardRow label="Number">
              {MERCHANT.number}
              <CopyButton value={MERCHANT.number} label="number" />
            </CardRow>
            <CardRow label="Reference">
              <span className="text-[#f0b90b]">{m.reference}</span>
              <CopyButton value={m.reference} label="reference" />
            </CardRow>
            <CardRow label="Funds delivered to">
              <span className="break-all text-right">{m.destination}</span>
            </CardRow>
            <button
              type="button"
              onClick={paid}
              disabled={stage !== "pay" || typing}
              className="mt-3 w-full rounded-xl bg-[#f0b90b] py-3 text-sm font-bold text-black transition-opacity hover:brightness-95 disabled:opacity-50"
            >
              I've paid
            </button>
          </div>
        );
      case "send":
        return (
          <div key={m.id} className="rounded-2xl bg-[#0a0c0c] p-4 text-white">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-sm font-bold">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-[#f0b90b] text-[#f0b90b]">
                  <Zap className="size-3" />
                </span>
                <span className="truncate">{m.title}</span>
              </div>
              <span className="shrink-0 text-sm font-bold text-[#f0b90b]">{money(m.amount)}</span>
            </div>
            {m.rows.map((row) => (
              <CardRow key={row.label} label={row.label}>
                <span className="break-all text-right">{row.value}</span>
                {row.copy && <CopyButton value={row.value} label={row.label} />}
              </CardRow>
            ))}
            <CardRow label="Reference">
              <span className="text-[#f0b90b]">{m.reference}</span>
              <CopyButton value={m.reference} label="reference" />
            </CardRow>
            {m.qr && (
              <img
                src={m.qr}
                alt="Payment QR code"
                className="mx-auto mt-2 size-40 rounded-lg bg-white p-2"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            {m.steps && (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-white/80">
                {m.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            )}
            {m.note && <p className="mt-2 text-[13px] text-white/70">{m.note}</p>}
            <button
              type="button"
              onClick={sent}
              disabled={stage !== "send" || typing}
              className="mt-3 w-full rounded-xl bg-[#f0b90b] py-3 text-sm font-bold text-black transition-opacity hover:brightness-95 disabled:opacity-50"
            >
              I've sent it
            </button>
          </div>
        );
      case "read":
        return (
          <div key={m.id} className="max-w-[84%] rounded-2xl bg-[#fffffc] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <h3 className="mb-2 text-[15px] font-bold">What the AI read</h3>
            <div className="space-y-1 text-[13px]">
              <div className="flex justify-between gap-4"><span>Amount</span><span className="font-bold">{money(m.amount)}</span></div>
              <div className="flex justify-between gap-4"><span>Reference</span><span className="font-mono">{m.reference}</span></div>
              <div className="flex justify-between gap-4"><span>Sender</span><span className="font-mono">{m.sender}</span></div>
            </div>
            <div className="mt-3 font-mono text-[11px] uppercase tracking-wide">Read confidence {m.confidence}%</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full bg-[#f0b90b]" style={{ width: `${m.confidence}%` }} />
            </div>
          </div>
        );
      case "checks":
        return (
          <div key={m.id} className="max-w-[84%] rounded-2xl bg-[#fffffc] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
            <h3 className="mb-2 text-[15px] font-bold">Rule checks</h3>
            <ul className="space-y-1 text-[14px]">
              {m.items.map((item) => (
                <li key={item}><span className="mr-1.5 text-emerald-600">✓</span>{item}</li>
              ))}
            </ul>
          </div>
        );
      case "pill":
        return (
          <div key={m.id} className="flex justify-center">
            <span className={`rounded-full px-4 py-1.5 text-sm font-bold ${m.tone === "ok" ? "bg-emerald-100 text-emerald-600" : "bg-[#f7edc3] text-[#a8780a]"}`}>
              {m.tone === "wait" && <span className="mr-1.5">•••</span>}
              {m.label}
              {m.sub && <span className="ml-1 text-xs font-medium"> · {m.sub}</span>}
            </span>
          </div>
        );
    }
  };

  const showTray = !typing && stage !== "processing";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onMouseDown={onClose}>
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-[500px] animate-slide-in flex-col overflow-hidden bg-[#f4f4f1] shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
        aria-label="Coinspace chatbot"
      >
        <header className="bg-[#080a0a] px-5 pb-3 pt-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#f0b90b] text-lg font-black text-black">C</span>
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-bold leading-tight">Coinspace Assistant</h2>
                <p className="flex items-center gap-1.5 text-xs text-white/60">
                  <span className="size-1.5 rounded-full bg-white/50" />
                  Online · replies instantly
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close chat" className="grid size-9 place-items-center rounded-md text-white hover:bg-white/10">
              <X className="size-6" />
            </button>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider ${tag.className}`}>{tag.label}</span>
            {flow && (
              <div className="flex gap-1" aria-label={`Step ${step} of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={`h-[3px] w-5 rounded-full transition-colors ${n <= step ? "bg-[#f0b90b]" : "bg-white/20"}`} />
                ))}
              </div>
            )}
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map(renderMessage)}
          {typing && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-2xl bg-[#fffffc] px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-1.5 animate-pulse rounded-full bg-neutral-500" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {showTray && (
          <div className="space-y-2 px-4 pb-2 pt-2">
            {stage === "menu" && (
              <div className="flex flex-wrap gap-2">
                <button className={chip} onClick={() => begin("deposit")}>Deposit</button>
                <button className={chip} onClick={() => begin("withdraw")}>Withdraw</button>
                <button className={chip} onClick={accountHelp}>Account help</button>
              </div>
            )}

            {stage === "asset" && (
              <div className="flex flex-wrap gap-2">
                {ASSETS.map((a) => (
                  <button key={a.id} className={chip} onClick={() => pickAsset(a.id, a.label)}>{a.label}</button>
                ))}
              </div>
            )}

            {(stage === "network" || stage === "method") && (
              <div className="flex flex-wrap gap-2">
                {(stage === "network" ? NETWORKS : WITHDRAW_METHODS).map((m) => (
                  <button key={m} className={chip} onClick={() => pickMethod(m)}>{m}</button>
                ))}
              </div>
            )}

            {stage === "detail" && (
              <>
                {pendingKind === "coin" && (
                  <div className="flex flex-wrap gap-2">
                    {QUICK_COINS.map((c) => (
                      <button key={c} className={chip} onClick={() => submitDetail(c)}>{c}</button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={detailInput}
                    onChange={(e) => setDetailInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitDetail(detailInput)}
                    placeholder={pendingKind ? DETAIL_PROMPTS[pendingKind] : ""}
                    className={textField}
                  />
                  <button className="rounded-full bg-black px-5 text-sm font-bold text-white hover:bg-neutral-800" onClick={() => submitDetail(detailInput)}>
                    Continue
                  </button>
                </div>
              </>
            )}

            {stage === "amount" && (
              <>
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((a) => (
                    <button key={a} className={chip} onClick={() => chooseAmount(a)}>${a}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitCustom(custom)}
                    inputMode="decimal"
                    placeholder="$ Custom amount"
                    className={textField}
                  />
                  <button className="rounded-full bg-black px-5 text-sm font-bold text-white hover:bg-neutral-800" onClick={() => submitCustom(custom)}>
                    Continue
                  </button>
                </div>
              </>
            )}

            {stage === "pay" && (
              <div className="rounded-lg bg-[#faf3cf] px-3 py-2 text-[13px] text-[#8a6d1a]">
                Pay from your EcoCash app, then tap “I've paid” above.
              </div>
            )}

            {stage === "send" && (
              <div className="rounded-lg bg-[#faf3cf] px-3 py-2 text-[13px] text-[#8a6d1a]">
                Complete the transfer, then tap “I've sent it” above.
              </div>
            )}

            {stage === "proof" && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-[#d8b840] bg-[#faf3cf] px-3 py-2.5 text-[13px] font-semibold text-[#8a6d1a] hover:brightness-95"
              >
                Tap to upload your payment screenshot
              </button>
            )}

            {stage === "number" && (
              <>
                <button
                  className="w-full rounded-full border border-[#eadba0] bg-[#faf0c3] py-2 text-sm font-bold text-[#7a5b00] hover:brightness-95"
                  onClick={() => confirmNumber(REGISTERED_NUMBER)}
                >
                  Use my number · {REGISTERED_NUMBER}
                </button>
                <div className="flex gap-2">
                  <input
                    value={numberInput}
                    onChange={(e) => setNumberInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirmNumber(numberInput)}
                    inputMode="tel"
                    placeholder={REGISTERED_NUMBER}
                    className={textField}
                  />
                  <button className="rounded-full bg-black px-5 text-sm font-bold text-white hover:bg-neutral-800" onClick={() => confirmNumber(numberInput)}>
                    Confirm
                  </button>
                </div>
              </>
            )}

            {stage === "ended" && (
              <div className="flex flex-wrap items-center gap-2">
                <button className="rounded-full bg-[#f0b90b] px-4 py-2 text-sm font-bold text-black hover:brightness-95" onClick={() => begin("deposit")}>+ New deposit</button>
                <button className="rounded-full border border-black bg-white px-4 py-2 text-sm font-bold text-black hover:bg-black hover:text-white" onClick={() => begin("withdraw")}>New withdrawal</button>
                <button className="px-3 py-2 text-sm font-bold text-black hover:underline" onClick={onClose}>Close chat</button>
              </div>
            )}
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

        <div className="flex items-center gap-2 px-4 pb-4 pt-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Type a message..."
            className={textField}
          />
          <button type="button" onClick={submit} aria-label="Send message" className="grid size-12 shrink-0 place-items-center rounded-full bg-black text-white hover:bg-neutral-800">
            <Send className="size-5" />
          </button>
        </div>
      </aside>
    </div>
  );
}