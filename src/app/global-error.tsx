"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  type AppLocale,
  defaultLocale,
  isAppLocale,
  localeCookieName,
} from "~/i18n/config";

type GlobalErrorProps = {
  reset: () => void;
};

const copy: Record<
  AppLocale,
  { title: string; description: string; restore: string }
> = {
  ru: {
    title: "Произошла непредвиденная ошибка",
    description: "Обновите интерфейс и продолжите работу.",
    restore: "Восстановить страницу",
  },
  uz: {
    title: "Kutilmagan xatolik yuz berdi",
    description: "Interfeysni tiklab, ishni davom ettiring.",
    restore: "Sahifani tiklash",
  },
  en: {
    title: "An unexpected error occurred",
    description: "Restore the interface and continue working.",
    restore: "Restore page",
  },
};

export default function GlobalError({ reset }: GlobalErrorProps) {
  const [locale, setLocale] = useState<AppLocale>(defaultLocale);

  useEffect(() => {
    const savedLocale = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${localeCookieName}=`))
      ?.split("=")[1];

    if (isAppLocale(savedLocale)) {
      setLocale(savedLocale);
    }
  }, []);

  return (
    <html lang={locale}>
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[#f4f6fa] px-6 font-sans">
          <motion.section
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md rounded-xl border border-[#ef4444]/20 bg-white p-6 shadow-xl"
            initial={{ opacity: 0, scale: 0.97, y: 14 }}
          >
            <h1 className="font-semibold text-[#182234] text-xl">
              {copy[locale].title}
            </h1>
            <p className="mt-2 text-[#5e6b7d] text-sm leading-5">
              {copy[locale].description}
            </p>
            <button
              className="mt-5 min-h-10 rounded-lg bg-[#2864dc] px-4 font-semibold text-sm text-white"
              onClick={reset}
              type="button"
            >
              {copy[locale].restore}
            </button>
          </motion.section>
        </main>
      </body>
    </html>
  );
}
