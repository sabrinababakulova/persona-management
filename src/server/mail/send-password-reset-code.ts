import nodemailer from "nodemailer";
import "server-only";
import { env } from "~/env";

const transporter = nodemailer.createTransport({
  host: "smtp.yandex.ru",
  port: 465,
  secure: true,
  auth: {
    user: env.MAIL_LOGIN,
    pass: env.MAIL_LOGIN_PASSWORD,
  },
});

export async function sendPasswordResetCode(
  email: string,
  verificationCode: string,
) {
  await transporter.sendMail({
    from: `"Persona Management" <${env.MAIL_LOGIN}>`,
    to: email,
    subject: "Код для сброса пароля",
    text: `Ваш код для сброса пароля: ${verificationCode}.`,
    html: `<p>Ваш код для сброса пароля: <strong>${verificationCode}</strong>.</p>`,
  });
}
