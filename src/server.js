import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registrarUsuario, loginUser, resetPasswordForEmail } from "./routes/auth.js";
import { searchFoods, addFood, getFoodsByUserAndDate } from "./routes/foodRoutes.js"; // Importar getFoodsByUserAndDate

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL, // Usar la URL del frontend desde .env
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Rutas
app.post("/api/register", registrarUsuario);
app.post("/api/login", loginUser);
app.post("/api/reset-password", resetPasswordForEmail);
app.get("/api/foods/search", searchFoods);
app.post("/api/foods/add", addFood); // Ruta para agregar comida
app.get("/api/foods/user", getFoodsByUserAndDate); // Nueva ruta para consultar comidas por usuario y fecha

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});