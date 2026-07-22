import "~/styles/globals.css";

import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { AppShell } from "./_components/app-shell";
import { Providers } from "./_components/providers";

export const metadata: Metadata = {
  title: "Persona Management",
  description: "Система управления кандидатами и вакансиями",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const manrope = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-manrope",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={manrope.variable} lang="ru">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
