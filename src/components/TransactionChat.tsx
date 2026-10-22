import { Check, Copy, Image as ImageIcon, Send, X, Zap } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { chatWithAI, prepareImage, readProof, type ProofRead } from "@/lib/ai-client";

export type ChatMode = "deposit" | "withdraw" | "support";

type Flow = "deposit" | "withdraw";
type Asset = "USDT" | "WELTRADE" | "DERIV";
type PaymentGateway = "Ecocash" | "InnBucks" | "FNB BUSINESS ACCOUNT";
type Pending = "address" | "weltradeId" | "derivNick" | "";
type Stage =
  | "menu"
  | "asset"
  | "gateway"
  | "detail"
  | "amount"
  | "pay"
  | "send"
  | "proof"
  | "processing"
  | "payoutDetails"
  | "ended";

type CardRowData = { label: string; value: string; copy?: boolean };

type Msg =
  | { id: number; role: "bot" | "user"; kind: "text"; text: string; time: string }
  | { id: number; role: "bot"; kind: "pay"; amount: number; gateway: PaymentGateway; destination: string }
  | {
      id: number;
      role: "bot";
      kind: "send";
      title: string;
      netAmount: number;
      fee: number;
      grossAmount: number;
      rows: CardRowData[];
      qr?: string;
      steps?: string[];
      note?: string;
    }
  | { id: number; role: "user"; kind: "upload"; name: string; time: string }
  | { id: number; role: "bot"; kind: "read"; amount: number | null; reference: string; sender: string; confidence: number }
  | { id: number; role: "bot"; kind: "checks"; items: { ok: boolean; text: string }[] }
  | { id: number; role: "system"; kind: "pill"; tone: "ok" | "wait"; label: string; sub?: string };

type Ctx = {
  flow: Flow | null;
  asset: Asset | "";
  gateway: PaymentGateway | "";
  detail: string;
  pending: Pending;
  destination: string;
  amount: number;
  fee: number;
  netAmount: number;
  payoutName: string;
  payoutNumber: string;
};

const emptyCtx = (flow: Flow | null = null): Ctx => ({
  flow,
  asset: "",
  gateway: "",
  detail: "",
  pending: "",
  destination: "",
  amount: 0,
  fee: 0,
  netAmount: 0,
  payoutName: "",
  payoutNumber: "",
});

const ASSETS: { id: Asset; label: string }[] = [
  { id: "USDT", label: "USDT (TRC20)" },
  { id: "WELTRADE", label: "Weltrade" },
  { id: "DERIV", label: "Deriv" },
];

const PAYMENT_GATEWAYS: { id: PaymentGateway; label: string }[] = [
  { id: "Ecocash", label: "EcoCash" },
  { id: "InnBucks", label: "InnBucks" },
  { id: "FNB BUSINESS ACCOUNT", label: "FNB Business Account" },
];

const QUICK_AMOUNTS = [10, 50, 100, 500, 1000];
const MIN_AMOUNT = 5;
const MAX_DEPOSIT = 2000;
const LARGE_PAYOUT = 200;

const GATEWAY_DETAILS: Record<PaymentGateway, { name?: string; number?: string; bank?: string; accNumber?: string }> = {
  Ecocash: { name: "Marc Anthony Zhou", number: "+263 78 429 3089" },
  InnBucks: { name: "Marc Anthony Zhou", number: "+263 78 429 3089" },
  "FNB BUSINESS ACCOUNT": { bank: "FNB BUSINESS ACCOUNT", accNumber: "63051409861" },
};

const AUTO_APPROVE = false;
const USDT_TRC20_ACCOUNT = { address: "TPvTAj6W8AZQzsnu27TsPjUMR7tNJ9CHgP", qr: "/qr/usdt-trc20.png" };
const AGENT_NAME = "Coinspace";

const DETAIL_PROMPTS: Record<Exclude<Pending, "">, string> = {
  address: "Wallet address",
  weltradeId: "Weltrade user ID",
  derivNick: "Deriv nickname",
};

let nextId = 0;
const newId = () => ++nextId;
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
const money = (n: number) => `$${n.toFixed(2)}`;
const plain = (n: number) => `$${+n.toFixed(2)}`;

const bot = (text: string): Msg => ({ id: newId(), role: "bot", kind: "text", text, time: now() });
const me = (text: string): Msg => ({ id: newId(), role: "user", kind: "text", text, time: now() });

const chip = "rounded-full border border-black bg-white px-4 py-1.5 text-sm font-bold text-black transition-colors hover:bg-black hover:text-white";
const textField = "h-12 min-w-0 flex-1 rounded-full bg-[#e9e9e5] px-5 text-sm outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-black/10";

function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <span className="whitespace-pre-line">
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </span>
  );
}

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
  const [detailInput, setDetailInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [numberInput, setNumberInput] = useState("");
  const [pendingKind, setPendingKind] = useState<Pending>("");

  const ctx = useRef<Ctx>(emptyCtx());
  const timers = useRef<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiHistory = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const push = (...items: Msg[]) => setMessages((current) => [...current, ...items]);

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
    setStage("gateway");
    respond([
      bot(
        next === "deposit"
          ? "Please select your preferred payment gateway for your deposit:"
          : "Please select your preferred payment gateway for your withdrawal:"
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
    setDetailInput("");
    setNameInput("");
    setNumberInput("");
    setPendingKind("");
    ctx.current = emptyCtx();
    aiHistory.current = [];
    if (mode === "support") {
      respond([bot("Hi! I am the Coinspace assistant. How can I help you today?")]);
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

  const pickGateway = (gateway: PaymentGateway, label: string) => {
    if (typing) return;
    push(me(label));
    ctx.current.gateway = gateway;
    setStage("asset");
    respond([
      bot("Please choose your asset:\n\nNote: For USDT, transactions are strictly on the **TRC20 network**."),
    ]);
  };

  const askAmount = () => {
    setStage("amount");
    setStep(2);
    
    if (ctx.current.flow === "deposit") {
      respond([
        bot("How much would you like to deposit? (Min: $5, Max: $2,000)")
      ]);
    } else {
      respond([
        bot("How much would you like to withdraw? (Min: $5)\n\nNote: Withdrawals of $1,000 or more will have a **5% fee** automatically subtracted from the requested amount.")
      ]);
    }
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
      ctx.current.destination = "USDT · TRC20";
      if (deposit) {
        askDetail("address", "Please paste your USDT TRC20 wallet address.");
      } else {
        askAmount();
      }
      return;
    }
    if (asset === "WELTRADE") {
      if (deposit) askDetail("weltradeId", "Please enter your Weltrade user ID.");
      else askAmount();
      return;
    }
    if (asset === "DERIV") {
      if (deposit) askDetail("derivNick", "What is your Deriv nickname?");
      else askAmount();
      return;
    }
  };

  const submitDetail = (raw: string) => {
    if (typing) return;
    const value = raw.trim();
    if (!value) return;
    setDetailInput("");
    push(me(value));
    ctx.current.detail = value;
    ctx.current.pending = "";
    askAmount();
  };

  const destinationLabel = () => {
    const { asset, detail } = ctx.current;
    if (asset === "USDT") return "USDT · TRC20";
    if (asset === "WELTRADE") return `Weltrade · ID ${detail}`;
    if (asset === "DERIV") return `Deriv · ${detail}`;
    return "USDT wallet";
  };

  const sendCard = (amount: number, fee: number, netAmount: number): Msg => {
    const { asset } = ctx.current;
    const base = { id: newId(), role: "bot" as const, kind: "send" as const, title: "", netAmount, fee, grossAmount: amount };

    if (asset === "USDT") {
      return {
        ...base,
        title: "Send USDT (TRC20 Network Only)",
        rows: [
          { label: "Network", value: "TRC20" },
          { label: "Address", value: USDT_TRC20_ACCOUNT.address, copy: true },
        ],
        qr: USDT_TRC20_ACCOUNT.qr,
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
      title: "Send USDT",
      rows: [{ label: "Network", value: "TRC20" }],
      note: "Our team will share the deposit address here shortly.",
    };
  };

  const chooseAmount = (amount: number) => {
    if (typing) return;
    push(me(plain(amount)));
    ctx.current.amount = amount;

    const isWithdraw = ctx.current.flow === "withdraw";
    const fee = isWithdraw && amount >= 1000 ? amount * 0.05 : 0;
    const netAmount = amount - fee;

    ctx.current.fee = fee;
    ctx.current.netAmount = netAmount;

    if (ctx.current.flow === "deposit") {
      const destination = destinationLabel();
      ctx.current.destination = destination;
      setStage("pay");
      setStep(3);
      respond([
        bot(`Please send **${money(amount)}** using your selected gateway (${ctx.current.gateway}).`),
        { id: newId(), role: "bot", kind: "pay", amount, gateway: ctx.current.gateway as PaymentGateway, destination },
      ]);
      return;
    }

    setStage("send");
    setStep(3);
    respond([
      bot(
        isWithdraw && fee > 0
          ? `Withdrawing **${money(amount)}**. A 5% fee (${money(fee)}) has been subtracted. You will receive a net total of **${money(netAmount)}**.`
          : `Withdrawing **${money(amount)}**.`
      ),
      sendCard(amount, fee, netAmount),
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
    respond([bot("Thanks! Please upload a screenshot of your payment confirmation so we can verify it.")]);
  };

  const sent = () => {
    if (typing || stage !== "send") return;
    push(me("I've sent it"));
    setStage("proof");
    setStep(4);
    respond([bot("Thanks! Please upload a screenshot of your payment confirmation so we can verify it.")]);
  };

  const askAI = async (text: string) => {
    push(me(text));
    aiHistory.current = [...aiHistory.current, { role: "user" as const, content: text }].slice(-12);
    setTyping(true);
    try {
      const c = ctx.current;
      const context = [
        `Chat type: ${c.flow ?? "support"}`,
        `Current step: ${stage}`,
        c.asset ? `Asset chosen: ${c.asset}` : "",
        c.amount ? `Amount: ${money(c.amount)}` : "",
      ]
        .filter(Boolean)
        .join(". ");
      const reply = await chatWithAI(aiHistory.current, context, "transaction");
      aiHistory.current = [...aiHistory.current, { role: "assistant" as const, content: reply }];
      push(bot(reply));
    } catch {
      push(bot("Sorry, I couldn't answer that just now. Please try again in a moment."));
    } finally {
      setTyping(false);
    }
  };

  const runChecks = (read: ProofRead) => {
    const { amount, flow: current } = ctx.current;
    const items: { ok: boolean; text: string }[] = [];

    const amountOk = read.amount !== null && Math.abs(read.amount - amount) < 0.01;
    items.push({
      ok: amountOk,
      text: amountOk
        ? `Amount matches request (${money(amount)})`
        : `Amount doesn't match (receipt: ${read.amount === null ? "not found" : money(read.amount)}, expected ${money(amount)})`,
    });

    if (read.currency && !/^(usd|us\$|\$)$/i.test(read.currency.trim())) {
      items.push({ ok: false, text: `Receipt currency is ${read.currency}, expected USD` });
    }

    const statusOk = read.status === "success";
    items.push({ ok: statusOk, text: statusOk ? "Payment shows as successful" : "Payment doesn't show as successful" });
    items.push({ ok: amount >= MIN_AMOUNT && (current === "withdraw" || amount <= MAX_DEPOSIT), text: "Within limits" });
    return items;
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || stage !== "proof") return;
    const name = file.name.length > 22 ? `${file.name.slice(0, 19)}…` : file.name;
    push({ id: newId(), role: "user", kind: "upload", name, time: now() });
    setStage("processing");
    setTyping(true);

    const { amount, netAmount, destination, flow: current } = ctx.current;

    let read: ProofRead;
    try {
      const image = await prepareImage(file);
      read = await readProof({ mediaType: image.mediaType, data: image.data });
    } catch {
      setTyping(false);
      respond([bot("I couldn't read that screenshot just now. Please try uploading it again.")], () => setStage("proof"));
      return;
    }
    setTyping(false);

    if (!read.isReceipt) {
      respond(
        [bot("That doesn't look like a payment confirmation. Please upload a clear screenshot of the receipt.")],
        () => setStage("proof"),
      );
      return;
    }

    const items = runChecks(read);
    const readCard: Msg = {
      id: newId(),
      role: "bot",
      kind: "read",
      amount: read.amount,
      reference: read.reference || "—",
      sender: read.sender || "—",
      confidence: Math.round(read.confidence),
    };
    const checksCard: Msg = { id: newId(), role: "bot", kind: "checks", items };

    if (!items.every((i) => i.ok)) {
      respond(
        [
          readCard,
          checksCard,
          { id: newId(), role: "system", kind: "pill", tone: "wait", label: "Needs review" },
          bot("Some checks didn't pass. You can upload a clearer screenshot, or wait and our team will review it."),
        ],
        () => setStage("proof"),
        900,
      );
      return;
    }

    if (current === "withdraw") {
      respond(
        [
          readCard,
          checksCard,
          bot("Proof received — thank you."),
          bot(`Please enter the account name and number linked to your ${ctx.current.gateway} account to receive your payout (**${money(netAmount)}**).`),
        ],
        () => {
          setStage("payoutDetails");
          setStep(4);
        },
        800,
      );
      return;
    }

    const outcome: Msg[] = AUTO_APPROVE
      ? [
          { id: newId(), role: "system", kind: "pill", tone: "ok", label: "Approved", sub: "system" },
          bot(`${money(amount)} is on its way to ${destination}. This chat is your receipt.`),
        ]
      : [
          { id: newId(), role: "system", kind: "pill", tone: "ok", label: "Checks passed", sub: "awaiting team confirmation" },
          bot(`Your proof passed our automated checks. Our team will confirm it and release ${money(amount)} to ${destination}.`),
        ];

    respond(
      [readCard, checksCard, ...outcome],
      () => {
        setStage("ended");
        setStep(5);
      },
      900,
    );
  };

  const submitPayoutDetails = () => {
    const name = nameInput.trim();
    const number = numberInput.trim();
    if (!name || !number || typing) return;

    setNameInput("");
    setNumberInput("");
    push(me(`Name: ${name}, Number: ${number}`));
    setStage("processing");
    setStep(4);

    ctx.current.payoutName = name;
    ctx.current.payoutNumber = number;

    const { netAmount } = ctx.current;
    const wait: Msg = { id: newId(), role: "system", kind: "pill", tone: "wait", label: "We're checking, please wait" };

    const result: Msg[] =
      netAmount >= LARGE_PAYOUT
        ? [bot("Large payouts get a human check — our team will confirm shortly.")]
        : AUTO_APPROVE
          ? [
              { id: newId(), role: "system", kind: "pill", tone: "ok", label: "Approved", sub: "system" },
              bot(`${money(netAmount)} is on its way to ${ctx.current.gateway} (${name} - ${number}). This chat is your receipt.`),
            ]
          : [
              { id: newId(), role: "system", kind: "pill", tone: "ok", label: "Checks passed", sub: "awaiting team confirmation" },
              bot(`Our team will confirm and send ${money(netAmount)} to your ${ctx.current.gateway} account (${name} - ${number}).`),
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
    if (value.includes("?")) return askAI(value);
    if (stage === "amount") return /\d/.test(value) ? submitCustom(value) : askAI(value);
    if (stage === "detail") return submitDetail(value);
    askAI(value);
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
              <FormattedText text={m.text} />
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
      case "pay": {
        const info = GATEWAY_DETAILS[m.gateway];
        return (
          <div key={m.id} className="rounded-2xl bg-[#0a0c0c] p-4 text-white">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold">
                <span className="grid size-6 place-items-center rounded-full border border-[#f0b90b] text-[#f0b90b]">
                  <Zap className="size-3" />
                </span>
                Pay via {m.gateway}
              </div>
              <span className="text-sm font-bold text-[#f0b90b]">{money(m.amount)}</span>
            </div>
            {info.name && <CardRow label="Account Name">{info.name}</CardRow>}
            {info.number && (
              <CardRow label="Number">
                {info.number}
                <CopyButton value={info.number} label="number" />
              </CardRow>
            )}
            {info.bank && <CardRow label="Bank">{info.bank}</CardRow>}
            {info.accNumber && (
              <CardRow label="Account Number">
                {info.accNumber}
                <CopyButton value={info.accNumber} label="account number" />
              </CardRow>
            )}
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
      }
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
              <span className="shrink-0 text-sm font-bold text-[#f0b90b]">{money(m.grossAmount)}</span>
            </div>
            {m.rows.map((row) => (
              <CardRow key={row.label} label={row.label}>
                <span className="break-all text-right">{row.value}</span>
                {row.copy && <CopyButton value={row.value} label={row.label} />}
              </CardRow>
            ))}
            {m.fee > 0 && (
              <>
                <CardRow label="5% Withdrawal Fee">{money(m.fee)}</CardRow>
                <CardRow label="Net Payout Amount">
                  <span className="text-[#f0b90b]">{money(m.netAmount)}</span>
                </CardRow>
              </>
            )}
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
              <div className="flex justify-between gap-4"><span>Amount</span><span className="font-bold">{m.amount === null ? "—" : money(m.amount)}</span></div>
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
                <li key={item.text}><span className={`mr-1.5 ${item.ok ? "text-emerald-600" : "text-red-600"}`}>{item.ok ? "✓" : "✗"}</span>{item.text}</li>
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
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f0b90b]"><img src="/bull.svg" alt="" className="size-7" /></span>
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

        {/* Permanent Top Disclaimer Banner */}
        <div className="bg-[#fff3cd] border-b border-[#ffeba1] px-4 py-2.5 text-xs font-semibold text-[#856404]">
          Please ensure all submitted details are accurate. The company is not liable for incorrect inputs.
        </div>

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

            {stage === "gateway" && (
              <div className="flex flex-wrap gap-2">
                {PAYMENT_GATEWAYS.map((g) => (
                  <button key={g.id} className={chip} onClick={() => pickGateway(g.id, g.label)}>{g.label}</button>
                ))}
              </div>
            )}

            {stage === "asset" && (
              <div className="flex flex-wrap gap-2">
                {ASSETS.map((a) => (
                  <button key={a.id} className={chip} onClick={() => pickAsset(a.id, a.label)}>{a.label}</button>
                ))}
              </div>
            )}

            {stage === "detail" && (
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
                Pay from your {ctx.current.gateway} app, then tap “I've paid” above.
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

            {stage === "payoutDetails" && (
              <div className="space-y-2">
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Account Name (e.g. John Doe)"
                  className={textField}
                  style={{ width: "100%" }}
                />
                <div className="flex gap-2">
                  <input
                    value={numberInput}
                    onChange={(e) => setNumberInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitPayoutDetails()}
                    inputMode="tel"
                    placeholder="Account / Phone Number"
                    className={textField}
                  />
                  <button className="rounded-full bg-black px-5 text-sm font-bold text-white hover:bg-neutral-800" onClick={submitPayoutDetails}>
                    Submit
                  </button>
                </div>
              </div>
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