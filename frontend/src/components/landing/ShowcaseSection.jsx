import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import ScrollReveal from "./ScrollReveal";

const SHOWCASE_ITEMS = [
  {
    index: "01",
    slug: "analyzer",
    title: "Mod Analyzer",
    description:
      "Drop your mods folder and get a full breakdown of every mod, version, and compatibility issue in seconds.",
    image: "/landing/analyzer.png",
    alt: "Mod Analyzer results showing compatibility and update status for a mod list",
  },
  {
    index: "02",
    slug: "modpack-builder",
    title: "Modpack Builder",
    description:
      "Assemble a modpack and share it with a single code. Anyone can import it instantly, no files attached.",
    image: "/landing/modpack-builder.png",
    alt: "Modpack Builder interface for searching and assembling a shareable modpack",
  },
  {
    index: "03",
    slug: "servers",
    title: "Servers",
    description:
      "Add a server and keep tabs on its mods, live player count, and uptime. Everything you need at a glance.",
    image: "/landing/servers.png",
    alt: "Servers tab showing a server builder with mod list and live status",
  },
];

function ShowcaseShot({ src, alt }) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div
        onClick={() => !failed && setExpanded(true)}
        className="aspect-[16/10] w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 cursor-pointer transition-transform duration-300 hover:scale-[1.025]"
      >
        {failed ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-zinc-600">
            Feature coming soon.
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      {createPortal(
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-8 cursor-zoom-out"
              onClick={() => setExpanded(false)}
            >
              <motion.img
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                src={src}
                alt={alt}
                className="max-w-full max-h-full rounded-xl border border-zinc-700 shadow-2xl object-contain cursor-default"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

export default function ShowcaseSection() {
  return (
    <section className="mt-28 w-full max-w-7xl">
      <ScrollReveal>
        <h2 className="text-center font-body text-2xl font-bold tracking-tight sm:text-3xl">
          See it <span className="text-emerald-400">in action.</span>
        </h2>
      </ScrollReveal>

      <div className="mt-14 flex flex-col gap-20">
        {SHOWCASE_ITEMS.map((item, i) => (
          <div
            key={item.title}
            className={`flex flex-col items-center gap-8 md:flex-row md:gap-12 ${
              i % 2 === 1 ? "md:flex-row-reverse" : ""
            }`}
          >
            <ScrollReveal
              direction={i % 2 === 1 ? "right" : "left"}
              className="w-full md:w-3/5"
            >
              <ShowcaseShot src={item.image} alt={item.alt} />
            </ScrollReveal>

            <ScrollReveal
              direction={i % 2 === 1 ? "left" : "right"}
              delay={0.1}
              className="w-full text-center md:w-2/5 md:text-left"
            >
              <h3 className="font-body text-xl font-semibold text-white">
                {item.title}
              </h3>
              <p className="mt-2 font-body text-zinc-400">{item.description}</p>
            </ScrollReveal>
          </div>
        ))}
      </div>
    </section>
  );
}
