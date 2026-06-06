import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const COLORS = [
  "bg-emerald-700",
  "bg-blue-700",
  "bg-violet-700",
  "bg-orange-700",
  "bg-pink-700",
  "bg-teal-700",
];

function toastColor(name) {
  return COLORS[name.charCodeAt(0) % COLORS.length];
}

function ModToastItem({ toast }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    let r1, r2;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);

  const active = entered && !toast.fading;

  return (
    <div
      className={`overflow-hidden transition-all duration-300 ${active ? "max-h-10 mb-2.5" : "max-h-0 mb-0 delay-300"}`}
    >
      <div
        className={`flex items-center gap-2.5 transition-all duration-300 ${active ? "opacity-100 translate-x-0" : "opacity-0 translate-x-3"}`}
      >
        {toast.icon_url ? (
          <img src={toast.icon_url} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
        ) : (
          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white ${toastColor(toast.name)}`}>
            {toast.name[0].toUpperCase()}
          </div>
        )}
        <span className="text-sm text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
          {toast.name} <span className="text-zinc-500">added</span>
        </span>
      </div>
    </div>
  );
}

export function WaveLoader({ color = "#FBBF24" }) {
  return (
    <svg width="40" height="14" viewBox="0 0 40 14" style={{ overflow: "hidden", display: "block" }}>
      {/* Two full periods so translateX(-40px) loops seamlessly */}
      <path
        d="M0 7 C7 2,13 2,20 7 C27 12,33 12,40 7 C47 2,53 2,60 7 C67 12,73 12,80 7"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        style={{ animation: "wave-scroll 1.2s linear infinite" }}
      />
    </svg>
  );
}

export function useModToasts() {
  const [toasts, setToasts] = useState([]);

  function add(mods) {
    mods.forEach((m, i) => {
      setTimeout(() => {
        const item = {
          id: crypto.randomUUID(),
          name: m.title ?? m.name,
          icon_url: m.icon_url ?? null,
          fading: false,
        };
        setToasts((prev) => [...prev, item]);
        setTimeout(
          () => setToasts((prev) => prev.map((t) => (t.id === item.id ? { ...t, fading: true } : t))),
          2000,
        );
        setTimeout(
          () => setToasts((prev) => prev.filter((t) => t.id !== item.id)),
          2650,
        );
      }, i * 120);
    });
  }

  return { toasts, add };
}

export function ModToastsPortal({ toasts }) {
  if (!toasts.length) return null;
  return createPortal(
    <div className="pointer-events-none fixed bottom-6 right-6 z-[200] flex flex-col items-end">
      {toasts.map((t) => (
        <ModToastItem key={t.id} toast={t} />
      ))}
    </div>,
    document.body,
  );
}
