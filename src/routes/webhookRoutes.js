import express from "express";
import { paymentClient } from "../config/mercadopago.js";
import prisma from "../config/db.js";
import crypto from "crypto";
import { enviarEmailCarta } from "../utils/mailer.js";

const router = express.Router();

router.post("/webhook/mercadopago", async (req, res) => {
  // Always return 200 OK immediately or at the end to prevent MP from retrying indefinitely
  console.log("Recebida notificação de webhook do Mercado Pago:", req.body, req.query);

  try {
    let paymentId = null;

    // Check JSON body action notification format
    if (req.body && req.body.data && req.body.data.id) {
      paymentId = req.body.data.id;
    }
    // Check legacy webhook notification formats
    else if (req.body && req.body.type === "payment" && req.body.id) {
      paymentId = req.body.id;
    } else if (req.query && req.query.id && (req.query.topic === "payment" || req.query.type === "payment")) {
      paymentId = req.query.id;
    }

    if (!paymentId) {
      console.log("Notificação recebida não é do tipo pagamento ou não contém ID do pagamento.");
      return res.status(200).send("OK");
    }

    // Validar assinatura do webhook
    const isProduction = process.env.NODE_ENV === "production";
    const secret = process.env.MP_WEBHOOK_SECRET;

    if (isProduction && !secret) {
      console.error("ERRO DE SEGURANÇA CRÍTICO: MP_WEBHOOK_SECRET não está configurada no ambiente de produção! Webhook bloqueado.");
      return res.status(500).send("Erro interno de configuração de segurança");
    }

    if (secret) {
      const xSignature = req.headers["x-signature"];
      const xRequestId = req.headers["x-request-id"];

      if (!xSignature || !xRequestId) {
        console.warn("Tentativa de chamada de webhook sem assinatura.");
        return res.status(401).json({ error: "Assinatura ausente" });
      }

      try {
        const parts = xSignature.split(",");
        const tsPart = parts.find((p) => p.trim().startsWith("ts="));
        const v1Part = parts.find((p) => p.trim().startsWith("v1="));

        if (!tsPart || !v1Part) {
          console.warn("Formato da assinatura x-signature é inválido.");
          return res.status(400).json({ error: "Formato de assinatura inválido" });
        }

        const ts = tsPart.split("=")[1];
        const v1 = v1Part.split("=")[1];

        // Formato do manifesto: id:<id>;request-id:<request-id>;ts:<ts>;
        const manifest = `id:${paymentId};request-id:${xRequestId};ts:${ts};`;

        const expectedSignature = crypto
          .createHmac("sha256", secret)
          .update(manifest)
          .digest("hex");

        const expectedBuffer = Buffer.from(expectedSignature, "hex");
        const v1Buffer = Buffer.from(v1, "hex");

        if (
          expectedBuffer.length !== v1Buffer.length ||
          !crypto.timingSafeEqual(expectedBuffer, v1Buffer)
        ) {
          console.warn("Assinatura do webhook inválida.");
          return res.status(401).json({ error: "Assinatura inválida" });
        }

        console.log("Assinatura do webhook validada com sucesso!");
      } catch (err) {
        console.error("Erro ao validar assinatura do webhook:", err);
        return res.status(500).json({ error: "Falha interna na validação" });
      }
    } else {
      console.warn("Ambiente local: MP_WEBHOOK_SECRET não configurado. Ignorando validação de assinatura para testes rápidos.");
    }

    console.log(`Buscando detalhes do pagamento ${paymentId} no Mercado Pago...`);
    const payment = await paymentClient.get({ id: paymentId });

    if (!payment) {
      console.log(`Pagamento ${paymentId} não encontrado no Mercado Pago.`);
      return res.status(200).send("OK");
    }

    const cartaId = payment.external_reference || payment.externalReference;
    const status = payment.status; // approved, pending, rejected, etc.

    console.log(`Pagamento ${paymentId} referente a Carta ID: ${cartaId}. Status: ${status}`);

    if (!cartaId) {
      console.log(`Pagamento ${paymentId} não contém external_reference/externalReference associado.`);
      return res.status(200).send("OK");
    }

    const statusMap = {
      approved: "aprovado",
      pending: "pendente",
      in_process: "pendente",
      rejected: "rejeitado",
      cancelled: "rejeitado",
      refunded: "rejeitado",
      charged_back: "rejeitado",
    };

    const statusInterno = statusMap[status] || "pendente";
    const liberada = status === "approved";

    // Update database
    const updatedCarta = await prisma.carta.update({
      where: { id: cartaId },
      data: {
        statusPagamento: statusInterno,
        liberada: liberada ? true : undefined, // only update to true if approved; do not reset true back to false unless needed (but once approved, it stays approved)
      },
    });

    console.log(`Carta ID ${updatedCarta.id} atualizada com sucesso. Status Interno: ${statusInterno}, Liberada: ${updatedCarta.liberada}`);

    // Disparar envio de email se aprovado e houver e-mail cadastrado
    if (liberada && updatedCarta.emailComprador) {
      enviarEmailCarta(updatedCarta.emailComprador, updatedCarta.nomeMae, updatedCarta.linkUnico)
        .catch((err) => console.error("Erro assíncrono ao enviar email da carta:", err));
    }
  } catch (error) {
    // Log the error but return 200 OK so that MP doesn't loop forever
    console.error("Erro ao processar webhook do Mercado Pago:", error);
  }

  return res.status(200).send("OK");
});

export default router;
