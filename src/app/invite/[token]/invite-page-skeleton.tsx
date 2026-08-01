import {
  AuthPageSkeleton,
  SkeletonBlock,
} from "../../_components/page-skeleton";

export function InvitePageSkeleton() {
  return (
    <AuthPageSkeleton>
      <SkeletonBlock className="mb-5 h-10 w-64 max-w-full" />
      <SkeletonBlock className="h-4 w-full rounded-md" />
      <SkeletonBlock className="mt-3 h-4 w-4/5 rounded-md" />
      <div className="mt-8 space-y-3">
        <SkeletonBlock className="h-12 w-full" />
        <SkeletonBlock className="h-12 w-full" />
      </div>
    </AuthPageSkeleton>
  );
}
