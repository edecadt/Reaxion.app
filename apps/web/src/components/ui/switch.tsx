import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { cn } from "../../lib/utils";

type SwitchBaseProps = ComponentPropsWithoutRef<"button">;

export type SwitchProps = Omit<SwitchBaseProps, "onChange"> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      onCheckedChange,
      className,
      disabled,
      onClick,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const toggle = () => {
      if (disabled) return;
      onCheckedChange?.(!checked);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        data-state={checked ? "checked" : "unchecked"}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted))]",
          className,
        )}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) toggle();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    );
  },
);

Switch.displayName = "Switch";
