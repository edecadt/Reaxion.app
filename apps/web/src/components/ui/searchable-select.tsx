"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

export type Option = { label: string; value: string; icon?: React.ReactNode };

type SearchableSelectProps = {
  options: Option[];
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
};

export function SearchableSelect({
  options,
  value,
  placeholder = "Select...",
  disabled,
  onChange,
  className,
  inputClassName,
  ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [overlayStyle, setOverlayStyle] = useState<{
    top: number;
    left: number;
    width: number;
    placement: "bottom" | "top";
    maxList: number;
  } | null>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );
  const selectedLabel = selectedOption?.label ?? "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (overlayRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const computeOverlay = () => {
    const trigger = buttonRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const gap = 6;
    const searchH = 40;
    const spaceBelow = viewportH - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const desiredList = 320;
    if (spaceBelow >= searchH + 60 || spaceBelow >= spaceAbove) {
      const maxList = Math.max(
        120,
        Math.min(desiredList, spaceBelow - searchH),
      );
      setOverlayStyle({
        top: Math.min(rect.bottom + gap, viewportH - 8),
        left: rect.left,
        width: rect.width,
        placement: "bottom",
        maxList,
      });
    } else {
      const maxList = Math.max(
        120,
        Math.min(desiredList, spaceAbove - searchH),
      );
      setOverlayStyle({
        top: rect.top - gap,
        left: rect.left,
        width: rect.width,
        placement: "top",
        maxList,
      });
    }
  };

  useEffect(() => {
    if (!open) return;
    computeOverlay();
    const onResize = () => computeOverlay();
    const onScroll = () => computeOverlay();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] p-2 text-left text-[hsl(var(--foreground))] transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))]",
          disabled && "cursor-not-allowed opacity-60",
        )}
        ref={buttonRef}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <span
          className={cn(
            "flex items-center gap-2 truncate",
            selectedLabel
              ? "text-[hsl(var(--foreground))]"
              : "text-[hsl(var(--muted-foreground))]",
          )}
        >
          {selectedOption?.icon}
          {selectedLabel || placeholder}
        </span>
        <svg
          className="ml-2 h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open &&
        overlayStyle &&
        createPortal(
          <div
            ref={overlayRef}
            className="fixed z-[9999] overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-lg transition-colors"
            style={{
              left: overlayStyle.left,
              width: overlayStyle.width,
              top:
                overlayStyle.placement === "bottom"
                  ? overlayStyle.top
                  : undefined,
              bottom:
                overlayStyle.placement === "top"
                  ? window.innerHeight - overlayStyle.top
                  : undefined,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2">
              <input
                ref={searchRef}
                className={cn(
                  "h-9 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))]",
                  inputClassName,
                )}
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                }}
              />
            </div>
            <div
              className="overflow-y-auto"
              style={{ maxHeight: overlayStyle.maxList }}
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
                  No results
                </div>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--accent))]",
                      value === opt.value &&
                        "bg-[hsl(var(--accent))] font-medium text-[hsl(var(--accent-foreground))]",
                    )}
                    onClick={() => {
                      onChange?.(opt.value);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
