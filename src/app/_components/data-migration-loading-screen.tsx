type DataMigrationLoadingScreenProps = {
  isLoading: boolean;
};

export function DataMigrationLoadingScreen({
  isLoading,
}: DataMigrationLoadingScreenProps) {
  if (!isLoading) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-modal="true"
      className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center bg-bg-frosted px-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="flex w-full max-w-[360px] flex-col items-center gap-6 rounded-lg border border-border-input bg-bg-light px-8 py-9 shadow-modal">
        <div
          aria-hidden="true"
          className="relative flex h-16 w-16 items-center justify-center"
        >
          <div className="absolute h-16 w-16 rounded-full border-4 border-primary-blue-light" />
          <div className="absolute h-16 w-16 animate-spin rounded-full border-4 border-transparent border-t-primary-blue border-r-primary-blue" />
          <div className="h-3 w-3 rounded-full bg-primary-blue shadow-[0_0_0_8px_rgba(68,145,255,0.16)]" />
        </div>

        <div className="space-y-2 text-center">
          <h2 className="font-semibold text-[22px] text-text-heading leading-[1.1] tracking-[-0.44px]">
            hold still while we're doing data migration
          </h2>
          <p className="text-[14px] text-text-secondary leading-[1.4]">
            Синхронизируем данные интеграций.
          </p>
        </div>
      </div>
    </div>
  );
}
