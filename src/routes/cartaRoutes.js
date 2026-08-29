import express from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import prisma from "../config/db.js";
import { preferenceClient } from "../config/mercadopago.js";
import { uploadFoto } from "../config/cloudinary.js";
import { montarTextoCarta } from "../utils/cartaTemplate.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Multer in-memory storage configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Apenas imagens nos formatos JPG, PNG ou WEBP são permitidas."));
    }
  },
});

// Rate limiting for creating letters to prevent spam
const createLetterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per window
  message: { error: "Muitas cartas sendo criadas a partir deste IP. Tente novamente mais tarde." },
});

// 1. POST /api/upload - handles optional photo upload with custom Multer error handler
router.post("/upload", (req, res, next) => {
  upload.single("foto")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const errorMsg = err.code === "LIMIT_FILE_SIZE" ? "Arquivo maior que o limite de 5MB." : err.message;
      return res.status(400).json({ error: `Erro no upload: ${errorMsg}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }
    const publicUrl = await uploadFoto(req.file);
    res.json({ fotoUrl: publicUrl });
  } catch (error) {
    console.error("Erro no upload da foto:", error);
    res.status(500).json({ error: "Erro ao fazer upload da imagem." });
  }
});

// 2. POST /api/cartas - create letter and generate MP preference
router.post("/cartas", createLetterLimiter, async (req, res) => {
  try {
    const {
      nomeMae,
      nomeRemetente,
      comoChama,
      caracteristicas,
      lembranca,
      agradecimento,
      admiracao,
      mensagemFinal,
      fotoUrl,
      emailComprador,
    } = req.body;

    // Validation
    if (!nomeMae?.trim() || nomeMae.length < 2 || nomeMae.length > 100) {
      return res.status(400).json({ error: "O nome da destinatária deve ter entre 2 e 100 caracteres." });
    }
    if (!nomeRemetente?.trim() || nomeRemetente.length < 2 || nomeRemetente.length > 100) {
      return res.status(400).json({ error: "Seu nome deve ter entre 2 e 100 caracteres." });
    }
    if (!comoChama?.trim() || comoChama.length > 100) {
      return res.status(400).json({ error: "Como você a chama deve ter até 100 caracteres." });
    }
    if (!caracteristicas?.trim() || caracteristicas.length < 5 || caracteristicas.length > 1000) {
      return res.status(400).json({ error: "Características devem ter entre 5 e 1000 caracteres." });
    }
    if (!lembranca?.trim() || lembranca.length < 10 || lembranca.length > 5000) {
      return res.status(400).json({ error: "A lembrança deve ter entre 10 e 5000 caracteres." });
    }
    if (!agradecimento?.trim() || agradecimento.length < 10 || agradecimento.length > 5000) {
      return res.status(400).json({ error: "O agradecimento deve ter entre 10 e 5000 caracteres." });
    }
    if (!admiracao?.trim() || admiracao.length < 10 || admiracao.length > 5000) {
      return res.status(400).json({ error: "O que você admira nela deve ter entre 10 e 5000 caracteres." });
    }
    if (!mensagemFinal?.trim() || mensagemFinal.length < 10 || mensagemFinal.length > 5000) {
      return res.status(400).json({ error: "A mensagem final deve ter entre 10 e 5000 caracteres." });
    }

    if (emailComprador) {
      if (emailComprador.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailComprador)) {
        return res.status(400).json({ error: "E-mail inválido." });
      }
    }

    const linkUnico = uuidv4();

    // Create database entry first
    const carta = await prisma.carta.create({
      data: {
        nomeMae,
        nomeRemetente,
        comoChama,
        caracteristicas,
        lembranca,
        agradecimento,
        admiracao,
        mensagemFinal,
        fotoUrl: fotoUrl || null,
        emailComprador: emailComprador || null,
        linkUnico,
        statusPagamento: "pendente",
        liberada: false,
      },
    });

    // Setup Mercado Pago preference details
    const baseUrl = process.env.BASE_URL || "http://localhost:3001";
    const frontendUrl = process.env.FRONTEND_URL || baseUrl;
    
    // Build redirect urls for sandbox or live checkouts pointing to the frontend (Vercel)
    const backUrls = {
      success: `${frontendUrl}/sucesso?linkUnico=${linkUnico}`,
      failure: `${frontendUrl}/sucesso?linkUnico=${linkUnico}`,
      pending: `${frontendUrl}/sucesso?linkUnico=${linkUnico}`,
    };

    // Create Preference using Mercado Pago Client
    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: "carta-digital-el",
            title: `Carta Digital para ${nomeMae}`,
            quantity: 1,
            unit_price: 7.99,
            currency_id: "BRL",
          },
        ],
        external_reference: carta.id,
        back_urls: backUrls,
        auto_return: "approved",
        notification_url: `${baseUrl}/api/webhook/mercadopago`,
      },
    });

    // Update database with the preference id
    await prisma.carta.update({
      where: { id: carta.id },
      data: { mercadoPagoId: preference.id },
    });

    res.status(201).json({
      linkUnico,
      initPoint: preference.init_point,
    });
  } catch (error) {
    console.error("Erro ao criar carta ou preferência:", error);
    res.status(500).json({ error: "Erro interno no servidor ao processar o pagamento." });
  }
});

// 3. GET /api/carta/:linkUnico/status - get payment status for polling
router.get("/carta/:linkUnico/status", async (req, res) => {
  try {
    const { linkUnico } = req.params;
    const carta = await prisma.carta.findUnique({
      where: { linkUnico },
      select: {
        statusPagamento: true,
        liberada: true,
      },
    });

    if (!carta) {
      return res.status(404).json({ error: "Carta não encontrada." });
    }

    res.json(carta);
  } catch (error) {
    console.error("Erro ao buscar status da carta:", error);
    res.status(500).json({ error: "Erro ao buscar status da carta." });
  }
});

// 4. GET /api/carta/:linkUnico - get full letter details if unlocked
router.get("/carta/:linkUnico", async (req, res) => {
  try {
    const { linkUnico } = req.params;
    const carta = await prisma.carta.findUnique({
      where: { linkUnico },
    });

    if (!carta) {
      return res.status(404).json({ error: "Carta não encontrada." });
    }

    if (!carta.liberada) {
      return res.status(402).json({
        error: "Esta carta ainda não foi liberada. O pagamento está pendente ou foi rejeitado.",
        liberada: false,
      });
    }

    const textoFormatado = montarTextoCarta(carta);

    // Return necessary data, omit internal identifiers like mercadoPagoId
    res.json({
      nomeMae: carta.nomeMae,
      nomeRemetente: carta.nomeRemetente,
      fotoUrl: carta.fotoUrl,
      textoFormatado,
      criadoEm: carta.criadoEm,
      liberada: true,
    });
  } catch (error) {
    console.error("Erro ao carregar a carta:", error);
    res.status(500).json({ error: "Erro ao carregar a carta." });
  }
});
export default router;
