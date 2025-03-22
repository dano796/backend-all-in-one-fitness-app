import * as authService from '../services/authService.js';

export const registerUser = async (req, res) => {
  try {
    const { usuario, correo, contraseña } = req.body;
    if (!usuario || !correo || !contraseña) {
      return res.status(400).json({ error: "Faltan datos requeridos." });
    }
    const result = await authService.registerUser({ usuario, correo, contraseña });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Ocurrió un error inesperado. Intenta de nuevo." });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { input, password } = req.body;
    if (!input || !password) {
      return res.status(400).json({ error: "Faltan datos requeridos." });
    }
    const result = await authService.loginUser({ input, password });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Ocurrió un error inesperado. Inténtalo de nuevo." });
  }
};

export const resetPasswordForEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "El correo es requerido." });
    }
    const result = await authService.resetPasswordForEmail(email);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Ocurrió un error inesperado. Inténtalo de nuevo." });
  }
};

export const setCalorieGoal = async (req, res) => {
  try {
    const { email, calorieGoal } = req.body;
    if (!email || calorieGoal === undefined) {
      return res.status(400).json({ error: "Faltan datos requeridos: email y calorieGoal." });
    }
    if (!Number.isInteger(calorieGoal)) {
      return res.status(400).json({ error: "El límite de calorías debe ser un número entero." });
    }
    if (calorieGoal !== 0 && calorieGoal < 2000) {
      return res.status(400).json({ error: "El límite de calorías debe ser 0 (para eliminar) o mayor o igual a 2000." });
    }
    const result = await authService.setCalorieGoal({ email, calorieGoal });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Ocurrió un error inesperado. Intenta de nuevo." });
  }
};

export const getCalorieGoal = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: "Falta el parámetro email." });
    }
    const result = await authService.getCalorieGoal(email);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Ocurrió un error inesperado. Intenta de nuevo." });
  }
};