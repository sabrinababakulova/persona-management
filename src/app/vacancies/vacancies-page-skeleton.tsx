import {
  SkeletonBlock,
  SkeletonPage,
  TableRowsSkeleton,
} from "../_components/page-skeleton";

export function VacanciesPageSkeleton() {
  return (
    <SkeletonPage>
      <div className="mb-6 flex items-center justify-between gap-4">
        <SkeletonBlock className="h-10 w-52" />
        <SkeletonBlock className="h-10 w-36" />
      </div>
      <div className="mb-5 flex gap-3">
        <SkeletonBlock className="h-12 flex-1" />
        <SkeletonBlock className="h-12 w-36" />
      </div>
      <TableRowsSkeleton count={6} />
    </SkeletonPage>
  );
}
