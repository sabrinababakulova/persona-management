"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Breadcrumbs } from "~/app/_components/Breadcrumbs";
import { PencilIcon } from "~/app/_components/icons";
import { Input } from "~/app/_components/input";
import { SideMenu } from "~/app/_components/sideMenu";
import { api } from "~/trpc/react";
import { ClosableSection } from "../_components/closable-section";
import { CompanySettingsSection } from "./company-settings-section";

const PROFILE_MENU_ITEMS = [
  { id: "my-profile", label: "Мой профиль" },
  { id: "company-settings", label: "Настройки компании" },
] as const;

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
  const router = useRouter();
  const [activeSectionId, setActiveSectionId] =
    useState<string>(initialSection);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentAvatarSrc, setCurrentAvatarSrc] = useState(avatarSrc);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const updateAvatar = api.profile.updateAvatar.useMutation({
    onSuccess: (data) => {
      setCurrentAvatarSrc(data.imageUrl);
      router.refresh();
    },
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setFormError("Допустимые форматы: JPEG, PNG, WebP, GIF");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError("Максимальный размер файла — 5 МБ");
      return;
    }

    setAvatarUploading(true);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        fileId?: string;
      } | null;

      if (!res.ok) {
        throw new Error(payload?.error ?? "Не удалось загрузить файл");
      }

      if (!payload?.fileId) {
        throw new Error("Сервер не вернул идентификатор аватара");
      }

      await updateAvatar.mutateAsync({ avatarFileId: payload.fileId });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Не удалось загрузить аватар",
      );
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  };

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
              <button
                className="group relative h-[72px] w-[72px] overflow-hidden rounded-full bg-[#CEDBF5] focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
                title="Изменить аватар"
                type="button"
              >
                <Image
                  alt="Аватар"
                  className="h-full w-full object-cover"
                  height={72}
                  src={currentAvatarSrc}
                  width={72}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                  <PencilIcon className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <input
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => void handleAvatarChange(e)}
                  ref={avatarInputRef}
                  type="file"
                />
              </button>
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
                <ClosableSection title="Основная информация">
                  <Input label="Ф.И.О" readOnly value={userFullName} />
                  <Input label="Город" readOnly value={userCity} />
                  <Input label="Электронная почта" readOnly value={userEmail} />
                </ClosableSection>
                <ClosableSection title="Изменить пароль">
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
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Ваш новый пароль"
                    type="password"
                    value={confirmPassword}
                  />
                </ClosableSection>
              </div>
            ) : (
              <CompanySettingsSection />
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
