import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registerUser, loginUser, resetPasswordForEmail, setCalorieGoal, getCalorieGoal } from "./controllers/authController.js";
import { searchFoods, addFood, getFoodsByUserAndDate, deleteFood } from "./controllers/foodController.js";
import { getWaterByUserAndDate, updateWaterData } from "./controllers/waterController.js";
import { getExercises } from "./controllers/exerciseController.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Rutas
app.post("/api/register", registerUser);
app.post("/api/login", loginUser);
app.post("/api/reset-password", resetPasswordForEmail);
app.get("/api/foods/search", searchFoods);
app.post("/api/foods/add", addFood);
app.get("/api/foods/user", getFoodsByUserAndDate);
app.delete("/api/foods/delete", deleteFood);
app.post("/api/set-calorie-goal", setCalorieGoal);
app.get("/api/get-calorie-goal", getCalorieGoal);
app.get("/api/water/user", getWaterByUserAndDate);
app.post("/api/water/update", updateWaterData);
app.get("/api/exercises", getExercises);

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});