import {
  FormFieldsSkeleton,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "../../../../_components/page-skeleton";

export function PublicationPageSkeleton() {
  return (
    <SkeletonPage>
      <SkeletonBlock className="mb-5 h-4 w-52 rounded-md" />
      <SkeletonBlock className="mb-7 h-10 w-96 max-w-full" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <SkeletonCard>
          <SkeletonBlock className="mb-6 h-6 w-52" />
          <FormFieldsSkeleton count={6} />
          <SkeletonBlock className="mt-6 h-44 w-full" />
          <div className="mt-6 flex justify-end gap-3">
            <SkeletonBlock className="h-12 w-36" />
            <SkeletonBlock className="h-12 w-44" />
          </div>
        </SkeletonCard>
        <SkeletonCard className="h-fit min-h-72">
          <SkeletonBlock className="h-6 w-36" />
          <SkeletonBlock className="mt-6 h-48 w-full rounded-2xl" />
        </SkeletonCard>
      </div>
    </SkeletonPage>
  );
}
