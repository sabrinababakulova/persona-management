/** Result of attempting to delete one Telegram message. */
export type TelegramDeletionOutcome = {
  /** The message URL the attempt targeted. */
  url: string;
  /** A user-facing failure description, or `null` when the delete succeeded. */
  error: string | null;
};

export type TelegramDeletionSummary = {
  /** URLs whose messages are confirmed gone from Telegram. */
  deletedUrls: string[];
  /** Failure descriptions, one per message still live in Telegram. */
  errors: string[];
  /** True only when every message was removed. */
  isComplete: boolean;
};

/**
 * Splits delete attempts into what actually succeeded and what did not.
 *
 * Deleting a publication's messages is not atomic — each one is a separate
 * Telegram call, and a run can leave some removed and some live. Deactivation
 * may only be treated as done when {@link TelegramDeletionSummary.isComplete}
 * holds; otherwise the caller must drop just the `deletedUrls` rows and report
 * the failures, so a retry re-attempts only messages that are still there.
 */
export function summarizeTelegramDeletion(
  outcomes: TelegramDeletionOutcome[],
): TelegramDeletionSummary {
  const deletedUrls: string[] = [];
  const errors: string[] = [];

  for (const outcome of outcomes) {
    if (outcome.error === null) {
      deletedUrls.push(outcome.url);
    } else {
      errors.push(outcome.error);
    }
  }

  return { deletedUrls, errors, isComplete: errors.length === 0 };
}
