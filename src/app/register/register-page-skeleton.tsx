import {
  AuthPageSkeleton,
  SKELETON_KEYS,
  SkeletonBlock,
} from "../_components/page-skeleton";

export function RegisterPageSkeleton() {
  return (
    <AuthPageSkeleton>
      <div className="mb-7 flex gap-2">
        {SKELETON_KEYS.slice(0, 3).map((key) => (
          <SkeletonBlock
            className="h-2 flex-1 rounded-full"
            key={`step-${key}`}
          />
        ))}
      </div>
      <SkeletonBlock className="mb-4 h-10 w-64 max-w-full" />
      <SkeletonBlock className="mb-8 h-4 w-72 max-w-full rounded-md" />
      <div className="space-y-5">
        {SKELETON_KEYS.slice(0, 3).map((key) => (
          <div key={`field-${key}`}>
            <SkeletonBlock className="mb-2 h-3 w-24 rounded-md" />
            <SkeletonBlock className="h-12 w-full" />
          </div>
        ))}
        <SkeletonBlock className="h-12 w-full" />
      </div>
    </AuthPageSkeleton>
  );
}
