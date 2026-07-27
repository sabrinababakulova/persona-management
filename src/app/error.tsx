"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { FeedbackPresence } from "./_components/motion-system";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  const t = useTranslations("Errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-bg-canvas px-6">
      <FeedbackPresence className="w-full max-w-md" show>
        <section className="rounded-xl border border-danger-red/20 bg-bg-light p-6 shadow-modal">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-red-bg font-bold text-danger-red text-lg">
              !
            </span>
            <div>
              <h1 className="font-semibold text-lg text-text-heading">
                {t("pageTitle")}
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                {t("pageDescription")}
              </p>
            </div>
          </div>
          <button
            className="ui-button ui-button-primary"
            onClick={reset}
            type="button"
          >
            {t("retry")}
          </button>
        </section>
      </FeedbackPresence>
    </main>
  );
}
