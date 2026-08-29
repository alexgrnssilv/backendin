import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import cartaRoutes from "./routes/cartaRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use("/api", cartaRoutes);
app.use("/api", webhookRoutes);

// Servir frontend se estiver buildado (Produção)
const frontendDistPath = path.join(__dirname, "../../frontendinheiro/dist");
if (fs.existsSync(frontendDistPath)) {
  console.log("Servindo arquivos estáticos do frontend a partir de", frontendDistPath);
  app.use(express.static(frontendDistPath));
  
  // Qualquer outra rota do tipo GET que não bata nas APIs cai no index.html (SPA routing)
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
} else {
  console.log("Diretório de build do frontend não encontrado. Iniciando backend em modo isolado.");
  app.get("/", (req, res) => {
    res.json({ message: "Servidor Carta Digital rodando com sucesso. Frontend não buildado localmente." });
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Erro não tratado:", err);
  res.status(500).json({ error: "Ocorreu um erro interno no servidor." });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`URL Base configurada: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
});
