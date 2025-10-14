"use client";

import { useEffect, useRef } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
};

export function Dialog({ open, onClose, children, title }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center text-[hsl(var(--foreground))] transition-colors">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="relative z-10 m-4 flex w-full max-h-[90vh] max-w-2xl flex-col overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl transition-colors"
      >
        {title && (
          <div className="sticky top-0 flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/85">
            <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto px-6 py-4 text-[hsl(var(--foreground))]">
          {children}
        </div>
      </div>
    </div>
  );
}
