import * as React from "react";
import { useMemo, useState, useEffect } from "react";
import { Package, Layers, Server, ArrowRight } from "lucide-react";
import {
  motion,
  useAnimation,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import { loginWithGoogle } from "@/api/auth";
import ShowcaseSection from "./ShowcaseSection";

const labels = [
  { icon: Package, label: "Mod Analyzer" },
  { icon: Layers, label: "Modpack Builder" },
  { icon: Server, label: "Server Profiles" },
];

const features = [
  {
    icon: Package,
    label: "Mod Analyzer",
    description:
      "Drop your mods folder and get a full breakdown of every mod, version, and compatibility issue in seconds.",
  },
  {
    icon: Layers,
    label: "Modpack Builder",
    description:
      "Assemble a modpack and share it with a single code. Anyone can import it instantly, no files attached.",
  },
  {
    icon: Server,
    label: "Server Profiles",
    description:
      "Add a server and keep tabs on its mods, live player count, and uptime. Everything you need at a glance.",
  },
];

const titleWords = ["Minecraft mod", "management,", "simplified."];

function BackgroundGrid({ reduceMotion }) {
  const cells = useMemo(
    () =>
      Array.from({ length: 350 }, (_, i) => ({
        id: i,
        duration: 3 + Math.random() * 6,
        delay: Math.random() * 8,
        still: 0.03 + Math.random() * 0.07,
      })),
    [],
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 overflow-hidden"
      style={{
        width: "calc(100vw - 8rem)",
        maskImage:
          "radial-gradient(ellipse 100% 90% at 50% 10%, black 10%, transparent 70%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 100% 90% at 50% 10%, black 10%, transparent 70%)",
      }}
    >
      <div
        className="grid gap-3 opacity-[0.28] px-3 pt-3"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(1.75rem, 1fr))",
        }}
      >
        {cells.map((cell) => (
          <div
            key={cell.id}
            className="h-7 w-7 rounded-md bg-emerald-400"
            style={
              reduceMotion
                ? { opacity: cell.still }
                : {
                    animation: `module-glow ${cell.duration}s ease-in-out -${cell.delay}s infinite`,
                  }
            }
          />
        ))}
      </div>
    </div>
  );
}

function ScrollArrow() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY < 60);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.div
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.3 }}
      className="pointer-events-none mt-32"
    >
      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className="text-zinc-600"
        >
          <path
            d="M10 4v12M4 10l6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
    </motion.div>
  );
}

export function BeaconHero() {
  const reduceMotion = useReducedMotion();
  const controls = useAnimation();
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });

  React.useEffect(() => {
    if (isInView) controls.start("visible");
  }, [controls, isInView]);

  return (
    <div className="w-full bg-zinc-950">
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden container mx-auto px-4 pt-16 pb-28">
          <BackgroundGrid reduceMotion={reduceMotion} />

          <div className="relative z-10 flex flex-col items-center text-center">
            <motion.h1
              initial={{ filter: "blur(10px)", opacity: 0, y: 50 }}
              animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="font-body text-5xl font-bold sm:text-6xl md:text-7xl lg:text-8xl max-w-4xl mx-auto leading-[1.05] tracking-tight text-white"
            >
              {titleWords.map((text, index) => (
                <motion.span
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.18, duration: 0.6 }}
                  className={`inline-block mr-4 ${
                    index === titleWords.length - 1 ? "text-emerald-400" : ""
                  }`}
                >
                  {text}
                </motion.span>
              ))}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="mx-auto mt-12 max-w-xl text-lg text-zinc-400 font-body"
            >
              Upload, analyze and compare mod folders, build shareable modpacks,
              and track server profiles. All in one place.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.6 }}
              className="mt-12 flex flex-wrap justify-center gap-6"
            >
              {labels.map((feature, index) => (
                <motion.div
                  key={feature.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 1.0 + index * 0.12,
                    duration: 0.5,
                    type: "spring",
                    stiffness: 100,
                    damping: 10,
                  }}
                  className="flex items-center gap-2"
                >
                  <feature.icon className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-body text-zinc-400">
                    {feature.label}
                  </span>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 1.4,
                duration: 0.5,
                type: "spring",
                stiffness: 100,
                damping: 10,
              }}
            >
              <Button
                size="lg"
                onClick={loginWithGoogle}
                className="mt-14 font-body"
              >
                Get started with Google <ArrowRight className="ml-1 w-4 h-4" />
              </Button>
            </motion.div>

            <ScrollArrow />
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 pb-24">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.5 }}
            className="text-center text-3xl font-body font-bold text-white mb-6"
          >
            Everything you need
          </motion.h2>
          <div className="grid md:grid-cols-3 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{
                  delay: index * 0.1,
                  duration: 0.5,
                  ease: "easeOut",
                }}
                className="flex flex-col items-center text-center p-8 border border-zinc-800"
              >
                <div className="mb-6 rounded-full bg-emerald-500/10 p-4">
                  <feature.icon className="h-7 w-7 text-emerald-400" />
                </div>
                <h3 className="mb-3 text-lg font-body font-bold text-white">
                  {feature.label}
                </h3>
                <p className="text-zinc-400 font-body text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Showcase */}
        <div className="flex flex-col items-center px-4 pb-32">
          <ShowcaseSection />
        </div>
      </main>
    </div>
  );
}
