"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AvatarUploader } from "~/app/_components/avatar-uploader";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { CheckIcon } from "~/app/_components/icons";
import { Input } from "~/app/_components/input";
import {
  AnimatePresence,
  LoadingButtonContent,
  motion,
} from "~/app/_components/motion-system";
import { SideMenu } from "~/app/_components/sideMenu";
import { api } from "~/trpc/react";
import { ClosableSection } from "../_components/closable-section";
import { CompanySettingsSection } from "./company-settings-section";

const SECTION_TRANSITION = {
  enter: (direction: number) => ({
    opacity: 0,
    scale: 0.995,
    x: direction * 24,
  }),
  center: {
    opacity: 1,
    scale: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    scale: 0.995,
    x: direction * -18,
  }),
};

type MyProfileClientProps = {
  avatarSrc: string;
  companyName: string;
  initialSection: "my-profile" | "company-settings";
  userCity: string;
  userEmail: string;
  userFullName: string;
};

export function MyProfileClient({
  avatarSrc,
  companyName,
  initialSection,
  userCity,
  userEmail,
  userFullName,
}: MyProfileClientProps) {
  const t = useTranslations("Profile");
  const common = useTranslations("Common");
  const profileMenuItems = [
    { id: "my-profile", label: t("myProfile") },
    { id: "company-settings", label: t("companySettings") },
  ] as const;
  const [activeSectionId, setActiveSectionId] =
    useState<string>(initialSection);
  const [sectionDirection, setSectionDirection] = useState(
    initialSection === "my-profile" ? -1 : 1,
  );
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const changePassword = api.profile.changePassword.useMutation({
    onSuccess: () => {
      setFormError(null);
      setFormMessage(t("passwordChanged"));
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      setFormMessage(null);
      setFormError(error.message);
    },
  });

  const passwordChecks = useMemo(() => {
    const hasMinLength = newPassword.length >= 8;
    const hasSpecialChar = /[^\p{L}\p{N}]/u.test(newPassword);
    const hasUpperCase = /\p{Lu}/u.test(newPassword);

    const checks = [
      { label: t("passwordMin"), passed: hasMinLength },
      { label: t("passwordSpecial"), passed: hasSpecialChar },
      { label: t("passwordUppercase"), passed: hasUpperCase },
    ];

    const passedChecksCount = checks.filter((check) => check.passed).length;
    const score = passedChecksCount / checks.length;

    if (passedChecksCount === checks.length) {
      return {
        checks,
        fillClassName: "bg-success-green",
        fillWidth: "100%",
        strengthLabel: t("strongPassword"),
        strengthLabelClassName: "text-success-green",
      };
    }

    if (passedChecksCount >= 2) {
      return {
        checks,
        fillClassName: "bg-warning-yellow",
        fillWidth: `${Math.max(score * 100, 60)}%`,
        strengthLabel: t("mediumPassword"),
        strengthLabelClassName: "text-warning-yellow",
      };
    }

    return {
      checks,
      fillClassName: "bg-warning-yellow",
      fillWidth: `${Math.max(score * 100, 15)}%`,
      strengthLabel: t("weakPassword"),
      strengthLabelClassName: "text-warning-yellow",
    };
  }, [newPassword, t]);

  const isProfileSectionActive = activeSectionId === "my-profile";
  const isOldPasswordFilled = oldPassword.trim().length > 0;
  const isNewPasswordFilled = newPassword.length > 0;
  const doPasswordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;
  const areNewPasswordChecksComplete = passwordChecks.checks.every(
    (check) => check.passed,
  );
  const canSubmitPasswordChange =
    isOldPasswordFilled &&
    isNewPasswordFilled &&
    doPasswordsMatch &&
    areNewPasswordChecksComplete;
  const hasPasswordDraft = Boolean(
    oldPassword || newPassword || confirmPassword,
  );
  const saveStatus = formError
    ? formError
    : formMessage
      ? formMessage
      : canSubmitPasswordChange
        ? t("readyToSave")
        : hasPasswordDraft
          ? t("completeRequirements")
          : t("fillToUpdate");
  const saveStatusClassName = formError
    ? "text-danger-red"
    : formMessage || canSubmitPasswordChange
      ? "text-success-green"
      : "text-text-secondary";
  const saveIndicatorClassName = formError
    ? "bg-danger-red-bg text-danger-red"
    : formMessage || canSubmitPasswordChange
      ? "bg-success-green-bg text-success-green"
      : "bg-primary-blue-light text-primary-blue";

  const handleSave = () => {
    setFormMessage(null);
    setFormError(null);

    if (!canSubmitPasswordChange) {
      return;
    }

    changePassword.mutate({
      currentPassword: oldPassword,
      newPassword,
      confirmPassword,
    });
  };

  const handleSectionSelect = (sectionId: string) => {
    if (sectionId === activeSectionId) {
      return;
    }

    setSectionDirection(sectionId === "company-settings" ? 1 : -1);
    setActiveSectionId(sectionId);
  };

  return (
    <main className="h-full bg-bg-canvas">
      <div className="app-page flex flex-col gap-5 lg:flex-row lg:gap-8">
        <SideMenu
          activeId={activeSectionId}
          items={profileMenuItems.map((item) => ({ ...item }))}
          onSelect={handleSectionSelect}
        />

        <section className="min-w-0 flex-1">
          <div className="w-full max-w-2xl">
            <Breadcrumbs
              label={t("myProfile")}
              rootHref="/dashboard"
              rootLabel={t("home")}
            />

            <div className="mt-5 flex items-center gap-5">
              <AvatarUploader avatarSrc={avatarSrc} />
              <div className="space-y-2.5">
                <h1 className="page-title">{userFullName}</h1>
                <p className="font-medium text-lg text-text-secondary leading-none">
                  {companyName}
                </p>
              </div>
            </div>

            <div className="mt-8 overflow-x-clip">
              <AnimatePresence
                custom={sectionDirection}
                initial={false}
                mode="wait"
              >
                <motion.div
                  animate="center"
                  custom={sectionDirection}
                  exit="exit"
                  initial="enter"
                  key={activeSectionId}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  variants={SECTION_TRANSITION}
                >
                  {isProfileSectionActive ? (
                    <div className="space-y-5">
                      <div className="surface-card p-5 sm:p-6">
                        <ClosableSection title={t("basicInfo")}>
                          <Input
                            label={t("fullName")}
                            readOnly
                            value={userFullName}
                          />
                          <Input label={t("city")} readOnly value={userCity} />
                          <Input
                            label={t("email")}
                            readOnly
                            value={userEmail}
                          />
                        </ClosableSection>
                      </div>
                      <div className="surface-card p-5 sm:p-6">
                        <ClosableSection title={t("changePassword")}>
                          <Input
                            label={t("currentPassword")}
                            onChange={(event) =>
                              setOldPassword(event.target.value)
                            }
                            placeholder={t("currentPasswordPlaceholder")}
                            type="password"
                            value={oldPassword}
                          />
                          <Input
                            label={t("newPassword")}
                            onChange={(event) =>
                              setNewPassword(event.target.value)
                            }
                            placeholder={t("newPasswordPlaceholder")}
                            type="password"
                            value={newPassword}
                          />

                          {newPassword.length > 0 && (
                            <div className="space-y-2.5">
                              <div className="h-[6px] w-full rounded-xl bg-border-input">
                                <div
                                  className={`h-[6px] rounded-xl ${passwordChecks.fillClassName}`}
                                  style={{ width: passwordChecks.fillWidth }}
                                />
                              </div>
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                  {passwordChecks.checks.map((check) => (
                                    <p
                                      className="font-normal text-text-heading text-xs leading-[1.4]"
                                      key={check.label}
                                    >
                                      <span
                                        className={
                                          check.passed
                                            ? "text-success-green"
                                            : "text-danger-red"
                                        }
                                      >
                                        {check.passed ? "✅" : "❌"}
                                      </span>
                                      <span className="ml-2">
                                        {check.label}
                                      </span>
                                    </p>
                                  ))}
                                </div>
                                <p
                                  className={`pt-[2px] font-semibold text-xs leading-[1.4] ${passwordChecks.strengthLabelClassName}`}
                                >
                                  {passwordChecks.strengthLabel}
                                </p>
                              </div>
                            </div>
                          )}

                          <Input
                            label={t("confirmPassword")}
                            onChange={(event) =>
                              setConfirmPassword(event.target.value)
                            }
                            placeholder={t("newPasswordPlaceholder")}
                            type="password"
                            value={confirmPassword}
                          />

                          <div className="flex flex-col gap-3 border-border-light border-t pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                            <div className="flex min-w-0 items-center gap-3">
                              <motion.span
                                animate={{ scale: [0.96, 1] }}
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${saveIndicatorClassName}`}
                                key={saveIndicatorClassName}
                                transition={{
                                  duration: 0.22,
                                  ease: [0.22, 1, 0.36, 1],
                                }}
                              >
                                {formMessage || canSubmitPasswordChange ? (
                                  <CheckIcon className="h-4 w-4" />
                                ) : (
                                  <span className="h-2 w-2 rounded-full bg-current" />
                                )}
                              </motion.span>

                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-text-heading leading-5">
                                  {t("accountSecurity")}
                                </p>
                                <AnimatePresence initial={false} mode="wait">
                                  <motion.p
                                    animate={{ opacity: 1, y: 0 }}
                                    aria-live="polite"
                                    className={`mt-0.5 text-xs leading-[1.4] ${saveStatusClassName}`}
                                    exit={{ opacity: 0, y: -3 }}
                                    initial={{ opacity: 0, y: 3 }}
                                    key={saveStatus}
                                    transition={{ duration: 0.16 }}
                                  >
                                    {saveStatus}
                                  </motion.p>
                                </AnimatePresence>
                              </div>
                            </div>

                            <button
                              className="ui-button ui-button-primary w-full shrink-0 sm:w-auto"
                              disabled={
                                changePassword.isPending ||
                                !canSubmitPasswordChange
                              }
                              onClick={handleSave}
                              type="button"
                            >
                              <LoadingButtonContent
                                isLoading={changePassword.isPending}
                                label={common("saveChanges")}
                                loadingLabel={common("saving")}
                              />
                            </button>
                          </div>
                        </ClosableSection>
                      </div>
                    </div>
                  ) : (
                    <CompanySettingsSection />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
