import { useState } from "react";
import ScrollReveal from "./ScrollReveal";

const SHOWCASE_ITEMS = [
  {
    index: "01",
    slug: "analyzer",
    title: "Mod Analyzer",
    description:
      "Upload your mods folder and get instant compatibility reports, conflict detection, and update checks against the latest releases.",
    image: "/landing/analyzer.png",
    alt: "Mod Analyzer results showing compatibility and update status for a mod list",
  },
  {
    index: "02",
    slug: "modpack-builder",
    title: "Modpack Builder",
    description:
      "Search thousands of mods, build a named modpack, and share it with a single link. Friends can export straight to .zip.",
    image: "/landing/modpack-builder.png",
    alt: "Modpack Builder interface for searching and assembling a shareable modpack",
  },
  {
    index: "03",
    slug: "servers",
    title: "Servers",
    description:
      "Configure a self-hosted server from scratch — version, loader, mods, and properties — then export a ready-to-run pack or manage it live.",
    image: "/landing/servers.png",
    alt: "Servers tab showing a server builder with mod list and live status",
  },
];

function ShowcaseShot({ src, alt }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="aspect-[16/10] w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
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
  );
}

export default function ShowcaseSection() {
  return (
    <section className="mt-28 w-full max-w-5xl">
      <ScrollReveal>
        <h2 className="text-center font-display text-2xl font-medium tracking-tight sm:text-3xl">
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
              className="w-full md:w-1/2"
            >
              <ShowcaseShot src={item.image} alt={item.alt} />
            </ScrollReveal>

            <ScrollReveal
              direction={i % 2 === 1 ? "left" : "right"}
              delay={0.1}
              className="w-full text-center md:w-1/2 md:text-left"
            >
              <span className="font-display text-xs text-zinc-600">
                {item.index} <span className="text-zinc-700">/</span>{" "}
                {item.slug}
              </span>
              <h3 className="mt-2 font-body text-xl font-semibold text-white">
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
