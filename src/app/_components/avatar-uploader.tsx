"use client";

import { useRouter } from "next/navigation";
import { ImageUploader } from "~/app/_components/image-uploader";
import { api } from "~/trpc/react";

type AvatarUploaderProps = {
  avatarSrc: string;
};

/**
 * Avatar-specific wrapper around {@link ImageUploader}.
 *
 * Links the uploaded image to the current user via `profile.updateAvatar`, which also removes
 * the previous avatar file. Replacement is intentionally avatar-only — generic image uploads
 * never delete a prior file.
 */
export function AvatarUploader({ avatarSrc }: AvatarUploaderProps) {
  const router = useRouter();

  const updateAvatar = api.profile.updateAvatar.useMutation({
    onSuccess: () => {
      router.refresh();
    },
  });

  return (
    <ImageUploader
      initialImageUrl={avatarSrc}
      onUploaded={async (fileId) => {
        await updateAvatar.mutateAsync({ avatarFileId: fileId });
      }}
      variant="avatar"
    />
  );
}
