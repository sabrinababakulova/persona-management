"use client";

import { useState } from "react";
import { ChevronUpIcon } from "~/app/_components/icons";
import { AnimatePresence, motion } from "./motion-system";

export const ClosableSection = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) => {
  const [isSectionOpen, setIsSectionOpen] = useState(true);
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="section-title">{title}</h2>
        <button
          aria-expanded={isSectionOpen}
          aria-label={`Свернуть или развернуть ${title}`}
          className="rounded p-1 text-text-secondary transition-[background-color,color,transform] duration-200 ease-out hover:bg-bg-hover hover:text-text-heading"
          onClick={() => setIsSectionOpen((prev) => !prev)}
          type="button"
        >
          <ChevronUpIcon
            className={`h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isSectionOpen ? "rotate-0" : "rotate-180"}`}
          />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {isSectionOpen ? (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
          >
            <div className="space-y-4">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
};
