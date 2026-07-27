import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "~/server/auth";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  const t = await getTranslations("Dashboard");

  if (!session?.user) {
    redirect("/login");
  }

  return <DashboardClient userName={session.user.name ?? t("fallbackUser")} />;
}
