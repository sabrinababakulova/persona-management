import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { AppShell } from "./_components/app-shell";
import { Providers } from "./_components/providers";

export const metadata: Metadata = {
  title: "Persona Management",
  description: "Система управления кандидатами и вакансиями",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${geist.variable}`} lang="ru">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
