import { TRPCError } from "@trpc/server";

export function requireOlxPublisherOwnership(
  publisherUserId: string | null,
  currentUserId: string,
  action: "manage" | "delete",
): void {
  if (!publisherUserId || publisherUserId === currentUserId) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message:
      action === "delete"
        ? "Удалить объявление может только пользователь, подключивший аккаунт olx.uz для этой публикации."
        : "Управлять объявлением может только пользователь, подключивший аккаунт olx.uz для этой публикации.",
  });
}
