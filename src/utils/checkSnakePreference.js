import { preferenceClient } from "../config/mercadopago.js";

async function check() {
  try {
    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: "teste",
            title: "Teste",
            quantity: 1,
            unit_price: 1.00,
            currency_id: "BRL"
          }
        ],
        external_reference: "TEST-CARD-ID-SNAKE-ONLY",
        back_urls: {
          success: "https://curly-shrimp-67.loca.lt/sucesso?linkUnico=123",
          failure: "https://curly-shrimp-67.loca.lt/sucesso?linkUnico=123",
          pending: "https://curly-shrimp-67.loca.lt/sucesso?linkUnico=123"
        },
        auto_return: "approved",
        notification_url: "https://curly-shrimp-67.loca.lt/api/webhook/mercadopago"
      }
    });
    console.log("Preference criada com sucesso:", JSON.stringify(preference, null, 2));
  } catch (err) {
    console.error("Erro ao criar preference de teste:", err);
  }
}

check();
