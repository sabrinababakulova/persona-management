"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronUpIcon } from "~/app/_components/icons";

export const ClosableSection = ({
  ariaTitle,
  children,
  title,
}: {
  ariaTitle?: string;
  children: ReactNode;
  title: ReactNode;
}) => {
  const [isSectionOpen, setIsSectionOpen] = useState(true);
  const sectionLabel =
    ariaTitle ?? (typeof title === "string" ? title : "секцию");

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[22px] text-text-heading leading-[1.1] tracking-[-0.44px]">
          {title}
        </h2>
        <button
          aria-expanded={isSectionOpen}
          aria-label={`Свернуть или развернуть ${sectionLabel}`}
          className="rounded p-1 text-text-secondary transition-[background-color,color,transform] duration-200 ease-out hover:bg-bg-hover hover:text-text-heading"
          onClick={() => setIsSectionOpen((prev) => !prev)}
          type="button"
        >
          <ChevronUpIcon
            className={`h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSectionOpen ? "rotate-0" : "rotate-180"}`}
          />
        </button>
      </div>
      <div
        aria-hidden={!isSectionOpen}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSectionOpen ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"}`}
      >
        <div className="space-y-4 overflow-hidden">{children}</div>
      </div>
    </section>
  );
};
