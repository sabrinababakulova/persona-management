import {
  FormFieldsSkeleton,
  SkeletonBlock,
  SkeletonCard,
  SkeletonPage,
} from "../../_components/page-skeleton";

function CreateCandidateSkeletonContent() {
  return (
    <>
      <SkeletonBlock className="mb-4 h-4 w-48 rounded-md" />
      <SkeletonBlock className="mb-7 h-10 w-72 max-w-full" />

      <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
        <SkeletonCard>
          <SkeletonBlock className="mb-6 h-6 w-44" />
          <FormFieldsSkeleton count={6} />
          <SkeletonBlock className="mt-6 h-32 w-full" />
          <SkeletonBlock className="mt-6 ml-auto h-12 w-40" />
        </SkeletonCard>
        <SkeletonCard className="min-h-72">
          <SkeletonBlock className="h-6 w-36" />
          <SkeletonBlock className="mt-6 h-44 w-full rounded-2xl" />
        </SkeletonCard>
      </div>
    </>
  );
}

export function CreateCandidateFormSkeleton() {
  return (
    <div aria-busy="true" className="app-page">
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
