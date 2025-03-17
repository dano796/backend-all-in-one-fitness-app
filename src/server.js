import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registrarUsuario, loginUser, resetPasswordForEmail } from "./routes/auth.js";
import { searchFoods, addFood, getFoodsByUserAndDate, deleteFood } from "./routes/foodRoutes.js"; // Importar deleteFood

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'DELETE'], // Agregar DELETE a los métodos permitidos
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Rutas
app.post("/api/register", registrarUsuario);
app.post("/api/login", loginUser);
app.post("/api/reset-password", resetPasswordForEmail);
app.get("/api/foods/search", searchFoods);
app.post("/api/foods/add", addFood);
app.get("/api/foods/user", getFoodsByUserAndDate);
app.delete("/api/foods/delete", deleteFood); // Nueva ruta para eliminar comida

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});