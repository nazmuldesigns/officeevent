import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-sm font-medium transition-[transform,opacity,background-color,color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-40 active:not-disabled:scale-[0.96]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[var(--shadow-border)]",
        secondary: "bg-secondary text-foreground shadow-[var(--shadow-border)]",
        outline:
          "bg-transparent text-foreground shadow-[var(--shadow-border)]",
        ghost: "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted",
        ok: "bg-ok text-ok-foreground",
        warn: "bg-warn text-warn-foreground",
        bad: "bg-bad text-bad-foreground",
      },
      size: {
        default: "h-12 px-4",
        sm: "h-10 px-3 text-sm",
        lg: "h-14 px-5 text-base",
        icon: "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
