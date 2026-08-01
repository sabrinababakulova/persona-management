"use client";

import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "./motion-system";
import { SkeletonBlock } from "./page-skeleton";

type DataMigrationLoadingScreenProps = {
  isLoading: boolean;
};

export function DataMigrationLoadingScreen({
  isLoading,
}: DataMigrationLoadingScreenProps) {
  const t = useTranslations("Components");

  return (
    <AnimatePresence>
      {isLoading ? (
        <motion.div
          animate={{ opacity: 1 }}
          aria-live="polite"
          aria-modal="true"
          className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center bg-bg-frosted px-6 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          role="dialog"
        >
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="flex w-full max-w-[360px] flex-col items-center gap-6 rounded-xl border border-border-input bg-bg-light px-8 py-9 shadow-modal"
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
          >
            <div aria-hidden="true" className="w-full space-y-3">
              <SkeletonBlock className="mx-auto h-16 w-16 rounded-2xl" />
              <SkeletonBlock className="mx-auto h-3 w-32 rounded-md" />
            </div>

            <div className="space-y-2 text-center">
              <h2 className="font-semibold text-text-heading text-xl leading-tight">
                {t("migratingData")}
              </h2>
              <p className="text-sm text-text-secondary leading-5">
                {t("migratingDataDescription")}
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
