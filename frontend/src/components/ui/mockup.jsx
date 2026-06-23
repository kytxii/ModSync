import React from "react";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

const mockupVariants = cva(
  "flex relative z-10 overflow-hidden shadow-2xl border border-zinc-700/20 border-t-zinc-600/30",
  {
    variants: {
      type: {
        mobile: "rounded-[48px] max-w-[350px]",
        responsive: "rounded-xl",
      },
    },
    defaultVariants: {
      type: "responsive",
    },
  },
);

const Mockup = React.forwardRef(({ className, type, ...props }, ref) => (
  <div ref={ref} className={cn(mockupVariants({ type, className }))} {...props} />
));
Mockup.displayName = "Mockup";

const frameVariants = cva(
  "bg-zinc-800/20 flex relative z-10 overflow-hidden rounded-2xl",
  {
    variants: {
      size: {
        small: "p-2",
        large: "p-4",
      },
    },
    defaultVariants: {
      size: "small",
    },
  },
);

const MockupFrame = React.forwardRef(({ className, size, ...props }, ref) => (
  <div ref={ref} className={cn(frameVariants({ size, className }))} {...props} />
));
MockupFrame.displayName = "MockupFrame";

export { Mockup, MockupFrame };
