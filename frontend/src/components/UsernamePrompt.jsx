import { useState } from "react";
import UsernameField from "./UsernameField";
import { defaultAvatarColor } from "./AvatarPicker";

export default function UsernamePrompt() {
  const [preview, setPreview] = useState("");

  const letter = preview ? preview[0].toUpperCase() : "?";
  const color = preview ? defaultAvatarColor(preview) : "#3f3f46";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 backdrop-blur-[2px] px-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60">
        <div className="pointer-events-none absolute inset-x-0 -top-28 h-56 bg-emerald-500/10 blur-3xl" />

        <div className="relative flex flex-col items-center px-8 pb-8 pt-9 text-center">
          <h2 className="text-xl font-bold tracking-tight text-white">
            Claim your <span className="text-emerald-400">username</span>
          </h2>
          <p className="mt-2 max-w-[18rem] text-sm text-zinc-400">
            How others will find and share modpacks with you.
          </p>

          {/* Live avatar + handle preview — the focal point */}
          <div className="mt-7 flex flex-col items-center">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full blur-lg transition-colors duration-300"
                style={{ backgroundColor: color, opacity: preview ? 0.35 : 0 }}
              />
              <div
                className="relative flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white ring-4 ring-zinc-950 transition-colors duration-300"
                style={{ backgroundColor: color }}
              >
                {letter}
              </div>
            </div>
            <p className="mt-3 max-w-[14rem] truncate text-sm font-semibold text-white">
              {preview ? `@${preview}` : "@username"}
            </p>
            <p className="text-xs text-zinc-500">This is how you'll appear to others</p>
          </div>

          <div className="mt-7 w-full">
            <UsernameField currentUsername={null} autoFocus centered onValueChange={setPreview} />
          </div>

          <p className="mt-5 text-xs text-zinc-600">Usernames can be changed once a week.</p>
        </div>
      </div>
    </div>
  );
}
