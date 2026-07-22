"use client";

import { motion } from "motion/react";

type GlobalErrorProps = {
  reset: () => void;
};

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="ru">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[#f4f6fa] px-6 font-sans">
          <motion.section
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md rounded-xl border border-[#ef4444]/20 bg-white p-6 shadow-xl"
            initial={{ opacity: 0, scale: 0.97, y: 14 }}
          >
            <h1 className="font-semibold text-[#182234] text-xl">
              Произошла непредвиденная ошибка
            </h1>
            <p className="mt-2 text-[#5e6b7d] text-sm leading-5">
              Обновите интерфейс и продолжите работу.
            </p>
            <button
              className="mt-5 min-h-10 rounded-lg bg-[#2864dc] px-4 font-semibold text-sm text-white"
              onClick={reset}
              type="button"
            >
              Восстановить страницу
            </button>
          </motion.section>
        </main>
      </body>
    </html>
  );
}
