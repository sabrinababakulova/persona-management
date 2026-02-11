import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <DashboardClient />;
}
