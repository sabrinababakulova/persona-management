import "~/styles/globals.css";

import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { getDirectusAssetUrl } from "~/server/storage/directus-storage";
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

const DEFAULT_AVATAR_SRC =
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Kerim";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  let avatarSrc = DEFAULT_AVATAR_SRC;

  if (session?.user?.id) {
    const [user] = await db
      .select({
        avatarFileId: users.avatarFileId,
        image: users.image,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    avatarSrc =
      getDirectusAssetUrl(user?.avatarFileId) ??
      user?.image ??
      DEFAULT_AVATAR_SRC;
  }

  return (
    <html className={`${geist.variable}`} lang="ru">
      <body>
        <Providers>
          <AppShell
            avatarAlt={session?.user?.name ?? "Profile"}
            avatarSrc={avatarSrc}
          >
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
