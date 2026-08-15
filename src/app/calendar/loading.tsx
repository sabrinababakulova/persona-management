import { SkeletonBlock } from "../_components/page-skeleton";

export default function RecruiterCalendarLoading() {
  return (
    <main
      aria-busy="true"
      className="h-full min-h-0 flex-1 overflow-hidden bg-bg-light"
    >
      <section className="flex h-full min-h-0 flex-col">
        <header className="flex flex-col gap-4 border-border-light border-b px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <SkeletonBlock className="h-8 w-40" />
          <div className="flex min-w-0 items-center gap-2">
            <SkeletonBlock className="h-9 w-20" />
            <SkeletonBlock className="h-9 w-9 shrink-0" />
            <SkeletonBlock className="h-9 w-9 shrink-0" />
            <SkeletonBlock className="h-6 min-w-0 flex-1 sm:w-40 sm:flex-none" />
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-10 flex-1 sm:w-28 sm:flex-none" />
            <SkeletonBlock className="h-10 flex-1 sm:w-36 sm:flex-none" />
          </div>
        </header>

        <div className="min-h-0 flex-1 p-3 sm:p-5">
          <div className="h-[520px] rounded-xl border border-border-light bg-bg-canvas sm:h-[720px]" />
        </div>
      </section>
    </main>
  );
}
