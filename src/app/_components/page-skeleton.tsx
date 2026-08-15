import type { ReactNode } from "react";

type SkeletonBlockProps = {
  className?: string;
};

export const SKELETON_KEYS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
] as const;

export function SkeletonBlock({ className = "" }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-xl bg-border-light/70 motion-safe:animate-pulse ${className}`}
    />
  );
}

export function SkeletonPage({ children }: { children: ReactNode }) {
  return (
    <main aria-busy="true" className="min-h-full bg-bg-canvas">
      <div className="app-page">{children}</div>
    </main>
  );
}

export function SkeletonCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-hidden="true"
      className={`surface-card overflow-hidden p-5 sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function AuthPageSkeleton({ children }: { children: ReactNode }) {
  return (
    <div aria-busy="true" className="auth-layout">
      <div className="auth-art bg-bg-input">
        <SkeletonBlock className="absolute inset-8 rounded-3xl bg-bg-light/15" />
      </div>
      <div className="auth-content">
        <div className="auth-panel">{children}</div>
      </div>
    </div>
  );
}

export function FormFieldsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {SKELETON_KEYS.slice(0, count).map((key, index) => (
        <div
          className={
            index === count - 1 && count % 2 !== 0 ? "sm:col-span-2" : ""
          }
          key={`field-${key}`}
        >
          <SkeletonBlock className="mb-2 h-3 w-24 rounded-md" />
          <SkeletonBlock className="h-12 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SecondaryNavSkeleton({ count = 3 }: { count?: number }) {
  return (
    <aside className="w-full shrink-0 overflow-hidden lg:w-44 lg:pt-4">
      <div className="mobile-secondary-nav flex gap-2 overflow-hidden pb-1 lg:flex-col lg:gap-1">
        {SKELETON_KEYS.slice(0, count).map((key, index) => (
          <SkeletonBlock
            className={`h-10 shrink-0 ${index === 0 ? "w-36" : "w-28"} lg:w-full`}
            key={`nav-${key}`}
          />
        ))}
      </div>
    </aside>
  );
}

export function TableRowsSkeleton({
  count = 5,
  desktopAt = "xl",
}: {
  count?: number;
  desktopAt?: "lg" | "xl";
}) {
  const mobileClassName =
    desktopAt === "lg" ? "grid lg:hidden" : "grid xl:hidden";
  const desktopClassName =
    desktopAt === "lg" ? "hidden lg:block" : "hidden xl:block";

  return (
    <div aria-hidden="true">
      <div className={`${mobileClassName} grid-cols-1 gap-3 sm:grid-cols-2`}>
        {SKELETON_KEYS.slice(0, count).map((key, index) => (
          <div
            className="surface-card overflow-hidden p-4"
            key={`mobile-row-${key}`}
          >
            <div className="flex items-start gap-3">
              <SkeletonBlock className="h-5 w-5 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <SkeletonBlock
                  className={`h-5 ${index % 2 === 0 ? "w-4/5" : "w-2/3"} rounded-md`}
                />
                <SkeletonBlock className="mt-2 h-3 w-2/5 rounded-md" />
              </div>
              <SkeletonBlock className="h-8 w-8 shrink-0 rounded-lg" />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <SkeletonBlock className="h-8 w-24 rounded-lg" />
              <SkeletonBlock className="h-9 w-28 rounded-xl" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-border-light border-t pt-4">
              {SKELETON_KEYS.slice(0, 4).map((metaKey, metaIndex) => (
                <div key={`mobile-row-${key}-meta-${metaKey}`}>
                  <SkeletonBlock className="h-3 w-16 rounded-md" />
                  <SkeletonBlock
                    className={`mt-2 h-4 ${metaIndex % 2 === 0 ? "w-4/5" : "w-2/3"} rounded-md`}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        className={`${desktopClassName} overflow-hidden rounded-xl border border-border-light bg-bg-light`}
      >
        <div className="grid grid-cols-4 gap-5 border-border-light border-b bg-table-header-bg px-5 py-4">
          {SKELETON_KEYS.slice(0, 4).map((key) => (
            <SkeletonBlock
              className="h-3 w-2/3 rounded-md"
              key={`head-${key}`}
            />
          ))}
        </div>
        {SKELETON_KEYS.slice(0, count).map((key) => (
          <div
            className="grid min-h-18 grid-cols-4 items-center gap-5 border-border-light border-b px-5 last:border-b-0"
            key={`row-${key}`}
          >
            <SkeletonBlock className="h-4 w-4/5 rounded-md" />
            <SkeletonBlock className="h-7 w-24 rounded-full" />
            <SkeletonBlock className="h-4 w-3/5 rounded-md" />
            <SkeletonBlock className="h-4 w-1/2 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
