import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-full rounded-md border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 px-4 py-3 text-sm text-[hsl(var(--destructive))]",
        className,
      )}
      role="alert"
      {...props}
    />
  );
}
