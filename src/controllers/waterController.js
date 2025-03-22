import * as waterService from '../services/waterService.js';

export const getWaterByUserAndDate = async (req, res) => {
  try {
    const { email, date } = req.query;
    if (!email || !date) {
      return res.status(400).json({ error: "Email y fecha son requeridos." });
    }
    const result = await waterService.getWaterByUserAndDate({ email, date });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Error en el servidor." });
  }
};

export const updateWaterData = async (req, res) => {
  try {
    const { email, date, aguasllenadas } = req.body;
    if (!email || !date || aguasllenadas === undefined) {
      return res.status(400).json({ error: "Email, fecha y aguasllenadas son requeridos." });
    }
    const result = await waterService.updateWaterData({ email, date, aguasllenadas });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Error en el servidor." });
  }
};