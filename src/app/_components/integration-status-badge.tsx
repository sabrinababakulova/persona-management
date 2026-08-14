type IntegrationStatusBadgeProps = {
  children: React.ReactNode;
  tone?: "danger" | "success";
};

export function IntegrationStatusBadge({
  children,
  tone = "success",
}: IntegrationStatusBadgeProps) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 font-semibold text-xs leading-none ${
        tone === "success"
          ? "bg-success-green-bg text-success-green"
          : "bg-danger-red-bg text-danger-red"
      }`}
    >
      {children}
    </span>
  );
}
