import Link from "next/link";
import { getTranslations } from "next-intl/server";

type AuthErrorPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const { error } = await searchParams;
  const t = await getTranslations("AuthError");
  const content =
    error === "AccessDenied"
      ? {
          title: t("accessDeniedTitle"),
          description: t("accessDeniedDescription"),
        }
      : error === "Configuration"
        ? {
            title: t("configurationTitle"),
            description: t("configurationDescription"),
          }
        : error === "Verification"
          ? {
              title: t("verificationTitle"),
              description: t("verificationDescription"),
            }
          : {
              title: t("defaultTitle"),
              description: t("defaultDescription"),
            };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-canvas px-6">
      <div className="surface-card w-full max-w-md p-6 shadow-card-lg sm:p-8">
        <h1 className="page-title">{content.title}</h1>
        <p className="mt-4 text-sm text-text-muted leading-6">
          {content.description}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link className="ui-button ui-button-primary flex-1" href="/login">
            {t("backToLogin")}
          </Link>
          <Link className="ui-button ui-button-soft flex-1" href="/register">
            {t("createAccount")}
          </Link>
        </div>
      </div>
    </div>
  );
}
