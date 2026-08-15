import {
  FormFieldsSkeleton,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "../../_components/page-skeleton";

function CreateCandidateSkeletonContent() {
  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <div className="mb-5 flex items-center justify-between gap-4">
        <SkeletonBlock className="h-9 w-48 max-w-[65%] sm:h-10 sm:w-64" />
        <SkeletonBlock className="h-9 w-24 shrink-0" />
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          <SkeletonBlock className="h-4 w-32 rounded-md" />
          <SkeletonBlock className="h-4 w-20 rounded-md" />
        </div>
        <SkeletonBlock className="h-2 w-full rounded-full" />
      </div>

      <div className="space-y-5">
        <SkeletonCard>
          <div className="flex items-center justify-between gap-4">
            <SkeletonBlock className="h-6 w-28" />
            <SkeletonBlock className="h-10 w-28 shrink-0" />
          </div>
          <SkeletonBlock className="mt-5 h-32 w-full rounded-2xl" />
          <SkeletonBlock className="mt-4 h-4 w-40 rounded-md" />
        </SkeletonCard>

        <SkeletonCard>
          <SkeletonBlock className="mb-6 h-6 w-48" />
          <FormFieldsSkeleton count={4} />
        </SkeletonCard>

        <SkeletonCard>
          <SkeletonBlock className="mb-6 h-6 w-36" />
          <FormFieldsSkeleton count={3} />
        </SkeletonCard>

        <SkeletonCard>
          <SkeletonBlock className="h-6 w-44" />
          <SkeletonBlock className="mt-6 h-28 w-full rounded-2xl" />
        </SkeletonCard>
      </div>

      <SkeletonBlock className="mt-8 h-12 w-full" />
    </div>
  );
}

export function CreateCandidateFormSkeleton() {
  return (
    <div aria-busy="true" className="app-page-narrow">
      <CreateCandidateSkeletonContent />
    </div>
  );
}

export function CreateCandidatePageSkeleton() {
  return (
    <SkeletonPage>
      <CreateCandidateSkeletonContent />
    </SkeletonPage>
  );
}
