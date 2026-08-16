import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function OlxConnectorPrivacyPage() {
  const t = await getTranslations("OlxConnectorPrivacy");

  const sections = [
    {
      title: t("collected.title"),
      body: t("collected.body"),
    },
    {
      title: t("notCollected.title"),
      body: t("notCollected.body"),
    },
    {
      title: t("use.title"),
      body: t("use.body"),
    },
    {
      title: t("security.title"),
      body: t("security.body"),
    },
    {
      title: t("control.title"),
      body: t("control.body"),
    },
  ];

  return (
    <main className="min-h-screen bg-bg-canvas px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto w-full max-w-3xl">
        <Link className="inline-flex" href="/login">
          <Image
            alt="Talanty"
            height={44}
            priority
            src="/talanty-mark.svg"
            width={44}
          />
        </Link>

        <div className="surface-card mt-8 p-6 shadow-card-lg sm:p-10">
          <p className="font-semibold text-primary-blue text-sm">
            {t("eyebrow")}
          </p>
          <h1 className="page-title mt-2">{t("title")}</h1>
          <p className="mt-4 max-w-2xl text-sm text-text-secondary leading-6">
            {t("intro")}
          </p>
          <p className="mt-3 text-text-placeholder text-xs">{t("updated")}</p>

          <div className="mt-8 divide-y divide-border-input border-border-input border-y">
            {sections.map((section) => (
              <section className="py-6" key={section.title}>
                <h2 className="font-semibold text-base text-text-heading">
                  {section.title}
                </h2>
                <p className="mt-2 text-sm text-text-secondary leading-6">
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          <section className="pt-6">
            <h2 className="font-semibold text-base text-text-heading">
              {t("contact.title")}
            </h2>
            <p className="mt-2 text-sm text-text-secondary leading-6">
              {t("contact.body")}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
