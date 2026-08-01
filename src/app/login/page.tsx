import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import {
  buildInvitePath,
  isInvitationTokenValid,
} from "~/shared/invitation-token";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{ invite?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const inviteToken = (await searchParams)?.invite;
  const hasInvite = Boolean(inviteToken && isInvitationTokenValid(inviteToken));

  if (session?.user) {
    redirect(
      hasInvite && inviteToken ? buildInvitePath(inviteToken) : "/dashboard",
    );
  }

  return <LoginForm />;
}
