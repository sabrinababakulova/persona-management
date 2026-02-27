import { useState } from "react";
import { ChevronUpIcon } from "~/app/_components/icons";

export const ClosableSection = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) => {
  const [isSectionOpen, setIsSectionOpen] = useState(true);
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[22px] text-text-heading leading-[1.1] tracking-[-0.44px]">
          {title}
        </h2>
        <button
          aria-expanded={isSectionOpen}
          aria-label={`Свернуть или развернуть ${title}`}
          className="rounded p-1 text-[#65748A] transition-colors hover:bg-bg-hover"
          onClick={() => setIsSectionOpen((prev) => !prev)}
          type="button"
        >
          <ChevronUpIcon
            className={`h-4 w-4 transition-transform ${isSectionOpen ? "rotate-0" : "rotate-180"}`}
          />
        </button>
      </div>
      {isSectionOpen && <div className="space-y-4">{children}</div>}
    </section>
  );
};
