import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { registerUser, loginUser, resetPasswordForEmail, setCalorieGoal, getCalorieGoal } from "./controllers/authController.js";
import { searchFoods, addFood, getFoodsByUserAndDate, deleteFood } from "./controllers/foodController.js";
import { getWaterByUserAndDate, updateWaterData } from "./controllers/waterController.js";
import { getExercises } from "./controllers/exerciseController.js";
import { getUserRoutines, createRoutine, updateRoutine, deleteRoutine, getRoutineById } from "./controllers/RoutineController.js";
import { calculateOneRepMax, saveOneRepMax, getRMProgress } from "./controllers/rmController.js";
import { getDashboardData } from "./controllers/DashboardController.js";
import { analyzeFoodImage } from "./controllers/foodSearchIAController.js"; // Nuevo controlador
import swaggerUI from "swagger-ui-express";
import specs from "../swagger/swagger.js";
import multer from "multer"; // Importamos multer

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración de multer para manejar la carga de imágenes
const storage = multer.memoryStorage(); // Almacenar en memoria (puedes usar diskStorage si prefieres guardar en disco)
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("El archivo debe ser una imagen"), false);
    }
  },
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"],
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

// Rutas para las rutinas
app.get("/api/routines/user", getUserRoutines);
app.post("/api/routines", createRoutine);
app.put("/api/routines/:id", updateRoutine);
app.delete("/api/routines/:id", deleteRoutine);
app.get("/api/routines/:id", getRoutineById);

// Rutas para el cálculo y almacenamiento del 1RM
app.post("/api/1rm/calculate", calculateOneRepMax);
app.post("/api/1rm/save", saveOneRepMax);
app.get("/api/1rm/progress", getRMProgress);

// Nueva ruta para el análisis de imágenes
app.post("/api/foods/analyze-image", upload.single("image"), analyzeFoodImage);

// Nueva ruta para el dashboard
app.get("/api/dashboard", getDashboardData);

// Configuración de Swagger UI
app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(specs));

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});