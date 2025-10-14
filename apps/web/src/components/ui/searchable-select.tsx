"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

export type Option = { label: string; value: string };

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

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? "",
    [options, value],
  );

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
          "w-full p-2 border border-gray-300 rounded-lg text-left flex items-center justify-between bg-white focus:outline-none focus:ring-2 focus:ring-blue-500",
          disabled && "opacity-60 cursor-not-allowed",
        )}
        ref={buttonRef}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <span className={cn("truncate", !selectedLabel && "text-gray-400")}>
          {selectedLabel || placeholder}
        </span>
        <svg
          className="w-4 h-4 text-gray-500 ml-2 shrink-0"
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
            className="z-[9999] fixed rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden"
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
            <div className="p-2 border-b border-gray-100">
              <input
                ref={searchRef}
                className={cn(
                  "w-full h-9 rounded-md border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
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
                <div className="px-3 py-2 text-sm text-gray-400">
                  No results
                </div>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm hover:bg-gray-50",
                      value === opt.value && "bg-gray-100",
                    )}
                    onClick={() => {
                      onChange?.(opt.value);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
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
