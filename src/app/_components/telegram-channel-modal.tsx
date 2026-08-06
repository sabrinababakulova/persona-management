"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "~/app/_components/input";
import { Modal } from "~/app/_components/modal";
import type { TelegramDeliveryMode } from "~/server/db/schema";
import { api } from "~/trpc/react";
import { resolveTrpcError } from "~/utils/trpc-error";
import { CloseIcon, PlusIcon } from "./icons";
import { FeedbackPresence, LoadingButtonContent } from "./motion-system";

export type ChannelAdminDraft = {
  /**
   * Stable per-row identity for React.
   *
   * Rows can be blank and can be removed from the middle, so the array index is
   * not usable as a key — removing one would shift every later row's input
   * state onto its neighbour.
   */
  key: string;
  username: string;
  name: string;
  /** Present for admins already saved; drives the activation badge. */
  isActivated?: boolean;
};

export type ChannelDraft = {
  id?: string;
  channelId: string;
  label: string;
  deliveryMode: TelegramDeliveryMode;
  admins: ChannelAdminDraft[];
};

const EMPTY_DRAFT: ChannelDraft = {
  channelId: "",
  label: "",
  deliveryMode: "direct",
  admins: [],
};

type TelegramChannelModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Provided when editing; omit to add a new channel. */
  initialValue?: ChannelDraft;
};

/**
 * Add/edit form for a Telegram channel and the people who publish to it.
 *
 * The channel lookup is deliberately manual: it calls Telegram, so firing it on
 * every keystroke would rate-limit the bot. It is also optional — it only fills
 * in the preview, and saving works without it.
 */
export function TelegramChannelModal({
  isOpen,
  onClose,
  initialValue,
}: TelegramChannelModalProps) {
  const t = useTranslations("Integrations");
  const utils = api.useUtils();
  const [draft, setDraft] = useState<ChannelDraft>(initialValue ?? EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(draft.id);

  const lookup = api.integrations.lookupTelegramChannel.useMutation({
    onError: () => undefined,
  });

  const handleSaved = async () => {
    setError(null);
    await utils.integrations.getTelegramChannels.invalidate();
    setDraft(EMPTY_DRAFT);
    lookup.reset();
    onClose();
  };

  const onSaveError = (mutationError: unknown) => {
    setError(resolveTrpcError(mutationError).message ?? t("channelNotFound"));
  };

  const addChannel = api.integrations.addTelegramChannel.useMutation({
    onSuccess: handleSaved,
    onError: onSaveError,
  });
  const updateChannel = api.integrations.updateTelegramChannel.useMutation({
    onSuccess: handleSaved,
    onError: onSaveError,
  });

  const isSaving = addChannel.isPending || updateChannel.isPending;

  const hasFilledAdmin = draft.admins.some((admin) => admin.username.trim());
  const isMissingAdmins = draft.deliveryMode === "admins" && !hasFilledAdmin;

  const setAdmin = (index: number, patch: Partial<ChannelAdminDraft>) => {
    setDraft((current) => ({
      ...current,
      admins: current.admins.map((admin, position) =>
        position === index ? { ...admin, ...patch } : admin,
      ),
    }));
  };

  const handleSubmit = () => {
    const channelId = draft.channelId.trim();
    if (!channelId) {
      setError(t("channelRequired"));
      return;
    }

    // Blank rows are the natural result of "add row then change your mind";
    // dropping them silently is friendlier than failing validation.
    const admins = draft.admins
      .filter((admin) => admin.username.trim())
      .map((admin) => ({
        username: admin.username.trim(),
        name: admin.name.trim() || undefined,
      }));

    if (draft.deliveryMode === "admins" && admins.length === 0) {
      setError(t("adminsRequired"));
      return;
    }

    setError(null);
    const payload = {
      channelId,
      label: draft.label.trim() || undefined,
      deliveryMode: draft.deliveryMode,
      admins,
    };

    if (draft.id) {
      updateChannel.mutate({ ...payload, id: draft.id });
    } else {
      addChannel.mutate(payload);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      maxWidthClassName="max-w-[560px]"
      onClose={onClose}
      title={isEditing ? t("channelModalEditTitle") : t("channelModalTitle")}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label={t("channelId")}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  channelId: event.target.value,
                }));
                lookup.reset();
              }}
              placeholder={t("channelIdPlaceholder")}
              value={draft.channelId}
            />
          </div>
          <button
            className="ui-button ui-button-soft mb-0.5 shrink-0"
            disabled={lookup.isPending || !draft.channelId.trim()}
            onClick={() => lookup.mutate({ channelId: draft.channelId.trim() })}
            type="button"
          >
            <LoadingButtonContent
              isLoading={lookup.isPending}
              label={t("channelCheck")}
              loadingLabel={t("channelChecking")}
            />
          </button>
        </div>

        <FeedbackPresence show={Boolean(lookup.data ?? lookup.error)}>
          {lookup.data ? (
            <div className="rounded-lg border border-success-green/20 bg-success-green-bg px-3 py-2 text-xs">
              <p className="font-medium text-success-green">
                {t("channelFound", {
                  title: lookup.data.title ?? draft.channelId,
                  count: lookup.data.memberCount ?? 0,
                })}
              </p>
              <p className="mt-0.5 text-text-secondary">
                {lookup.data.canPost ? t("botCanPost") : t("botCannotPost")}
              </p>
            </div>
          ) : (
            <p className="text-danger-red text-xs">{t("channelNotFound")}</p>
          )}
        </FeedbackPresence>

        <Input
          label={t("optionalName")}
          onChange={(event) =>
            setDraft((current) => ({ ...current, label: event.target.value }))
          }
          placeholder={t("channelNamePlaceholder")}
          value={draft.label}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium text-sm text-text-heading">
            {t("deliveryMode")}
          </legend>
          {(["direct", "admins"] as const).map((mode) => (
            <label
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                draft.deliveryMode === mode
                  ? "border-primary-blue bg-primary-blue/5"
                  : "border-border-input hover:bg-bg-hover"
              }`}
              key={mode}
            >
              <input
                checked={draft.deliveryMode === mode}
                className="mt-1"
                name="deliveryMode"
                onChange={() =>
                  setDraft((current) => ({ ...current, deliveryMode: mode }))
                }
                type="radio"
                value={mode}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-sm text-text-heading">
                  {mode === "direct"
                    ? t("deliveryDirect")
                    : t("deliveryAdmins")}
                </span>
                <span className="text-text-secondary text-xs leading-4">
                  {mode === "direct"
                    ? t("deliveryDirectHint")
                    : t("deliveryAdminsHint")}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-sm text-text-heading">
              {t("admins")}
            </p>
            <button
              className="inline-flex items-center gap-1 text-primary-blue text-xs hover:underline"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  admins: [
                    ...current.admins,
                    { key: crypto.randomUUID(), username: "", name: "" },
                  ],
                }))
              }
              type="button"
            >
              <PlusIcon className="h-3 w-3" />
              {t("addAdmin")}
            </button>
          </div>

          <p className="text-text-secondary text-xs leading-4">
            {t("adminsHint")}
          </p>

          {draft.admins.length === 0 ? (
            <p className="text-sm text-text-placeholder">{t("noAdmins")}</p>
          ) : (
            draft.admins.map((admin, index) => (
              <div
                className="flex items-start gap-2 rounded-lg border border-border-input p-2"
                key={admin.key}
              >
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <Input
                    label={t("adminUsername")}
                    onChange={(event) =>
                      setAdmin(index, { username: event.target.value })
                    }
                    placeholder={t("adminUsernamePlaceholder")}
                    value={admin.username}
                  />
                  <Input
                    label={t("adminName")}
                    onChange={(event) =>
                      setAdmin(index, { name: event.target.value })
                    }
                    placeholder={t("adminNamePlaceholder")}
                    value={admin.name}
                  />
                  {admin.isActivated !== undefined ? (
                    <p
                      className={`text-xs sm:col-span-2 ${admin.isActivated ? "text-success-green" : "text-warning-yellow"}`}
                    >
                      {admin.isActivated
                        ? t("adminActivated")
                        : t("adminNotActivated")}
                    </p>
                  ) : null}
                </div>
                <button
                  aria-label={t("removeAdmin")}
                  className="mt-6 shrink-0 rounded p-1 text-text-placeholder transition-colors hover:bg-danger-red-bg hover:text-danger-red"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      admins: current.admins.filter(
                        (_, position) => position !== index,
                      ),
                    }))
                  }
                  type="button"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <FeedbackPresence show={Boolean(error)}>
          <p className="text-danger-red text-xs leading-[1.4]">{error}</p>
        </FeedbackPresence>

        <div className="flex justify-end gap-2">
          <button
            className="ui-button ui-button-soft"
            onClick={onClose}
            type="button"
          >
            {t("cancel")}
          </button>
          <button
            className="ui-button ui-button-primary"
            disabled={isSaving || isMissingAdmins}
            onClick={handleSubmit}
            type="button"
          >
            <LoadingButtonContent
              isLoading={isSaving}
              label={t("save")}
              loadingLabel={t("saving")}
            />
          </button>
        </div>
      </div>
    </Modal>
  );
}
