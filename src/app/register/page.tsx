"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex min-h-screen bg-white">
      <div className="relative hidden h-screen w-[695px] shrink-0 lg:block">
        <Image
          alt="Logo"
          className="object-cover"
          fill
          priority
          src="/login-sidebar.svg"
        />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 lg:px-[120px]">
        <div className="w-full max-w-[505px]">
          <h1 className="mb-8 font-bold text-[32px] text-text-heading leading-none tracking-[-0.64px]">
            Зарегестрироваться
          </h1>

          <form className="flex flex-col gap-6">
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="flex flex-1 flex-col gap-1">
                <label
                  className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
                  htmlFor="register-first-name"
                >
                  Имя
                </label>
                <input
                  className="h-12 w-full rounded-[6px] border border-border-input bg-bg-input px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
                  id="register-first-name"
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ваше имя"
                  type="text"
                  value={firstName}
                />
              </div>

              <div className="flex flex-1 flex-col gap-1">
                <label
                  className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
                  htmlFor="register-last-name"
                >
                  Фамилия
                </label>
                <input
                  className="h-12 w-full rounded-[6px] border border-border-input bg-bg-input px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
                  id="register-last-name"
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ваша фамилия"
                  type="text"
                  value={lastName}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
                htmlFor="register-email"
              >
                Корпоративная почта
              </label>
              <input
                className="h-12 w-full rounded-[6px] border border-border-input bg-bg-input px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
                id="register-email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Адрес электронной почты"
                type="email"
                value={email}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
                htmlFor="register-password"
              >
                Пароль
              </label>
              <input
                className="h-12 w-full rounded-[6px] border border-border-input bg-bg-input px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
                id="register-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите ваш пароль"
                type="password"
                value={password}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
                htmlFor="register-confirm-password"
              >
                Повторите пароль
              </label>
              <input
                className="h-12 w-full rounded-[6px] border border-border-input bg-bg-input px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
                id="register-confirm-password"
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Введите ваш пароль"
                type="password"
                value={confirmPassword}
              />
            </div>

            <div className="mt-6 flex items-center justify-end">
              <Link
                className="flex h-10 w-[174px] items-center justify-center rounded-[6px] bg-primary-blue font-medium text-[16px] text-white leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover"
                href="/login"
              >
                Войти
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
