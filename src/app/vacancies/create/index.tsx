"use client";

import { useMemo, useState } from "react";
import { SideMenu } from "./components/sideMenu";

const SIDE_MENU_ITEMS = [
  { id: "description", label: "Описание вакансии" },
  { id: "publications", label: "Публикации" },
  { id: "preview", label: "Предпросмотр" },
] as const;

export default function CreateVacancyIndex() {
  const [activeSectionId, setActiveSectionId] = useState<string>(
    SIDE_MENU_ITEMS[0].id,
  );

  const activeSection = useMemo(
    () => SIDE_MENU_ITEMS.find((item) => item.id === activeSectionId),
    [activeSectionId],
  );

  return (
    <main className="min-h-screen w-full bg-white">
      <div className="mx-auto flex w-full max-w-[1240px] gap-8 px-6 py-8">
        <SideMenu
          activeId={activeSectionId}
          items={SIDE_MENU_ITEMS.map((item) => ({ ...item }))}
          onSelect={setActiveSectionId}
        />

        <section className="flex-1 rounded-[8px] border border-border-input p-6">
          <h1 className="font-semibold text-[20px] text-text-heading leading-none tracking-[-0.4px]">
            {activeSection?.label}
          </h1>
        </section>
      </div>
    </main>
  );
}
