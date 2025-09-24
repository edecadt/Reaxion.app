import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type Variant = "default" | "outline";

const variantClasses: Record<Variant, string> = {
  default: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
  outline:
    "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
