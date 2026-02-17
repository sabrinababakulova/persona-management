export type MailVerificationPageProps = {
  email?: string;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onBack: () => void;
  onSubmit: (code: string) => Promise<void> | void;
};
