"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { ChevronUpIcon } from "~/app/_components/icons";
import { Input } from "~/app/_components/input";
import { SideMenu } from "~/app/_components/sideMenu";
import { api } from "~/trpc/react";

const PROFILE_MENU_ITEMS = [
  { id: "my-profile", label: "Мой профиль" },
  { id: "company-settings", label: "Настройки компании" },
] as const;

type MyProfileClientProps = {
  avatarSrc: string;
  companyName: string;
  userCity: string;
  userEmail: string;
  userFullName: string;
};

export function MyProfileClient({
  avatarSrc,
  companyName,
  userCity,
  userEmail,
  userFullName,
}: MyProfileClientProps) {
  const [activeSectionId, setActiveSectionId] = useState<string>(
    PROFILE_MENU_ITEMS[0].id,
  );
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isBasicInfoOpen, setIsBasicInfoOpen] = useState(true);
  const [isPasswordSectionOpen, setIsPasswordSectionOpen] = useState(true);

  const changePassword = api.profile.changePassword.useMutation({
    onSuccess: (response) => {
      setFormError(null);
      setFormMessage(response.message);
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
      { label: "Состоит из 8 символов", passed: hasMinLength },
      { label: "Содержит специальные символы", passed: hasSpecialChar },
      { label: "Содержит символы верхнего регистра", passed: hasUpperCase },
    ];

    const passedChecksCount = checks.filter((check) => check.passed).length;
    const score = passedChecksCount / checks.length;

    if (passedChecksCount === checks.length) {
      return {
        checks,
        fillClassName: "bg-success-green",
        fillWidth: "100%",
        strengthLabel: "Сильный пароль",
        strengthLabelClassName: "text-success-green",
      };
    }

    if (passedChecksCount >= 2) {
      return {
        checks,
        fillClassName: "bg-warning-yellow",
        fillWidth: `${Math.max(score * 100, 60)}%`,
        strengthLabel: "Средний пароль",
        strengthLabelClassName: "text-warning-yellow",
      };
    }

    return {
      checks,
      fillClassName: "bg-[#DD8D0C]",
      fillWidth: `${Math.max(score * 100, 15)}%`,
      strengthLabel: "Слабый пароль",
      strengthLabelClassName: "text-[#DD8D0C]",
    };
  }, [newPassword]);

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

  return (
    <main className="h-full bg-white">
      <div className="flex w-full gap-[64px] px-6 pt-8 pb-8">
        <SideMenu
          activeId={activeSectionId}
          items={PROFILE_MENU_ITEMS.map((item) => ({ ...item }))}
          onSelect={setActiveSectionId}
        />

        <section className="flex flex-3 flex-col">
          <div className="w-full max-w-[560px]">
            <Breadcrumbs
              label="Мой профиль"
              rootHref="/dashboard"
              rootLabel="Главная"
            />

            <div className="mt-6 flex items-center gap-6">
              <div className="h-[72px] w-[72px] overflow-hidden rounded-full bg-[#CEDBF5]">
                <Image
                  alt="Аватар"
                  className="h-full w-full object-cover"
                  height={72}
                  src={avatarSrc}
                  width={72}
                />
              </div>
              <div className="space-y-[10px]">
                <h1 className="font-bold text-[32px] text-text-heading leading-none tracking-[-0.64px]">
                  {userFullName}
                </h1>
                <p className="font-medium text-[20px] text-text-secondary leading-none tracking-[-0.4px]">
                  {companyName}
                </p>
              </div>
            </div>

            {isProfileSectionActive ? (
              <div className="mt-12 space-y-10">
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-[22px] text-text-heading leading-[1.1] tracking-[-0.44px]">
                      Основная информация
                    </h2>
                    <button
                      aria-expanded={isBasicInfoOpen}
                      aria-label="Свернуть или развернуть основную информацию"
                      className="rounded p-1 text-[#65748A] transition-colors hover:bg-bg-hover"
                      onClick={() => setIsBasicInfoOpen((prev) => !prev)}
                      type="button"
                    >
                      <ChevronUpIcon
                        className={`h-4 w-4 transition-transform ${isBasicInfoOpen ? "rotate-0" : "rotate-180"}`}
                      />
                    </button>
                  </div>
                  {isBasicInfoOpen && (
                    <div className="space-y-4">
                      <Input label="Ф.И.О" readOnly value={userFullName} />
                      <Input label="Город" readOnly value={userCity} />
                      <Input
                        label="Электронная почта"
                        readOnly
                        value={userEmail}
                      />
                    </div>
                  )}
                </section>

                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-[22px] text-text-heading leading-[1.1] tracking-[-0.44px]">
                      Изменить пароль
                    </h2>
                    <button
                      aria-expanded={isPasswordSectionOpen}
                      aria-label="Свернуть или развернуть смену пароля"
                      className="rounded p-1 text-[#65748A] transition-colors hover:bg-bg-hover"
                      onClick={() => setIsPasswordSectionOpen((prev) => !prev)}
                      type="button"
                    >
                      <ChevronUpIcon
                        className={`h-4 w-4 transition-transform ${isPasswordSectionOpen ? "rotate-0" : "rotate-180"}`}
                      />
                    </button>
                  </div>
                  {isPasswordSectionOpen && (
                    <div className="space-y-4">
                      <Input
                        label="Введите старый пароль"
                        onChange={(event) => setOldPassword(event.target.value)}
                        placeholder="Ваш старый пароль"
                        type="password"
                        value={oldPassword}
                      />
                      <Input
                        label="Введите новый пароль"
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="Ваш новый пароль"
                        type="password"
                        value={newPassword}
                      />

                      {newPassword.length > 0 && (
                        <div className="space-y-[10px]">
                          <div className="h-[6px] w-full rounded-[10px] bg-border-input">
                            <div
                              className={`h-[6px] rounded-[10px] ${passwordChecks.fillClassName}`}
                              style={{ width: passwordChecks.fillWidth }}
                            />
                          </div>
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              {passwordChecks.checks.map((check) => (
                                <p
                                  className="font-normal text-[12px] text-text-heading leading-[1.4] tracking-[-0.24px]"
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
                                  <span className="ml-2">{check.label}</span>
                                </p>
                              ))}
                            </div>
                            <p
                              className={`pt-[2px] font-semibold text-[12px] leading-[1.4] tracking-[-0.24px] ${passwordChecks.strengthLabelClassName}`}
                            >
                              {passwordChecks.strengthLabel}
                            </p>
                          </div>
                        </div>
                      )}

                      <Input
                        label="Повторите новый пароль"
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        placeholder="Ваш новый пароль"
                        type="password"
                        value={confirmPassword}
                      />
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <section className="mt-12 rounded-[8px] border border-border-input bg-bg-input p-6">
                <h2 className="font-semibold text-[22px] text-text-heading leading-[1.1] tracking-[-0.44px]">
                  Настройки компании
                </h2>
                <p className="mt-3 text-[16px] text-text-secondary leading-[1.4] tracking-[-0.32px]">
                  Раздел находится в разработке.
                </p>
              </section>
            )}
          </div>

          <div className="sticky bottom-0 z-10 mt-12 border-border-input border-t bg-[rgba(255,255,255,0.9)] py-4 backdrop-blur-[10px]">
            <div className="flex w-full max-w-[558px] justify-end">
              {isProfileSectionActive && (
                <div className="flex flex-col items-end gap-2">
                  {formError && (
                    <p className="text-[13px] text-danger-red leading-[1.4]">
                      {formError}
                    </p>
                  )}
                  {formMessage && (
                    <p className="text-[13px] text-success-green leading-[1.4]">
                      {formMessage}
                    </p>
                  )}
                  <button
                    className="h-10 rounded-[6px] bg-primary-blue-light px-4 font-semibold text-[16px] text-primary-blue leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-light-hover disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      changePassword.isPending || !canSubmitPasswordChange
                    }
                    onClick={handleSave}
                    type="button"
                  >
                    {changePassword.isPending
                      ? "Сохранение..."
                      : "Сохранить изменения"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
