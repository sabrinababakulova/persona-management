import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { companies, users } from "~/server/db/schema";
import { getDirectusAssetUrl } from "~/server/storage/directus-storage";
import { MyProfileClient } from "./my-profile-client";

type MyProfilePageProps = {
  searchParams?: Promise<{
    section?: string;
  }>;
};

export default async function MyProfilePage({
  searchParams,
}: MyProfilePageProps) {
  const session = await auth();
  const t = await getTranslations("Profile");

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch company name from DB
  let companyName = "";
  const userRows = await db
    .select({
      avatarFileId: users.avatarFileId,
      companyId: users.companyId,
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const user = userRows[0];
  const companyId = user?.companyId;
  if (companyId) {
    const companyRows = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    companyName = companyRows[0]?.name ?? "";
  }

  const resolvedSearchParams = await searchParams;
  const initialSection =
    resolvedSearchParams?.section === "company-settings"
      ? "company-settings"
      : "my-profile";

  return (
    <MyProfileClient
      avatarSrc={getDirectusAssetUrl(user?.avatarFileId) ?? user?.image ?? ""}
      companyName={companyName}
      initialSection={initialSection}
      userCity={t("tashkent")}
      userEmail={session.user.email ?? ""}
      userFullName={session.user.name ?? ""}
    />
  );
}
