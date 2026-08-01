"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Dropdown } from "~/app/_components/dropdown";
import { Modal } from "~/app/_components/modal";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";
import {
  COMPANY_ROLE_ADMIN,
  COMPANY_ROLE_MEMBER,
  type CompanyRole,
  isCompanyRole,
} from "~/shared/company-roles";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/types/trpc/router-outputs";

type Member = RouterOutputs["company"]["listMembers"][number];

type MemberManagerModalProps = {
  member: Member | null;
  onClose: () => void;
};

/**
 * Master-account controls for one colleague: change their role, or remove/restore their access.
 *
 * The removal confirmation replaces the modal body instead of stacking a second dialog, so the
 * destructive step always needs a deliberate second click.
 */
export function MemberManagerModal({
  member,
  onClose,
}: MemberManagerModalProps) {
  const t = useTranslations("Company");
  const common = useTranslations("Common");
  const utils = api.useUtils();

  const [role, setRole] = useState<CompanyRole>(COMPANY_ROLE_MEMBER);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed whenever a different member is opened.
  useEffect(() => {
    if (member) {
      setRole(isCompanyRole(member.role) ? member.role : COMPANY_ROLE_MEMBER);
      setIsConfirmingRemoval(false);
      setError(null);
    }
  }, [member]);

  const refreshTeam = () => {
    void utils.company.listMembers.invalidate();
    void utils.company.get.invalidate();
  };

  const updateRole = api.company.updateMemberRole.useMutation({
    onSuccess: () => {
      refreshTeam();
      onClose();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const setActive = api.company.setMemberActive.useMutation({
    onSuccess: () => {
      refreshTeam();
      onClose();
    },
    onError: (mutationError) => {
      setIsConfirmingRemoval(false);
      setError(mutationError.message);
    },
  });

  const isPending = updateRole.isPending || setActive.isPending;
  const memberName = member?.name?.trim() || member?.email || "";
  const hasRoleChanged = member ? role !== member.role : false;

  return (
    <Modal
      description={member?.email}
      isOpen={Boolean(member)}
      maxWidthClassName="max-w-[460px]"
      onClose={() => {
        if (!isPending) {
          onClose();
        }
      }}
      title={isConfirmingRemoval ? t("removeMemberTitle") : memberName}
    >
      {member ? (
        <div className="space-y-5">
          {isConfirmingRemoval ? (
            <>
              <p className="text-sm text-text-secondary leading-[1.5]">
                {t("removeMemberWarning", { name: memberName })}
              </p>

              <FeedbackPresence show={Boolean(error)}>
                <p className="text-danger-red text-xs leading-[1.4]">{error}</p>
              </FeedbackPresence>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  className="ui-button ui-button-secondary w-full sm:w-auto"
                  disabled={isPending}
                  onClick={() => setIsConfirmingRemoval(false)}
                  type="button"
                >
                  {common("no")}
                </button>
                <button
                  className="ui-button w-full bg-danger-red text-bg-light hover:opacity-90 disabled:opacity-60 sm:w-auto"
                  disabled={isPending}
                  onClick={() =>
                    setActive.mutate({ userId: member.id, isActive: false })
                  }
                  type="button"
                >
                  <LoadingButtonContent
                    isLoading={setActive.isPending}
                    label={common("yes")}
                    loadingLabel={common("working")}
                  />
                </button>
              </div>
            </>
          ) : (
            <>
              {member.isActive ? null : (
                <p className="rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm text-text-secondary leading-[1.4]">
                  {t("memberDeactivatedNotice")}
                </p>
              )}

              <Dropdown
                disabled={isPending || !member.isActive}
                label={t("memberRole")}
                onChange={(value) => {
                  if (isCompanyRole(value)) {
                    setError(null);
                    setRole(value);
                  }
                }}
                options={[
                  { value: COMPANY_ROLE_ADMIN, label: t("roleAdmin") },
                  { value: COMPANY_ROLE_MEMBER, label: t("roleMember") },
                ]}
                value={role}
              />

              <p className="text-text-secondary text-xs leading-[1.4]">
                {role === COMPANY_ROLE_ADMIN
                  ? t("roleAdminHint")
                  : t("roleMemberHint")}
              </p>

              <FeedbackPresence show={Boolean(error)}>
                <p className="text-danger-red text-xs leading-[1.4]">{error}</p>
              </FeedbackPresence>

              <div className="flex flex-col gap-3 border-border-light border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                {member.isActive ? (
                  <button
                    className="ui-button bg-danger-red-bg text-danger-red hover:bg-danger-pink-bg disabled:opacity-50"
                    disabled={isPending}
                    onClick={() => {
                      setError(null);
                      setIsConfirmingRemoval(true);
                    }}
                    type="button"
                  >
                    {t("removeMember")}
                  </button>
                ) : (
                  <button
                    className="ui-button ui-button-soft"
                    disabled={isPending}
                    onClick={() =>
                      setActive.mutate({ userId: member.id, isActive: true })
                    }
                    type="button"
                  >
                    <LoadingButtonContent
                      isLoading={setActive.isPending}
                      label={t("restoreMember")}
                      loadingLabel={common("working")}
                    />
                  </button>
                )}

                <button
                  className="ui-button ui-button-primary w-full sm:w-auto"
                  disabled={isPending || !hasRoleChanged || !member.isActive}
                  onClick={() => updateRole.mutate({ userId: member.id, role })}
                  type="button"
                >
                  <LoadingButtonContent
                    isLoading={updateRole.isPending}
                    label={common("saveChanges")}
                    loadingLabel={common("saving")}
                  />
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
