import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Header } from "./_components/header";
import { Providers } from "./_components/providers";
import { Sidebar } from "./_components/sidebar";

export const metadata: Metadata = {
  title: "Persona Management",
  description: "Система управления кандидатами и вакансиями",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${geist.variable}`} lang="ru">
      <body>
        <Providers>
          <div className="relative flex min-h-screen bg-bg-light">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Header />
              <div className="min-h-0 flex-1">{children}</div>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
