import { AuthPageSkeleton, SkeletonBlock } from "../_components/page-skeleton";

export function ForgotPasswordPageSkeleton() {
  return (
    <AuthPageSkeleton>
      <SkeletonBlock className="mb-4 h-10 w-72 max-w-full" />
      <SkeletonBlock className="mb-8 h-4 w-full rounded-md" />
      <SkeletonBlock className="mb-3 h-3 w-24 rounded-md" />
      <SkeletonBlock className="h-12 w-full" />
      <SkeletonBlock className="mt-5 h-12 w-full" />
      <SkeletonBlock className="mx-auto mt-7 h-4 w-44 rounded-md" />
    </AuthPageSkeleton>
  );
}
