import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Layers, Server, Search } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

// ── Shared ─────────────────────────────────────────────────────────────────

const PALETTE = ["#10b981", "#6366f1", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899"];
function avatarColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function ModAvatar({ name, size = "h-6 w-6" }) {
  return (
    <div
      className={`${size} rounded-md flex items-center justify-center font-semibold text-white text-[10px] shrink-0`}
      style={{ backgroundColor: avatarColor(name) }}
    >
      {name[0].toUpperCase()}
    </div>
  );
}

const SIDE = {
  client: { bg: "bg-blue-500/10",    text: "text-blue-400"    },
  server: { bg: "bg-purple-500/10",  text: "text-purple-400"  },
  both:   { bg: "bg-emerald-500/10", text: "text-emerald-400" },
};

// ── Analyzer Demo ──────────────────────────────────────────────────────────

const MODS = [
  { name: "Sodium",       file: "sodium-0.5.8.jar",       version: "0.5.8",  latest: "0.6.0",  side: "client", found: true  },
  { name: "Fabric API",   file: "fabric-api-0.91.0.jar",  version: "0.91.0", latest: "0.91.0", side: "both",   found: true  },
  { name: "Iris Shaders", file: "iris-mc1.21-1.6.4.jar",  version: "1.6.4",  latest: "1.7.0",  side: "client", found: true  },
  { name: "Lithium",      file: "lithium-0.11.jar",        version: "0.11.2", latest: "0.11.2", side: "both",   found: true  },
  { name: "Starlight",    file: "starlight-1.1.2.jar",    version: "1.1.2",  latest: "1.1.2",  side: "both",   found: true  },
  { name: "Unknown",      file: "optifabric-old.jar",      version: "?",      latest: null,     side: null,     found: false },
];

function AnalyzerDemo() {
  const [scanned, setScanned] = useState(false);
  const [revealed, setRevealed] = useState([]);
  const timers = useRef([]);

  function scan() {
    if (scanned) {
      setScanned(false);
      setRevealed([]);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      return;
    }
    setScanned(true);
    MODS.forEach((_, i) => {
      const t = setTimeout(() => setRevealed((p) => [...p, i]), 300 + i * 140);
      timers.current.push(t);
    });
  }

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const found   = revealed.filter((i) => MODS[i].found).length;
  const unknown = revealed.filter((i) => !MODS[i].found).length;
  const updates = revealed.filter((i) => {
    const m = MODS[i];
    return m.found && m.latest && m.latest !== m.version;
  }).length;

  return (
    <div className="flex flex-col gap-3">
      {/* toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs font-body">
          <span className="text-zinc-500">{MODS.length} mods detected</span>
          <AnimatePresence>
            {revealed.length > 0 && (
              <motion.span
                key="stats"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                <span className="text-emerald-400">{found} found</span>
                {updates > 0 && <span className="text-amber-400">{updates} updates</span>}
                {unknown > 0 && <span className="text-zinc-500">{unknown} unknown</span>}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={scan}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]"
        >
          {scanned ? "Reset" : "Scan mods"}
        </button>
      </div>

      {/* column headers */}
      <div className="grid grid-cols-[1fr_72px_56px_72px] gap-2 px-3 text-[10px] font-display uppercase tracking-wider text-zinc-600">
        <span>Mod</span>
        <span>Version</span>
        <span>Side</span>
        <span className="text-right">Status</span>
      </div>

      {/* rows */}
      <div className="flex flex-col gap-1">
        {MODS.map((mod, i) => {
          const vis = revealed.includes(i);
          const hasUpdate = mod.found && mod.latest && mod.latest !== mod.version;
          const side = mod.side ? SIDE[mod.side] : null;
          return (
            <div
              key={mod.name + i}
              className="grid grid-cols-[1fr_72px_56px_72px] items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"
            >
              {/* name */}
              <div className="flex items-center gap-2 min-w-0">
                <ModAvatar name={mod.name} />
                <div className="min-w-0">
                  <p className="text-xs font-body text-white truncate">{mod.found ? mod.name : "Unknown"}</p>
                  <p className="text-[10px] font-mono text-zinc-600 truncate">{mod.file}</p>
                </div>
              </div>

              {/* version */}
              <div className="flex flex-col gap-0.5">
                <span className={`text-[11px] font-mono ${hasUpdate && vis ? "line-through text-zinc-600" : "text-zinc-400"}`}>
                  {mod.version}
                </span>
                {hasUpdate && vis && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] font-mono text-amber-400"
                  >
                    ↑ {mod.latest}
                  </motion.span>
                )}
              </div>

              {/* side */}
              <div>
                {side && vis ? (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`inline-block rounded px-1 py-0.5 text-[9px] font-body ${side.bg} ${side.text}`}
                  >
                    {mod.side}
                  </motion.span>
                ) : (
                  <span className="text-xs text-zinc-700">—</span>
                )}
              </div>

              {/* status */}
              <div className="flex items-center justify-end gap-1.5">
                {vis ? (
                  <motion.div
                    initial={{ opacity: 0, x: 4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${mod.found ? "bg-emerald-400" : "bg-zinc-500"}`} />
                    <span className={`text-[11px] font-body ${mod.found ? "text-emerald-400" : "text-zinc-500"}`}>
                      {mod.found ? "Found" : "Unknown"}
                    </span>
                  </motion.div>
                ) : (
                  <span className="text-xs text-zinc-700">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Modpack Demo ───────────────────────────────────────────────────────────

const PACK_MODS = [
  { name: "Sodium",       version: "0.6.0",  side: "client" },
  { name: "Fabric API",   version: "0.91.0", side: "both"   },
  { name: "Iris Shaders", version: "1.7.0",  side: "client" },
  { name: "Lithium",      version: "0.11.2", side: "both"   },
  { name: "Indium",       version: "1.0.9",  side: "client" },
  { name: "Starlight",    version: "1.1.2",  side: "both"   },
  { name: "FerriteCore",  version: "6.0.1",  side: "both"   },
  { name: "ModMenu",      version: "9.2.0",  side: "client" },
];

const PACK = { name: "Fabric Performance Pack", version: "1.21.1", loader: "Fabric", code: "XKQM-4729", color: "#10b981" };

function ModpackDemo() {
  const [selected, setSelected] = useState(new Set([0, 1, 2, 3]));
  const [query, setQuery]       = useState("");

  function toggle(i) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const filtered = PACK_MODS
    .map((m, i) => ({ ...m, idx: i }))
    .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
      {/* pack card */}
      <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center font-bold text-lg text-white shrink-0"
          style={{ backgroundColor: PACK.color }}
        >
          F
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-body font-semibold text-white truncate">{PACK.name}</p>
          <p className="text-xs font-body mt-0.5">
            <span className="text-emerald-400">{PACK.version} · {PACK.loader}</span>
            <span className="text-zinc-500"> · {selected.size} mods</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-display text-zinc-600 mb-0.5">Share code</p>
          <p className="text-xs font-mono text-zinc-400">{PACK.code}</p>
        </div>
      </div>

      {/* search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mods..."
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-8 pr-3 text-xs font-body text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
      </div>

      {/* mod list */}
      <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto scrollbar-dark">
        {filtered.map((mod) => {
          const inPack = selected.has(mod.idx);
          const side   = SIDE[mod.side];
          return (
            <div
              key={mod.name}
              onClick={() => toggle(mod.idx)}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors
                ${inPack ? "border-emerald-500/30 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800/60"}`}
            >
              <ModAvatar name={mod.name} />
              <span className="flex-1 text-xs font-body text-white">{mod.name}</span>
              <span className="text-[10px] font-mono text-zinc-600">v{mod.version}</span>
              <span className={`text-[9px] font-body px-1.5 py-0.5 rounded ${side.bg} ${side.text}`}>
                {mod.side}
              </span>
              <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors
                ${inPack ? "bg-emerald-500 border-emerald-500" : "border-zinc-700"}`}>
                {inPack && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Server Demo ────────────────────────────────────────────────────────────

const UPTIME = Array.from({ length: 30 }, (_, i) => (i === 29 ? true : Math.random() > 0.1));
const UP_PCT  = Math.round((UPTIME.filter(Boolean).length / UPTIME.length) * 100);
const SERVER_MODS = ["Sodium", "Fabric API", "Iris Shaders", "Lithium", "Create", "Waystones", "JEI"];

function ServerDemo() {
  const [online,  setOnline]  = useState(true);
  const [ping,    setPing]    = useState(47);
  const [players, setPlayers] = useState(4);

  function toggle() {
    setOnline((v) => {
      if (!v) {
        setPing(Math.floor(28 + Math.random() * 50));
        setPlayers(Math.floor(1 + Math.random() * 8));
      }
      return !v;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* server card */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        {/* header */}
        <div className="flex items-start gap-3 mb-4">
          <div
            className="h-12 w-12 rounded-lg flex items-center justify-center font-bold text-xl text-white shrink-0"
            style={{ backgroundColor: avatarColor("Survival SMP") }}
          >
            S
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-body font-semibold text-white">Survival SMP</p>
              <button onClick={toggle}>
                {online ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-body text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online · {ping}ms
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-body text-zinc-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                    Offline
                  </span>
                )}
              </button>
            </div>
            <p className="text-xs font-mono text-zinc-600 mt-0.5">mc.survival-smp.net</p>
          </div>
        </div>

        {/* tags */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-body text-zinc-400">1.21.1</span>
          <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-body text-zinc-400">Fabric</span>
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-body text-emerald-400">
            {SERVER_MODS.length} mods
          </span>
          {online && (
            <span className="ml-auto text-xs font-body text-zinc-500">
              {players}<span className="text-zinc-600"> / </span>20 players
            </span>
          )}
        </div>

        {/* player bar */}
        {online && (
          <div className="mb-4 h-1 rounded-full bg-zinc-800 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${(players / 20) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        )}

        {/* uptime bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-display uppercase tracking-wider text-zinc-600">30-day uptime</span>
            <span className="text-[10px] font-body text-emerald-400">{UP_PCT}%</span>
          </div>
          <div className="flex gap-0.5">
            {UPTIME.map((up, i) => (
              <div
                key={i}
                className={`h-3 flex-1 rounded-sm transition-colors ${
                  i === UPTIME.length - 1
                    ? online ? "bg-emerald-400" : "bg-red-500"
                    : up ? "bg-emerald-600/60" : "bg-red-500/50"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* mod list */}
      <div className="flex flex-col gap-1">
        {SERVER_MODS.slice(0, 4).map((mod) => (
          <div key={mod} className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            <ModAvatar name={mod} />
            <span className="flex-1 text-xs font-body text-white">{mod}</span>
            <span className="text-xs font-body text-emerald-400">Installed</span>
          </div>
        ))}
        <p className="text-center text-xs text-zinc-700 font-body">+{SERVER_MODS.length - 4} more</p>
      </div>
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────

const CARDS = [
  { label: "Mod Analyzer",    icon: Package, component: AnalyzerDemo  },
  { label: "Modpack Builder", icon: Layers,  component: ModpackDemo   },
  { label: "Server Profiles", icon: Server,  component: ServerDemo    },
];

export default function ShowcaseInteractive() {
  return (
    <section className="mt-24 w-full max-w-2xl mx-auto">
      <ScrollReveal once={false}>
        <h2 className="text-center font-display text-2xl font-medium tracking-tight sm:text-3xl text-white mb-12">
          See it <span className="text-emerald-400">in action.</span>
        </h2>
      </ScrollReveal>

      <div className="flex flex-col gap-6">
        {CARDS.map(({ label, icon: Icon, component: Demo }, i) => (
          <ScrollReveal key={label} delay={i * 0.08} once={false}>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-zinc-800 px-4 py-3">
                <Icon className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-body font-medium text-white">{label}</span>
              </div>
              <div className="p-4">
                <Demo />
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
