import { AuthPageSkeleton, SkeletonBlock } from "../_components/page-skeleton";

export function LoginPageSkeleton() {
  return (
    <AuthPageSkeleton>
      <SkeletonBlock className="mb-4 h-10 w-56 max-w-full" />
      <SkeletonBlock className="mb-8 h-4 w-72 max-w-full rounded-md" />
      <div className="space-y-5">
        <div>
          <SkeletonBlock className="mb-2 h-3 w-20 rounded-md" />
          <SkeletonBlock className="h-12 w-full" />
        </div>
        <div>
          <SkeletonBlock className="mb-2 h-3 w-20 rounded-md" />
          <SkeletonBlock className="h-12 w-full" />
        </div>
        <SkeletonBlock className="h-12 w-full" />
      </div>
      <SkeletonBlock className="mx-auto mt-7 h-4 w-52 rounded-md" />
    </AuthPageSkeleton>
  );
}
