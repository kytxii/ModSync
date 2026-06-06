import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export default function EulaModal({ open, onClose, onConfirm, loading }) {
  const [linkClicked, setLinkClicked] = useState(false);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (!open) { setInput(""); setLinkClicked(false); }
  }, [open]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && !loading) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, loading, onClose]);

  const ready = linkClicked && input.toLowerCase() === "true" && !loading;

  if (!open) return null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => !loading && onClose()}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className={`w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-[0_0_60px_rgba(0,0,0,0.35)] transition-all duration-200 pointer-events-auto ${open ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          <h2 className="mb-1 text-base font-bold text-white">Minecraft EULA</h2>
          <p className="mb-4 text-sm text-zinc-500">Read the EULA, then type <span className="font-mono text-emerald-400">true</span> to accept.</p>

          <a
            href="https://www.minecraft.net/en-us/eula"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setLinkClicked(true)}
            className={`mb-4 flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors ${
              linkClicked
                ? "border-emerald-800 bg-emerald-950/30 text-emerald-400"
                : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-white"
            }`}
          >
            <span>Minecraft End User License Agreement</span>
            {linkClicked ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            )}
          </a>

          <div className={`mb-5 flex items-center gap-2 rounded-lg border bg-zinc-950 px-4 py-3 font-mono text-sm transition-colors ${linkClicked ? "border-zinc-700" : "border-zinc-800 opacity-40"}`}>
            <span className="text-zinc-400">eula=</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && ready) onConfirm(); }}
              placeholder="false"
              disabled={!linkClicked}
              className="flex-1 bg-transparent text-white outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={onConfirm}
              disabled={!ready}
              className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-500 disabled:active:scale-100"
            >
              {loading ? "Generating…" : "Download"}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
