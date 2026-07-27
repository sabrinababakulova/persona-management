import { useTranslations } from "next-intl";
import { LoadingState } from "./_components/motion-system";

export default function AppLoading() {
  const t = useTranslations("Errors");

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-bg-canvas px-6">
      <LoadingState label={t("pageLoading")} />
    </main>
  );
}
