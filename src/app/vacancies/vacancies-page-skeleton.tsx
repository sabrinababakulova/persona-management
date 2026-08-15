import {
  SkeletonBlock,
  SkeletonPage,
  TableRowsSkeleton,
} from "../_components/page-skeleton";

export function VacanciesPageSkeleton() {
  return (
    <SkeletonPage>
      <div className="mb-5 flex items-center gap-3 sm:mb-6 sm:justify-between">
        <SkeletonBlock className="h-9 w-32 sm:h-10 sm:w-52" />
        <SkeletonBlock className="h-10 w-28 sm:w-36" />
      </div>
      <div className="mb-5 flex min-w-0 gap-3">
        <SkeletonBlock className="h-12 flex-1" />
        <SkeletonBlock className="h-12 w-12 shrink-0 sm:h-11 sm:w-11" />
        <SkeletonBlock className="h-12 w-12 shrink-0 sm:h-11 sm:w-11" />
      </div>
      <TableRowsSkeleton count={6} />
    </SkeletonPage>
  );
}
