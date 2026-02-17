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

export async function sendRegistrationCode(
  email: string,
  verificationCode: string,
) {
  await transporter.sendMail({
    from: `"Persona Management" <${env.MAIL_LOGIN}>`,
    to: email,
    subject: "Your verification code",
    text: `Your verification code is ${verificationCode}.`,
    html: `<p>Your verification code is <strong>${verificationCode}</strong>.</p>`,
  });

}
