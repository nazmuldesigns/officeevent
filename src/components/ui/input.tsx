import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-[12px] bg-muted px-4 text-base text-foreground shadow-[var(--shadow-border)] placeholder:text-muted-foreground/80",
        "transition-[box-shadow] duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
