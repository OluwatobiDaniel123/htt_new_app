import React from 'react';

export default function PageHeader({ title, description, actions, eyebrow, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-border/70 pb-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="htt-label mb-1.5">{eyebrow}</p> : null}
        <h1 className="text-[22px] font-semibold leading-tight text-foreground md:text-[26px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}