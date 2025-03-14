import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registrarUsuario, loginUser, resetPasswordForEmail } from "./routes/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.post("/api/register", registrarUsuario);
app.post("/api/login", loginUser);
app.post("/api/reset-password", resetPasswordForEmail);

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});