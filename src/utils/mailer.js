import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function enviarEmailCarta(emailDestino, nomeMae, linkUnico) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const linkCarta = `${frontendUrl}/carta/${linkUnico}`;
  const remetente = process.env.SMTP_FROM || "Carta Digital <onboarding@resend.dev>";
  const assunto = `Sua Carta Digital para ${nomeMae} está disponível! ❤️`;

  const corpoHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f3e8e8; border-radius: 12px; background-color: #fffafb;">
      <h2 style="color: #e11d48; text-align: center;">Sua Carta Digital está pronta! ❤️</h2>
      <p style="font-size: 16px; color: #444; line-height: 1.6;">
        Olá! O pagamento da sua carta emocional para <strong>${nomeMae}</strong> foi processado com sucesso.
      </p>
      <p style="font-size: 16px; color: #444; line-height: 1.6;">
        Você já pode acessar, ler e compartilhar a carta final no formato Polaroid interativo clicando no botão abaixo:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${linkCarta}" target="_blank" style="background-color: #e11d48; color: white; padding: 14px 24px; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 24px; display: inline-block; box-shadow: 0 4px 6px rgba(225, 29, 72, 0.2);">
          Acessar Minha Carta
        </a>
      </div>
      <p style="font-size: 14px; color: #666; text-align: center; margin-top: 20px;">
        Se o botão não funcionar, copie e cole este link no seu navegador:<br>
        <a href="${linkCarta}" style="color: #e11d48;">${linkCarta}</a>
      </p>
      <hr style="border: 0; border-top: 1px solid #f3e8e8; margin: 30px 0;">
      <p style="font-size: 12px; color: #999; text-align: center;">
        Plataforma Carta Digital. Obrigado por espalhar amor!
      </p>
    </div>
  `;

  if (!resend) {
    console.log("==================================================");
    console.warn("⚠️ RESEND_API_KEY não configurado. SIMULANDO ENVIO:");
    console.log(`Para: ${emailDestino}`);
    console.log(`Assunto: ${assunto}`);
    console.log(`Link da Carta: ${linkCarta}`);
    console.log("==================================================");
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: remetente,
      to: emailDestino,
      subject: assunto,
      html: corpoHtml,
    });

    if (error) {
      console.error("Resend retornou erro ao enviar e-mail:", error);
      return;
    }

    console.log(`E-mail com link da carta enviado com sucesso para ${emailDestino}. ID: ${data?.id}`);
  } catch (error) {
    console.error("Falha ao enviar e-mail via Resend:", error);
  }
}
