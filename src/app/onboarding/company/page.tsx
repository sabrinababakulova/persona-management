import { eq } from "drizzle-orm";
import Image from "next/image";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { CompanyOnboardingClient } from "./company-onboarding-client";

export const dynamic = "force-dynamic";

/**
 * Where accounts without a company finish signing up.
 *
 * Google sign-ups never pass through the company step of the registration form, so the
 * middleware sends them here before letting them into the app.
 */
export default async function CompanyOnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const [user] = await db
    .select({ companyId: users.companyId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return (
    <div className="auth-layout">
      <div className="auth-art">
        <Image
          alt="Logo"
          className="object-cover"
          fill
          priority
          src="/login-sidebar.svg"
        />
      </div>

      <div className="auth-content">
        <div className="auth-panel">
          {/* A stale session cookie can send an already-onboarded user here; the client
              refreshes the session and moves on instead of bouncing between redirects. */}
          <CompanyOnboardingClient hasCompany={Boolean(user?.companyId)} />
        </div>
      </div>
    </div>
  );
}
