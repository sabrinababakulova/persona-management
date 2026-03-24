"use client";

import { useState } from "react";
import { Input } from "~/app/_components/input";
import { api } from "~/trpc/react";
import { ClosableSection } from "../_components/closable-section";

export function HhAccountSection() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [employerId, setEmployerId] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const utils = api.useUtils();

  const { data: account, isLoading } = api.integrations.getHhAccount.useQuery();

  const saveAccount = api.integrations.saveHhAccount.useMutation({
    onSuccess: () => {
      setSuccess("Данные сохранены");
      setError(null);
      setClientSecret("");
      void utils.integrations.getHhAccount.invalidate();
    },
    onError: (err) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  const removeAccount = api.integrations.removeHhAccount.useMutation({
    onSuccess: () => {
      setClientId("");
      setClientSecret("");
      setEmployerId("");
      setEmail("");
      setSuccess("Аккаунт отключен");
      setError(null);
      void utils.integrations.getHhAccount.invalidate();
    },
    onError: (err) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  const handleSave = () => {
    if (!clientId.trim() || !clientSecret.trim() || !employerId.trim()) return;
    setError(null);
    setSuccess(null);
    saveAccount.mutate({
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      employerId: employerId.trim(),
      email: email.trim() || undefined,
    });
  };

  const isConnected = !!account;

  return (
    <ClosableSection title="hh.uz аккаунт">
      {isLoading && (
        <p className="text-[14px] text-text-secondary">Загрузка...</p>
      )}

      {isConnected && (
        <div className="space-y-1 rounded-[6px] border border-border-input bg-bg-input px-3 py-3">
          <p className="text-[14px] text-text-heading">
            <span className="font-medium">Статус:</span>{" "}
            <span className="text-success-green">Подключен</span>
          </p>
          {account.employerId && (
            <p className="text-[13px] text-text-secondary">
              Employer ID: {account.employerId}
            </p>
          )}
          {account.email && (
            <p className="text-[13px] text-text-secondary">
              Email: {account.email}
            </p>
          )}
          {account.clientId && (
            <p className="text-[13px] text-text-secondary">
              Client ID: {account.clientId}
            </p>
          )}
          {account.clientSecret && (
            <p className="text-[13px] text-text-secondary">
              Client Secret: {account.clientSecret}
            </p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <Input
          label="Client ID"
          onChange={(e) => setClientId(e.target.value)}
          placeholder="OAuth Client ID"
          value={clientId}
        />
        <Input
          label="Client Secret"
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder="OAuth Client Secret"
          type="password"
          value={clientSecret}
        />
        <Input
          label="Employer ID"
          onChange={(e) => setEmployerId(e.target.value)}
          placeholder="ID работодателя на hh.uz"
          value={employerId}
        />
        <Input
          label="Email (необязательно)"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          type="email"
          value={email}
        />

        {error && (
          <p className="text-[13px] text-danger-red leading-[1.4]">{error}</p>
        )}
        {success && (
          <p className="text-[13px] text-success-green leading-[1.4]">
            {success}
          </p>
        )}

        <div className="flex gap-3">
          <button
            className="h-10 rounded-[6px] bg-primary-blue-light px-4 font-semibold text-[14px] text-primary-blue leading-none tracking-[-0.28px] transition-colors hover:bg-primary-blue-light-hover disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              saveAccount.isPending ||
              !clientId.trim() ||
              !clientSecret.trim() ||
              !employerId.trim()
            }
            onClick={handleSave}
            type="button"
          >
            {saveAccount.isPending ? "Сохранение..." : "Сохранить"}
          </button>

          {isConnected && (
            <button
              className="h-10 rounded-[6px] border border-danger-red px-4 font-semibold text-[14px] text-danger-red leading-none tracking-[-0.28px] transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={removeAccount.isPending}
              onClick={() => {
                setError(null);
                setSuccess(null);
                removeAccount.mutate();
              }}
              type="button"
            >
              {removeAccount.isPending ? "Удаление..." : "Удалить аккаунт"}
            </button>
          )}
        </div>
      </div>
    </ClosableSection>
  );
}
