"use client";

import Link from "next/link";
import { motion } from "./_components/motion-system";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-bg-canvas px-6">
      <motion.section
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-xl border border-border-light bg-bg-light p-7 text-center shadow-modal"
        initial={{ opacity: 0, scale: 0.97, y: 14 }}
      >
        <motion.div
          animate={{ rotate: [0, -4, 4, 0] }}
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-blue-light font-bold text-2xl text-primary-blue"
          transition={{ delay: 0.18, duration: 0.4 }}
        >
          404
        </motion.div>
        <h1 className="font-semibold text-text-heading text-xl">
          Страница не найдена
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Возможно, адрес изменился или страница была удалена.
        </p>
        <Link className="ui-button ui-button-primary mt-5" href="/dashboard">
          Вернуться на главную
        </Link>
      </motion.section>
    </main>
  );
}
