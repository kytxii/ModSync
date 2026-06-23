import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { loginWithGoogle } from "../../api/auth";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stillVariants = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0 },
};

const STATUS_LINES = [
  "scanning mods/",
  "resolving conflicts/",
  "building modpack/",
  "server: online",
];

const TYPE_MS = 45;
const DELETE_MS = 28;
const HOLD_MS = 1300;

function TerminalLine() {
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState(reduceMotion ? STATUS_LINES[0] : "");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phase, setPhase] = useState("typing");

  useEffect(() => {
    if (reduceMotion) return;

    const phrase = STATUS_LINES[phraseIndex];
    let timeout;

    if (phase === "typing") {
      if (text.length < phrase.length) {
        timeout = setTimeout(
          () => setText(phrase.slice(0, text.length + 1)),
          TYPE_MS,
        );
      } else {
        timeout = setTimeout(() => setPhase("deleting"), HOLD_MS);
      }
    } else {
      if (text.length > 0) {
        timeout = setTimeout(() => setText(text.slice(0, -1)), DELETE_MS);
      } else {
        setPhraseIndex((i) => (i + 1) % STATUS_LINES.length);
        setPhase("typing");
      }
    }

    return () => clearTimeout(timeout);
  }, [text, phase, phraseIndex, reduceMotion]);

  return (
    <div className="inline-flex items-center gap-2 font-display text-xs text-emerald-400 sm:text-sm">
      <span className="text-zinc-600">~/beacon$</span>
      <span>{text}</span>
      <span
        aria-hidden="true"
        className="inline-block h-[1em] w-[0.5ch] translate-y-[0.15em] bg-emerald-400"
        style={
          reduceMotion
            ? undefined
            : { animation: "cursor-blink 1s steps(1) infinite" }
        }
      />
    </div>
  );
}

function ModuleGrid({ reduceMotion }) {
  const cells = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        duration: 4 + Math.random() * 3,
        delay: Math.random() * 5,
        still: 0.08 + Math.random() * 0.22,
      })),
    [],
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-2 hidden grid-cols-4 gap-3 lg:grid"
    >
      {cells.map((cell) => (
        <div
          key={cell.id}
          className="h-8 w-8 rounded-md bg-emerald-400"
          style={
            reduceMotion
              ? { opacity: cell.still }
              : {
                  animation: `module-glow ${cell.duration}s ease-in-out ${cell.delay}s infinite`,
                }
          }
        />
      ))}
    </div>
  );
}

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const container = reduceMotion ? stillVariants : containerVariants;
  const item = reduceMotion ? stillVariants : itemVariants;

  return (
    <motion.section
      initial="hidden"
      animate="show"
      variants={container}
      className="relative mt-16 flex w-full max-w-5xl flex-col items-start text-left sm:mt-24"
    >
      <ModuleGrid reduceMotion={reduceMotion} />

      <motion.div variants={item}>
        <TerminalLine />
      </motion.div>

      <motion.h1
        variants={item}
        className="mt-6 max-w-2xl font-display text-4xl font-medium leading-[1.4] tracking-tight sm:text-6xl"
      >
        Minecraft mod management,
        <span className="mt-2 block text-emerald-400 sm:mt-3">simplified.</span>
      </motion.h1>

      <motion.p
        variants={item}
        className="mt-6 max-w-md font-body text-base text-zinc-400 sm:text-lg"
      >
        Analyze mod folders, build shareable modpacks, and track server profiles
        — all in one place.
      </motion.p>

      <motion.button
        variants={item}
        onClick={loginWithGoogle}
        className="mt-8 rounded-md bg-emerald-500 px-6 py-3 font-body text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition-all duration-150 hover:bg-emerald-400 hover:shadow-emerald-800/50 active:scale-95"
      >
        Get started with Google
      </motion.button>
    </motion.section>
  );
}
