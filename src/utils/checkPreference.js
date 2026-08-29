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
        externalReference: "TEST-CARD-ID-CAMEL",
        external_reference: "TEST-CARD-ID-SNAKE",
        backUrls: {
          success: "https://example.com/success",
          failure: "https://example.com/failure"
        },
        autoReturn: "approved"
      }
    });
    console.log("Preference criada:", JSON.stringify(preference, null, 2));
  } catch (err) {
    console.error("Erro ao criar preference de teste:", err);
  }
}

check();
