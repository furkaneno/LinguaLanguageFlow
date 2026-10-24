"use client";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Tone = "success" | "error";
interface Item { id: number; text: string; tone: Tone }
const Ctx = createContext<(text: string, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const push = useCallback((text: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, tone }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((i) => (
          <div key={i.id} className={`pointer-events-auto flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm shadow-md ${i.tone === "success" ? "bg-success" : "bg-danger"}`}>
            {i.tone === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald" aria-hidden /> : <AlertCircle className="h-4 w-4 text-[#FF8A80]" aria-hidden />}
            <span><span className="sr-only">{i.tone === "success" ? "Success: " : "Error: "}</span>{i.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
