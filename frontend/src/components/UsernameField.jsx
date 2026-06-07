import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { checkUsernameAvailability, updateUsername } from "../api/auth";

function Spinner({ className = "" }) {
  return (
    <svg className={`h-3.5 w-3.5 animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const _COOLDOWN_DAYS = 7;

function daysUntilCooldownEnds(changedAt) {
  if (!changedAt) return 0;
  const elapsedMs = Date.now() - new Date(changedAt).getTime();
  const remainingMs = _COOLDOWN_DAYS * 24 * 60 * 60 * 1000 - elapsedMs;
  return remainingMs > 0 ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000)) : 0;
}

function StatusPill({ tone, children }) {
  const styles = {
    neutral: "bg-zinc-800/80 text-zinc-400",
    positive: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20",
    negative: "bg-red-500/15 text-red-400 ring-1 ring-red-500/20",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${styles[tone]}`}>
      {children}
    </span>
  );
}

export default function UsernameField({ currentUsername, usernameChangedAt, onSaved, onValueChange, autoFocus, centered }) {
  const [value, setValue] = useState(currentUsername ?? "");
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const debounceRef = useRef(null);
  const queryClient = useQueryClient();

  const cooldownDays = currentUsername ? daysUntilCooldownEnds(usernameChangedAt) : 0;
  const locked = cooldownDays > 0;

  const mutation = useMutation({
    mutationFn: updateUsername,
    onSuccess: (user) => {
      queryClient.setQueryData(["me"], user);
      onSaved?.(user);
    },
  });

  const unchanged = value === (currentUsername ?? "");

  useEffect(() => {
    setStatus(null);
    if (unchanged || value.length < 3) return;
    setChecking(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setStatus(await checkUsernameAvailability(value));
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, unchanged]);

  const canSave = !locked && !unchanged && status?.available && !mutation.isPending;

  let pill = null;
  if (locked) {
    pill = (
      <StatusPill tone="neutral">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 3.4V6l1.7 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Changeable again in {cooldownDays} {cooldownDays === 1 ? "day" : "days"}
      </StatusPill>
    );
  } else if (!unchanged && value.length > 0 && value.length < 3) {
    pill = <StatusPill tone="neutral">At least 3 characters</StatusPill>;
  } else if (!unchanged && value.length >= 3 && checking) {
    pill = (
      <StatusPill tone="neutral">
        <Spinner /> Checking availability…
      </StatusPill>
    );
  } else if (!unchanged && !checking && status && !status.available) {
    pill = (
      <StatusPill tone="negative">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {status.reason}
      </StatusPill>
    );
  } else if (!unchanged && !checking && status?.available) {
    pill = (
      <StatusPill tone="positive">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.5l2.5 2.5 4.5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Available
      </StatusPill>
    );
  }

  const helperText = "Lowercase letters, numbers, underscores, and hyphens";

  return (
    <div className={`space-y-3.5 ${centered ? "flex flex-col items-center text-center" : ""}`}>
      <div className={centered ? "flex w-full flex-col items-center gap-3" : "flex gap-2"}>
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            const next = e.target.value.toLowerCase().slice(0, 20);
            setValue(next);
            onValueChange?.(next);
          }}
          placeholder="username"
          aria-label="Username"
          autoComplete="username"
          maxLength={20}
          disabled={locked}
          className={`rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 ${
            centered ? "w-full text-center" : "flex-1"
          }`}
        />
        <button
          onClick={() => mutation.mutate(value)}
          disabled={!canSave}
          className={`flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white transition-all hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:active:scale-100 disabled:shadow-none ${
            canSave ? "shadow-[0_0_14px_rgba(16,185,129,0.35)]" : ""
          } ${centered ? "w-full" : ""}`}
        >
          {mutation.isPending && <Spinner />}
          Set
        </button>
      </div>
      {pill ?? <p className="text-xs text-zinc-600">{helperText}</p>}
      {mutation.isError && (
        <p className="text-xs text-red-400">
          {mutation.error?.response?.data?.detail ?? "Failed to update username"}
        </p>
      )}
    </div>
  );
}
