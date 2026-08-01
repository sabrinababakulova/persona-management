import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { auth } from "~/server/auth";
import { findUsableInvitation } from "~/server/company/invitations";
import { AcceptInviteButton } from "./accept-invite-button";

export const dynamic = "force-dynamic";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const t = await getTranslations("Invite");

  const [session, invitation] = await Promise.all([
    auth(),
    findUsableInvitation(token),
  ]);

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
          {invitation ? (
            <>
              <h1 className="auth-title">{t("title")}</h1>
              <p className="mb-6 text-sm text-text-secondary leading-[1.5]">
                {t("description", { company: invitation.companyName })}
              </p>

              {session?.user ? (
                <AcceptInviteButton token={token} />
              ) : (
                <div className="flex flex-col gap-3">
                  <Link
                    className="ui-button ui-button-primary w-full"
                    href={`/register?invite=${encodeURIComponent(token)}`}
                  >
                    {t("createAccount")}
                  </Link>
                  <Link
                    className="ui-button ui-button-secondary w-full"
                    href={`/login?invite=${encodeURIComponent(token)}`}
                  >
                    {t("signIn")}
                  </Link>
                </div>
              )}
            </>
          ) : (
            <>
              <h1 className="auth-title">{t("invalidTitle")}</h1>
              <p className="mb-6 text-sm text-text-secondary leading-[1.5]">
                {t("invalidDescription")}
              </p>
              <Link
                className="ui-button ui-button-secondary w-full"
                href="/login"
              >
                {t("backToSignIn")}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
