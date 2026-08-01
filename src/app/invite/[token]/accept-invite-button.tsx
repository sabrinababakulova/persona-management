"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";
import { api } from "~/trpc/react";

type AcceptInviteButtonProps = {
  token: string;
};

export function AcceptInviteButton({ token }: AcceptInviteButtonProps) {
  const t = useTranslations("Invite");
  const [error, setError] = useState<string | null>(null);

  const acceptInvitation = api.company.acceptInvitation.useMutation({
    onSuccess: () => {
      // Full reload so server-rendered company data (header, profile) is rebuilt.
      window.location.href = "/dashboard";
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  return (
    <div className="flex flex-col gap-3">
      <button
        className="ui-button ui-button-primary w-full"
        disabled={acceptInvitation.isPending || acceptInvitation.isSuccess}
        onClick={() => {
          setError(null);
          acceptInvitation.mutate({ token });
        }}
        type="button"
      >
        <LoadingButtonContent
          isLoading={acceptInvitation.isPending || acceptInvitation.isSuccess}
          label={t("join")}
          loadingLabel={t("joining")}
        />
      </button>

      <FeedbackPresence show={Boolean(error)}>
        <div className="rounded-lg border border-danger-red/20 bg-danger-red-bg px-3 py-2 text-danger-red text-sm">
          {error}
        </div>
      </FeedbackPresence>
    </div>
  );
}
