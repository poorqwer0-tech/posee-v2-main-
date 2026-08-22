"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastFn = (message: string) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setMessage(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 2200);
  }, []);

  return (
    <ToastContext.Provider value={flash}>
      {children}
      {message ? (
        <div className="fixed bottom-[26px] left-1/2 z-[70] -translate-x-1/2 animate-pop rounded-[30px] bg-brand-ink px-6 py-3 text-sm text-[color:var(--c-on-primary)] shadow-[0_10px_30px_rgba(var(--c-scrim),.35)]">
          {message}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
