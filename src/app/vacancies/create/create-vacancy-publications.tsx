import Link from "next/link";

export function CreateVacancyPublications() {
  return (
    <div className="mt-6 flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-bold text-[32px] text-text-heading leading-none tracking-[-0.64px]">
          Версии публикаций
        </h1>
        <Link
          className="inline-flex h-9 w-full items-center justify-center rounded-[6px] bg-primary-blue px-3 py-2.5 font-medium text-[16px] text-bg-light leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover sm:w-[195px]"
          href="/vacancies/create/publication"
        >
          Создать публикацию
        </Link>
      </div>
    </div>
  );
}
