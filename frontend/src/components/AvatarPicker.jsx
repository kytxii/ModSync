import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateAvatar } from "../api/auth";

const AVATAR_PALETTE = [
  "#059669", "#10b981", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1", "#7c3aed", "#9333ea",
  "#ec4899", "#f43f5e", "#ef4444", "#047857",
  "#f59e0b", "#84cc16", "#22c55e", "#64748b",
];

export function defaultAvatarColor(name) {
  return AVATAR_PALETTE[(name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length];
}

function resizeToAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function avatarColor(user) {
  return user.avatar_color ?? defaultAvatarColor(user.username ?? user.display_name);
}

export default function AvatarPicker({ user, size = "h-14 w-14" }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("color");
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const mutation = useMutation({
    mutationFn: updateAvatar,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["me"] });
      const previous = queryClient.getQueryData(["me"]);
      queryClient.setQueryData(["me"], (old) => (old ? { ...old, ...vars } : old));
      setError(null);
      setOpen(false);
      return { previous };
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["me"], updated);
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["me"], context.previous);
      setError(err?.response?.data?.detail ?? "Failed to update avatar");
      setOpen(true);
    },
  });

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resizeToAvatar(file);
      mutation.mutate({ avatar_image: dataUrl, avatar_color: null });
    } catch {
      setError("Could not process that image");
    }
  }

  const color = avatarColor(user);
  const letter = (user.username ?? user.display_name)?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`group relative ${size} overflow-hidden rounded-full transition-all hover:ring-2 hover:ring-white/20`}
        title="Click to change avatar"
      >
        {user.avatar_image ? (
          <img src={user.avatar_image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {letter}
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="absolute left-1/2 top-[calc(100%+8px)] z-50 w-64 origin-top overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/50 [animation:centered-panel-in_180ms_ease-out_forwards]">
          <div className="flex border-b border-zinc-800">
            {["color", "image"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                  tab === t ? "text-white border-b-2 border-emerald-400 -mb-px" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "color" && (
            <div className="grid grid-cols-8 gap-1.5 p-3">
              {AVATAR_PALETTE.map((hex) => (
                <button
                  key={hex}
                  onClick={() => mutation.mutate({ avatar_color: hex, avatar_image: null })}
                  className="h-6 w-6 rounded-md transition-transform hover:scale-110 active:scale-95"
                  style={{ backgroundColor: hex }}
                  title={hex}
                >
                  {!user.avatar_image && color === hex && (
                    <svg width="10" height="8" viewBox="0 0 10 8" className="mx-auto" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}

          {tab === "image" && (
            <div className="p-3">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 py-4 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload image
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          )}

          {error && <p className="px-3 pb-3 text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
