import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { MyProfileClient } from "./my-profile-client";

const DEFAULT_AVATAR_SRC =
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Kerim";

export default async function MyProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <MyProfileClient
      avatarSrc={session.user.image ?? DEFAULT_AVATAR_SRC}
      companyName="ООО Инкорпорейтед"
      userCity="Ташкент"
      userEmail={session.user.email ?? "sabsbabakulova@gmail.com"}
      userFullName={session.user.name ?? "Сабрина Бабакулова"}
    />
  );
}
