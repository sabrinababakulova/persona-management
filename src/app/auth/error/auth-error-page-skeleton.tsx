import { SkeletonBlock } from "../../_components/page-skeleton";

export function AuthErrorPageSkeleton() {
  return (
    <main
      aria-busy="true"
      className="flex min-h-screen items-center justify-center bg-bg-canvas px-6"
    >
      <section className="surface-card w-full max-w-md p-6 shadow-card-lg sm:p-8">
        <SkeletonBlock className="h-9 w-3/4" />
        <SkeletonBlock className="mt-6 h-4 w-full rounded-md" />
        <SkeletonBlock className="mt-3 h-4 w-4/5 rounded-md" />
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SkeletonBlock className="h-12 w-full" />
          <SkeletonBlock className="h-12 w-full" />
        </div>
      </section>
    </main>
  );
}
