"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ClosableSection } from "~/app/_components/closable-section";
import { CheckIcon, PlusIcon } from "~/app/_components/icons";
import {
  FeedbackPresence,
  LoadingButtonContent,
  LoadingState,
} from "~/app/_components/motion-system";
import { api } from "~/trpc/react";

/** Falls back to a manual selection prompt where the clipboard API is unavailable. */
async function copyToClipboard(value: string) {
  if (!navigator.clipboard) {
    throw new Error("clipboard-unavailable");
  }
  await navigator.clipboard.writeText(value);
}

export function CompanyInviteSection() {
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
    data: invitations,
    isLoading,
    error: loadError,
  } = api.company.listInvitations.useQuery();
  const { data: members } = api.company.listMembers.useQuery();

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
      <p className="text-sm text-text-secondary leading-[1.4]">
        {t("inviteDescription")}
      </p>

      {isLoading ? <LoadingState compact label={t("loadingInvites")} /> : null}

      {loadError && (
        <p className="text-danger-red text-sm leading-[1.4]">
          {loadError.message}
        </p>
      )}

      {invitations && invitations.length > 0 && (
        <div className="space-y-2">
          {invitations.map((invitation) => (
            <div
              className="space-y-2 rounded-lg border border-border-input bg-bg-input px-3 py-3"
              key={invitation.id}
            >
              <p className="break-all font-medium text-sm text-text-heading">
                {buildInviteUrl(invitation.token)}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-text-secondary text-xs">
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
                    className="rounded px-2 py-1 font-semibold text-primary-blue text-xs transition-colors hover:bg-primary-blue-light"
                    onClick={() =>
                      void handleCopy(invitation.id, invitation.token)
                    }
                    type="button"
                  >
                    {copiedId === invitation.id ? (
                      <span className="flex items-center gap-1 text-success-green">
                        <CheckIcon className="h-3.5 w-3.5" />
                        {t("copied")}
                      </span>
                    ) : (
                      t("copyLink")
                    )}
                  </button>
                  <button
                    className="rounded px-2 py-1 text-danger-red text-xs transition-colors hover:bg-danger-red-bg disabled:opacity-50"
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
            </div>
          ))}
        </div>
      )}

      {invitations && invitations.length === 0 && (
        <p className="text-sm text-text-secondary">{t("noInvites")}</p>
      )}

      <FeedbackPresence show={Boolean(error)}>
        <p className="text-danger-red text-xs leading-[1.4]">{error}</p>
      </FeedbackPresence>

      <button
        className="ui-button ui-button-soft"
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

      {members && members.length > 0 && (
        <div className="space-y-2 border-border-light border-t pt-4">
          <p className="font-semibold text-sm text-text-heading leading-5">
            {t("members", { count: members.length })}
          </p>
          <ul className="space-y-1">
            {members.map((member) => (
              <li
                className="flex items-center justify-between gap-3 text-sm"
                key={member.id}
              >
                <span className="min-w-0 truncate text-text-heading">
                  {member.name ?? member.email}
                </span>
                <span className="shrink-0 text-text-secondary text-xs">
                  {member.isCurrentUser ? t("you") : member.email}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ClosableSection>
  );
}
