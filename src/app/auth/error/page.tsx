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
    <div className="flex min-h-screen items-center justify-center bg-bg-canvas px-6">
      <div className="surface-card w-full max-w-md p-6 shadow-card-lg sm:p-8">
        <h1 className="page-title">{content.title}</h1>
        <p className="mt-4 text-sm text-text-muted leading-6">
          {content.description}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link className="ui-button ui-button-primary flex-1" href="/login">
            Вернуться ко входу
          </Link>
          <Link className="ui-button ui-button-soft flex-1" href="/register">
            Создать аккаунт
          </Link>
        </div>
      </div>
    </div>
  );
}
