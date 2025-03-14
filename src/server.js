import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registrarUsuario, loginUser, resetPasswordForEmail } from "./routes/auth.js";
import { searchFoods } from "./routes/foodRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Cambiado al puerto de tu frontend
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
// Rutas
app.post("/api/register", registrarUsuario);
app.post("/api/login", loginUser);
app.post("/api/reset-password", resetPasswordForEmail);

app.get("/api/foods/search", searchFoods);

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});