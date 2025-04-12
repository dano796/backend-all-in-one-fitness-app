import * as foodSearchIAService from "../services/foodSearchIAService.js";

export const analyzeFoodImage = async (req, res) => {
  console.log("Inicio de analyzeFoodImage");
  try {
    // Verificar si se subió una imagen
    if (!req.file) {
      return res.status(400).json({ error: "Se requiere una imagen para analizar" });
    }

    const { email, type } = req.body;
    if (!email || !type) {
      return res.status(400).json({ error: "Faltan datos requeridos: email y type son obligatorios" });
    }

    // Llamar al servicio para analizar la imagen
    const result = await foodSearchIAService.analyzeFoodImage(req.file);

    // Devolver el resultado de la consulta a la API de OpenAI

    return res.status(200).json({
      ...result,
      email,
      type,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Error al analizar la imagen con IA" });
  }
};