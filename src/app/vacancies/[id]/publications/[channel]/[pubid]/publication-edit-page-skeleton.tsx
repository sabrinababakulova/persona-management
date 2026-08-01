import {
  FormFieldsSkeleton,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "../../../../../_components/page-skeleton";

export function PublicationEditPageSkeleton() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="mb-5 h-4 w-56 rounded-md" />
      <SkeletonBlock className="mb-7 h-10 w-80 max-w-full" />
      <SkeletonCard>
        <SkeletonBlock className="mb-6 h-6 w-48" />
        <FormFieldsSkeleton count={6} />
        <SkeletonBlock className="mt-6 h-44 w-full" />
        <div className="mt-6 flex justify-end gap-3">
          <SkeletonBlock className="h-12 w-36" />
          <SkeletonBlock className="h-12 w-44" />
        </div>
      </SkeletonCard>
    </SkeletonPage>
  );
}
