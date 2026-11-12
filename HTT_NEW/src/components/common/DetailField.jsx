import React from "react";
import { cn } from "@/lib/utils";

/** @param {{label: React.ReactNode, value?: React.ReactNode, className?: string, children?: React.ReactNode}} props */
export default function DetailField({ label, value, className, children }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="htt-label mb-1">{label}</dt>
      <dd className="text-[13px] capitalize font-semibold leading-relaxed text-foreground/90 break-words">
        {children ??
          (value === null || value === undefined || value === "" ? "—" : value)}
      </dd>
    </div>
  );
}

/** @param {{children?: React.ReactNode, className?: string}} props */
export function DetailGrid({ children, className }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2",
        className,
      )}
    >
      {children}
    </dl>
  );
}

/** @param {{title?: React.ReactNode, description?: React.ReactNode, actions?: React.ReactNode, children?: React.ReactNode, className?: string}} props */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}) {
  return (
    <section className={cn("htt-surface overflow-hidden", className)}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
          <div>
            <h2 className="text-[13.5px] font-semibold text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex items-center gap-2">{actions}</div>
          ) : null}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}
