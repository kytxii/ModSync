import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mockup } from "@/components/ui/mockup";
import { Glow } from "@/components/ui/glow";

export function HeroWithMockup({
  title,
  description,
  primaryCta = { text: "Get Started", href: "/dashboard" },
  secondaryCta,
  mockupImage,
  className,
}) {
  return (
    <section
      className={cn(
        "relative bg-zinc-950 text-white",
        "py-12 px-4 md:py-24 lg:py-32",
        "overflow-hidden",
        className,
      )}
    >
      <div className="relative mx-auto max-w-[1280px] flex flex-col gap-12 lg:gap-24">
        <div className="relative z-10 flex flex-col items-center gap-6 pt-8 md:pt-16 text-center lg:gap-12">

          <h1
            className={cn(
              "inline-block animate-appear",
              "bg-gradient-to-b from-white via-white/90 to-zinc-400",
              "bg-clip-text text-transparent",
              "text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl",
              "leading-[1.1]",
              "font-body",
            )}
          >
            {title}
          </h1>

          <p
            className={cn(
              "max-w-[550px] animate-appear opacity-0 [animation-delay:150ms]",
              "text-base sm:text-lg md:text-xl",
              "text-zinc-400 font-medium font-body",
            )}
          >
            {description}
          </p>

          <div className="relative z-10 flex flex-wrap justify-center gap-4 animate-appear opacity-0 [animation-delay:300ms]">
            <Button asChild size="lg">
              <a href={primaryCta.href}>{primaryCta.text}</a>
            </Button>

            {secondaryCta && (
              <Button asChild size="lg" variant="ghost">
                <a href={secondaryCta.href}>
                  {secondaryCta.icon}
                  {secondaryCta.text}
                </a>
              </Button>
            )}
          </div>

          <div className="relative w-full pt-12 px-4 sm:px-6 lg:px-8">
            <Mockup
              className={cn(
                "animate-appear opacity-0 [animation-delay:700ms]",
                "shadow-[0_0_80px_-12px_rgba(16,185,129,0.15)]",
              )}
            >
              <img
                {...mockupImage}
                className="w-full h-auto"
                loading="lazy"
                decoding="async"
              />
            </Mockup>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Glow
          variant="above"
          className="animate-appear-zoom opacity-0 [animation-delay:1000ms]"
        />
      </div>
    </section>
  );
}
