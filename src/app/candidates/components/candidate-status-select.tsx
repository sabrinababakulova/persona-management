"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { ChevronDownIcon } from "~/app/_components/icons";
import { api } from "~/trpc/react";
import type { RouterInputs } from "~/types/trpc/router-inputs";

type CandidateListInput = NonNullable<RouterInputs["candidates"]["list"]>;

type StatusOption = {
  value: string;
  label: string;
};

type StatusTone = {
  containerClassName: string;
  textClassName: string;
};

const defaultStatusTone: StatusTone = {
  containerClassName: "border border-status-outline-border bg-bg-light",
  textClassName: "text-text-placeholder",
};

const statusToneConfig: Record<string, StatusTone> = {
  new: defaultStatusTone,
  screening: {
    containerClassName: "bg-status-neutral-bg",
    textClassName: "text-status-neutral",
  },
  interview: {
    containerClassName: "bg-status-info-bg",
    textClassName: "text-primary-blue",
  },
  offer: {
    containerClassName: "bg-status-offer-bg",
    textClassName: "text-status-offer",
  },
  hired: {
    containerClassName: "bg-status-active-soft",
    textClassName: "text-status-active-strong",
  },
  rejected: {
    containerClassName: "bg-status-danger-soft",
    textClassName: "text-accent-red",
  },
};

interface CandidateStatusSelectProps {
  candidateId: string;
  candidateName: string;
  status: string;
  statusOptions: StatusOption[];
  listQueryInput?: CandidateListInput;
  onError?: () => void;
  onSuccess?: () => void;
}

export function CandidateStatusSelect({
  candidateId,
  candidateName,
  status,
  statusOptions,
  listQueryInput,
  onError,
  onSuccess,
}: CandidateStatusSelectProps) {
  const t = useTranslations("CandidateDetail");
  const utils = api.useUtils();
  const availableStatusValues = useMemo(
    () => new Set(statusOptions.map((option) => option.value)),
    [statusOptions],
  );
  const statusTone = statusToneConfig[status] ?? defaultStatusTone;

  const updateCandidateStatus = api.candidates.update.useMutation({
    onMutate: async ({ id, status: nextStatus }) => {
      await Promise.all([
        utils.candidates.get.cancel({ id }),
        listQueryInput
          ? utils.candidates.list.cancel(listQueryInput)
          : Promise.resolve(),
      ]);

      const previousCandidate = utils.candidates.get.getData({ id });
      const previousCandidates = listQueryInput
        ? utils.candidates.list.getData(listQueryInput)
        : undefined;

      if (nextStatus && availableStatusValues.has(nextStatus)) {
        if (previousCandidate) {
          utils.candidates.get.setData(
            { id },
            { ...previousCandidate, status: nextStatus },
          );
        }

        if (listQueryInput) {
          utils.candidates.list.setData(listQueryInput, (existing) =>
            existing
              ? {
                  ...existing,
                  items: existing.items.map((candidate) =>
                    candidate.id === id
                      ? { ...candidate, status: nextStatus }
                      : candidate,
                  ),
                }
              : existing,
          );
        }
      }

      return { previousCandidate, previousCandidates };
    },
    onError: (_error, variables, context) => {
      if (context?.previousCandidate) {
        utils.candidates.get.setData(
          { id: variables.id },
          context.previousCandidate,
        );
      }

      if (listQueryInput && context?.previousCandidates) {
        utils.candidates.list.setData(
          listQueryInput,
          context.previousCandidates,
        );
      }

      onError?.();
    },
    onSuccess: () => {
      onSuccess?.();
    },
    onSettled: (_data, _error, variables) => {
      void utils.candidates.get.invalidate({ id: variables.id });
      if (listQueryInput) {
        void utils.candidates.list.invalidate(listQueryInput);
      } else {
        void utils.candidates.list.invalidate();
      }
    },
  });

  const handleStatusChange = (nextStatus: string) => {
    if (!availableStatusValues.has(nextStatus) || nextStatus === status) {
      return;
    }

    updateCandidateStatus.mutate({
      id: candidateId,
      status: nextStatus,
    });
  };

  return (
    <div
      className={`${statusTone.containerClassName} relative inline-flex min-w-[124px] items-center overflow-hidden rounded-lg px-1`}
    >
      <select
        aria-label={t("statusFor", { name: candidateName })}
        className={`h-[32px] w-full ${statusTone.textClassName} appearance-none bg-transparent px-2 pr-6 font-semibold text-xs uppercase leading-none disabled:cursor-not-allowed disabled:opacity-70`}
        disabled={updateCandidateStatus.isPending || statusOptions.length === 0}
        onChange={(event) => handleStatusChange(event.target.value)}
        value={status}
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        className={`pointer-events-none absolute right-2 h-3.5 w-3.5 ${statusTone.textClassName}`}
      />
    </div>
  );
}
