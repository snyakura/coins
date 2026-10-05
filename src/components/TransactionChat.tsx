import { ArrowUp, Check, ChevronRight, Paperclip, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type ChatMode = "deposit" | "withdraw" | "support";
type Message = { id: number; role: "bot" | "user"; text: string };

const choices: Record<ChatMode, string[]> = {
  deposit: ["USDT", "Worldtrade", "Deriv", "Other crypto"],
  withdraw: ["USDT", "Binance ID", "OKX ID", "Worldtrade", "Deriv"],
  support: ["Deposit", "Withdraw", "Account help"],
};

export function TransactionChat({ mode, onClose }: { mode: ChatMode | null; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!mode) return;
    const intro = mode === "support" ? "Hi! I’m the Coinspace assistant. How can I help you today?" : `Hello! How would you like to ${mode}?`;
    setMessages([{ id: 1, role: "bot", text: intro }]);
    setOptions(choices[mode]);
    window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [mode]);

  if (!mode) return null;

  const choose = (choice: string) => {
    const next: Message[] = [...messages, { id: Date.now(), role: "user", text: choice }];
    let reply = "Thanks. A Coinspace specialist will continue with you here.";
    let nextOptions: string[] = [];
    if (choice === "USDT") {
      reply = `Great! Which USDT network would you like to use for your ${mode === "withdraw" ? "withdrawal" : "deposit"}?`;
      nextOptions = ["TRC20 (Recommended)", "Polygon", "Aptos"];
    } else if (["TRC20 (Recommended)", "Polygon", "Aptos"].includes(choice)) {
      reply = mode === "withdraw"
        ? "Please confirm the destination details. Your withdrawal will remain pending until reviewed."
        : "Nice choice! Please upload a screenshot of your payment as proof of payment (POP).";
    } else if (["Worldtrade", "Deriv", "Binance ID", "OKX ID"].includes(choice)) {
      reply = `Please enter your ${choice} account ID so we can continue securely.`;
    } else if (choice === "Deposit") {
      reply = "Which platform would you like to deposit with?";
      nextOptions = choices.deposit;
    } else if (choice === "Withdraw") {
      reply = "How would you like to withdraw?";
      nextOptions = choices.withdraw;
    }
    setMessages([...next, { id: Date.now() + 1, role: "bot", text: reply }]);
    setOptions(nextOptions);
  };

  const submit = () => {
    const value = input.trim();
    if (!value) return;
    setMessages((current) => [...current, { id: Date.now(), role: "user", text: value }, { id: Date.now() + 1, role: "bot", text: "Received. I’ll guide you through the next step here." }]);
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]" onMouseDown={onClose}>
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[600px] animate-slide-in flex-col bg-chat-surface shadow-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Coinspace chatbot">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center bg-chat px-5 py-4 text-chat-foreground">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-background text-lg font-black text-primary">C</span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">Coinspace Chatbot</h2>
              <p className="text-sm opacity-80">Online</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-chat-foreground hover:bg-chat-foreground/10" onClick={onClose} aria-label="Close chat"><X /></Button>
        </header>
        <div className="chat-pattern flex-1 space-y-3 overflow-y-auto p-4 sm:p-7">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[86%] rounded-chat px-4 py-3 text-[15px] leading-6 shadow-message ${message.role === "user" ? "bg-user-message" : "bg-background"}`}>
                {message.text}
                <span className="ml-2 whitespace-nowrap text-[11px] text-muted-foreground">10:24 {message.role === "user" && <Check className="inline size-3 text-chat" />}</span>
              </div>
            </div>
          ))}
          {options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {options.map((option) => <Button key={option} variant="outline" size="sm" className="border-transparent bg-background text-chat shadow-message" onClick={() => choose(option)}>{option}</Button>)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border bg-background p-3 sm:p-4">
          <Button variant="ghost" size="icon" aria-label="Attach proof of payment"><Paperclip /></Button>
          <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder="Type a message..." className="h-12 min-w-0 flex-1 rounded-full border border-border bg-muted px-5 text-sm outline-none focus:border-chat" />
          <Button variant="chat" size="icon" onClick={submit} aria-label="Send message"><ArrowUp /></Button>
        </div>
      </aside>
    </div>
  );
}