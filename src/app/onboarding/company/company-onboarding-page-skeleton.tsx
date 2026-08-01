import {
  AuthPageSkeleton,
  FormFieldsSkeleton,
  SkeletonBlock,
} from "../../_components/page-skeleton";

export function CompanyOnboardingPageSkeleton() {
  return (
    <AuthPageSkeleton>
      <SkeletonBlock className="mb-4 h-10 w-72 max-w-full" />
      <SkeletonBlock className="mb-8 h-4 w-full rounded-md" />
      <FormFieldsSkeleton count={3} />
      <SkeletonBlock className="mt-6 h-12 w-full" />
    </AuthPageSkeleton>
  );
}
