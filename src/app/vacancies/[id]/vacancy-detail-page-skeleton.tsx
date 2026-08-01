import {
  FormFieldsSkeleton,
  SKELETON_KEYS,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "../../_components/page-skeleton";

export function VacancyDetailPageSkeleton() {
  return (
    <SkeletonPage>
      <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
        <SkeletonCard className="h-fit w-full lg:w-64">
          <SkeletonBlock className="h-5 w-32" />
          <div className="mt-5 space-y-3">
            {SKELETON_KEYS.slice(0, 4).map((key) => (
              <SkeletonBlock className="h-11 w-full" key={`menu-${key}`} />
            ))}
          </div>
        </SkeletonCard>
        <SkeletonCard className="min-w-0 flex-1">
          <SkeletonBlock className="mb-4 h-4 w-48 rounded-md" />
          <SkeletonBlock className="mb-7 h-10 w-80 max-w-full" />
          <FormFieldsSkeleton count={6} />
          <SkeletonBlock className="mt-6 h-40 w-full" />
        </SkeletonCard>
      </div>
    </SkeletonPage>
  );
}
