import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { companies, users } from "~/server/db/schema";
import { getDirectusAssetUrl } from "~/server/storage/directus-storage";
import { MyProfileClient } from "./my-profile-client";

const DEFAULT_AVATAR_SRC =
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Kerim";

export default async function MyProfilePage() {
  const session = await auth();

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

  return (
    <MyProfileClient
      avatarSrc={
        getDirectusAssetUrl(user?.avatarFileId) ??
        user?.image ??
        DEFAULT_AVATAR_SRC
      }
      companyName={companyName}
      userCity="Ташкент"
      userEmail={session.user.email ?? ""}
      userFullName={session.user.name ?? ""}
    />
  );
}
