"use client";

import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ClosableSection } from "~/app/_components/closable-section";
import { CheckIcon, PlusIcon, UsersIcon } from "~/app/_components/icons";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/types/trpc/router-outputs";

type Member = RouterOutputs["company"]["listMembers"][number];

function SkeletonBlock({ className }: { className: string }) {
  return <span className={`block rounded-lg bg-border-light ${className}`} />;
}

function TeamRosterSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-light bg-bg-input">
      <div className="flex items-center gap-3 border-border-light border-b px-4 py-4 sm:px-5">
        <SkeletonBlock className="h-10 w-10 shrink-0 rounded-xl" />
        <SkeletonBlock className="h-4 w-32" />
      </div>

      <div className="divide-y divide-border-light">
        {["member-one", "member-two", "member-three"].map((id, index) => (
          <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5" key={id}>
            <SkeletonBlock className="h-11 w-11 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock
                className={`h-4 ${index === 1 ? "w-36" : "w-44"}`}
              />
              <SkeletonBlock className="h-3 w-52 max-w-[55vw]" />
            </div>
            <SkeletonBlock className="h-6 w-20 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function InvitationManagerSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-light bg-bg-input">
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-3.5 w-full max-w-md" />
          <SkeletonBlock className="h-3.5 w-4/5 max-w-sm" />
        </div>
        <SkeletonBlock className="h-10 w-full shrink-0 rounded-xl sm:w-36" />
      </div>

      <div className="border-border-light border-t px-4 py-4 sm:px-5">
        <SkeletonBlock className="h-4 w-4/5 max-w-md" />
        <div className="mt-3 flex items-center justify-between gap-4">
          <SkeletonBlock className="h-3 w-52 max-w-[55vw]" />
          <SkeletonBlock className="h-7 w-28 shrink-0 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function TeamSectionSkeleton({
  isAdmin,
  label,
}: {
  isAdmin: boolean;
  label: string;
}) {
  return (
    <div aria-live="polite" role="status">
      <span className="sr-only">{label}</span>

      <div
        aria-hidden="true"
        className="animate-pulse space-y-4 motion-reduce:animate-none"
      >
        {isAdmin ? <InvitationManagerSkeleton /> : null}
        <TeamRosterSkeleton />
      </div>
    </div>
  );
}

function InvitationListSkeleton({ label }: { label: string }) {
  return (
    <div
      aria-live="polite"
      className="divide-y divide-border-light"
      role="status"
    >
      <span className="sr-only">{label}</span>
      {["invitation-one", "invitation-two"].map((id) => (
        <div
          aria-hidden="true"
          className="animate-pulse px-4 py-4 motion-reduce:animate-none sm:px-5"
          key={id}
        >
          <SkeletonBlock className="h-4 w-4/5 max-w-md" />
          <div className="mt-3 flex items-center justify-between gap-4">
            <SkeletonBlock className="h-3 w-52 max-w-[55vw]" />
            <SkeletonBlock className="h-7 w-28 shrink-0 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MemberAvatar({ member }: { member: Member }) {
  const [hasImageError, setHasImageError] = useState(false);
  const memberLabel = member.name?.trim() || member.email;
  const initial = Array.from(memberLabel.trim())[0]?.toLocaleUpperCase() ?? "—";

  if (member.avatarUrl && !hasImageError) {
    return (
      <Image
        alt=""
        className="h-11 w-11 shrink-0 rounded-full border border-border-light bg-bg-light object-cover"
        height={44}
        onError={() => setHasImageError(true)}
        src={member.avatarUrl}
        unoptimized
        width={44}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bg-active-menu font-bold text-primary-blue text-sm"
    >
      {initial}
    </span>
  );
}

/** Falls back to a manual selection prompt where the clipboard API is unavailable. */
async function copyToClipboard(value: string) {
  if (!navigator.clipboard) {
    throw new Error("clipboard-unavailable");
  }
  await navigator.clipboard.writeText(value);
}

type CompanyInviteSectionProps = {
  canEditCompany: boolean;
};

export function CompanyInviteSection({
  canEditCompany,
}: CompanyInviteSectionProps) {
  const t = useTranslations("Company");
  const format = useFormatter();
  const utils = api.useUtils();

  const [origin, setOrigin] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // `window` is only available after hydration; links render relative until then.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!copiedId) {
      return;
    }
    const timeout = setTimeout(() => setCopiedId(null), 2000);
    return () => clearTimeout(timeout);
  }, [copiedId]);

  const {
    data: company,
    isLoading: isCompanyLoading,
    error: companyError,
  } = api.company.get.useQuery();
  const {
    data: members,
    isLoading: areMembersLoading,
    error: membersError,
  } = api.company.listMembers.useQuery();

  // Invitation links are company-wide state, so only the admin may list or create them.
  const isAdmin = company?.canEdit ?? false;
  const {
    data: invitations,
    isLoading: areInvitationsLoading,
    error: invitationsError,
  } = api.company.listInvitations.useQuery(undefined, { enabled: isAdmin });
  const isTeamLoading = isCompanyLoading || areMembersLoading;
  const teamLoadError = companyError ?? membersError;

  const createInvitation = api.company.createInvitation.useMutation({
    onSuccess: () => {
      setError(null);
      void utils.company.listInvitations.invalidate();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const revokeInvitation = api.company.revokeInvitation.useMutation({
    onSuccess: () => {
      setError(null);
      void utils.company.listInvitations.invalidate();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const buildInviteUrl = (token: string) => `${origin}/invite/${token}`;

  const handleCopy = async (id: string, token: string) => {
    try {
      await copyToClipboard(buildInviteUrl(token));
      setError(null);
      setCopiedId(id);
    } catch {
      setError(t("copyFailed"));
    }
  };

  return (
    <ClosableSection title={t("team")}>
      {isTeamLoading ? (
        <TeamSectionSkeleton
          isAdmin={canEditCompany}
          label={t("loadingTeam")}
        />
      ) : null}

      {teamLoadError ? (
        <p className="text-danger-red text-sm leading-[1.4]">
          {teamLoadError.message}
        </p>
      ) : null}

      {!isTeamLoading && !teamLoadError && isAdmin ? (
        <div className="overflow-hidden rounded-2xl border border-border-light bg-bg-input">
          <div className="flex flex-col gap-4 bg-bg-input px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="max-w-lg text-sm text-text-secondary leading-5">
              {t("inviteDescription")}
            </p>
            <button
              className="ui-button ui-button-soft w-full shrink-0 sm:w-auto"
              disabled={createInvitation.isPending}
              onClick={() => createInvitation.mutate()}
              type="button"
            >
              <PlusIcon className="h-4 w-4" />
              <LoadingButtonContent
                isLoading={createInvitation.isPending}
                label={t("invitePeople")}
                loadingLabel={t("generatingLink")}
              />
            </button>
          </div>

          {areInvitationsLoading ? (
            <InvitationListSkeleton label={t("loadingInvites")} />
          ) : null}

          {invitationsError ? (
            <p className="border-border-light border-t px-4 py-4 text-danger-red text-sm leading-[1.4] sm:px-5">
              {invitationsError.message}
            </p>
          ) : null}

          {invitations && invitations.length > 0 ? (
            <ul className="divide-y divide-border-light border-border-light border-t">
              {invitations.map((invitation) => (
                <li className="px-4 py-4 sm:px-5" key={invitation.id}>
                  <p className="break-all font-semibold text-sm text-text-heading leading-5">
                    {buildInviteUrl(invitation.token)}
                  </p>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-text-secondary text-xs leading-5">
                      {t("inviteMeta", {
                        date: format.dateTime(new Date(invitation.expiresAt), {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }),
                        uses: invitation.usesCount,
                      })}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        className="ui-button ui-button-soft min-h-8 px-2.5 text-xs"
                        onClick={() =>
                          void handleCopy(invitation.id, invitation.token)
                        }
                        type="button"
                      >
                        {copiedId === invitation.id ? (
                          <span className="flex items-center gap-1.5 text-success-green">
                            <CheckIcon className="h-3.5 w-3.5" />
                            {t("copied")}
                          </span>
                        ) : (
                          t("copyLink")
                        )}
                      </button>
                      <button
                        className="ui-button min-h-8 bg-danger-red-bg px-2.5 text-danger-red text-xs hover:bg-danger-pink-bg disabled:opacity-50"
                        disabled={revokeInvitation.isPending}
                        onClick={() =>
                          revokeInvitation.mutate({ id: invitation.id })
                        }
                        type="button"
                      >
                        {t("revoke")}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {invitations && invitations.length === 0 ? (
            <p className="border-border-light border-t px-4 py-5 text-sm text-text-secondary sm:px-5">
              {t("noInvites")}
            </p>
          ) : null}
        </div>
      ) : null}

      <FeedbackPresence show={Boolean(error)}>
        <p className="text-danger-red text-xs leading-[1.4]">{error}</p>
      </FeedbackPresence>

      {!isTeamLoading && !teamLoadError && members && members.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border-light bg-bg-input">
          <div className="flex items-center justify-between gap-4 border-border-light border-b bg-bg-input px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg-active-menu text-primary-blue">
                <UsersIcon aria-hidden="true" className="h-5 w-5" />
              </span>
              <p className="font-bold text-sm text-text-heading leading-5">
                {t("members", { count: members.length })}
              </p>
            </div>
          </div>

          <ul className="divide-y divide-border-light">
            {members.map((member) => {
              const memberName = member.name?.trim() || member.email;

              return (
                <li
                  className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
                  key={member.id}
                >
                  <MemberAvatar member={member} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-sm text-text-heading leading-5">
                      {memberName}
                    </p>
                    {member.name?.trim() ? (
                      <p className="mt-0.5 truncate text-text-secondary text-xs leading-4">
                        {member.email}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
                    {member.isCurrentUser ? (
                      <span className="font-medium text-text-secondary text-xs">
                        {t("you")}
                      </span>
                    ) : null}
                    <span
                      className={
                        member.isAdmin
                          ? "rounded-full bg-primary-blue-light px-2.5 py-1 font-semibold text-primary-blue text-xs"
                          : "rounded-full bg-bg-panel-hover px-2.5 py-1 font-medium text-text-secondary text-xs"
                      }
                    >
                      {member.isAdmin ? t("roleAdmin") : t("roleMember")}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </ClosableSection>
  );
}
