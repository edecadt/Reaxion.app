import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "error" | "success";
};

export function Alert({ className, variant = "error", ...props }: AlertProps) {
  return (
    <div
      className={cn(
        "w-full rounded-md border px-4 py-3 text-sm",
        variant === "error" &&
          "border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]",
        variant === "success" &&
          "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
        className,
      )}
      role="alert"
      {...props}
    />
  );
}
