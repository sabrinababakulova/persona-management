import Link from "next/link";

const AUTH_ERROR_MESSAGES: Record<
  string,
  { title: string; description: string }
> = {
  AccessDenied: {
    title: "Вход не выполнен",
    description:
      "Google не подтвердил доступ к аккаунту. Попробуйте снова или используйте другой способ входа.",
  },
  Configuration: {
    title: "Ошибка настройки входа",
    description:
      "Вход через Google сейчас недоступен. Проверьте настройки и повторите попытку позже.",
  },
  Verification: {
    title: "Ссылка недействительна",
    description:
      "Не удалось подтвердить запрос на вход. Запустите авторизацию заново.",
  },
};

type AuthErrorPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const DEFAULT_AUTH_ERROR_CONTENT = {
  title: "Не удалось выполнить вход",
  description:
    "Во время авторизации произошла ошибка. Повторите попытку или войдите по почте и паролю.",
};

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const { error } = await searchParams;
  const content = error
    ? (AUTH_ERROR_MESSAGES[error] ?? DEFAULT_AUTH_ERROR_CONTENT)
    : DEFAULT_AUTH_ERROR_CONTENT;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-light px-6">
      <div className="w-full max-w-[480px] rounded-[12px] border border-border-input bg-bg-light p-8 shadow-toast">
        <h1 className="font-bold text-[32px] text-text-heading leading-none tracking-[-0.64px]">
          {content.title}
        </h1>
        <p className="mt-4 text-[16px] text-text-muted leading-normal tracking-[-0.32px]">
          {content.description}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            className="flex h-12 flex-1 items-center justify-center rounded-[6px] bg-primary-blue font-medium text-[16px] text-bg-light tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover"
            href="/login"
          >
            Вернуться ко входу
          </Link>
          <Link
            className="flex h-12 flex-1 items-center justify-center rounded-[6px] bg-primary-blue-light font-semibold text-[16px] text-primary-blue tracking-[-0.32px] transition-colors hover:bg-primary-blue-light-hover"
            href="/register"
          >
            Создать аккаунт
          </Link>
        </div>
      </div>
    </div>
  );
}
