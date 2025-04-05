import * as rmService from '../services/rmService.js';

export const calculateOneRepMax = async (req, res) => {
  try {
    const { weight, unit, reps, rpe, exercise } = req.body;
    if (!weight || !unit || !reps || !rpe || !exercise) {
      return res.status(400).json({ error: 'Faltan datos requeridos: weight, unit, reps, rpe y exercise son obligatorios' });
    }
    if (weight <= 0 || reps <= 0 || rpe < 1 || rpe > 10 || reps > 30) {
      return res.status(400).json({ error: 'Valores inválidos: weight y reps deben ser > 0, rpe entre 1 y 10, reps <= 30' });
    }
    if (!['kg', 'lb'].includes(unit)) {
      return res.status(400).json({ error: 'Unidad inválida: debe ser "kg" o "lb"' });
    }

    const result = await rmService.calculateOneRepMax({ weight, unit, reps, rpe, exercise });
    return res.status(200).json({ oneRepMax: result });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error al calcular el 1RM' });
  }
};

export const saveOneRepMax = async (req, res) => {
  try {
    const { email, weight, unit, reps, rpe, rm_maximo, fecha, exercise } = req.body;
    if (!email || !weight || !unit || !reps || !rpe || !rm_maximo || !fecha || !exercise) {
      return res.status(400).json({ error: 'Faltan datos requeridos: email, weight, unit, reps, rpe, rm_maximo, fecha y exercise son obligatorios' });
    }
    if (weight <= 0 || reps <= 0 || rpe < 1 || rpe > 10 || reps > 30 || rm_maximo <= 0) {
      return res.status(400).json({ error: 'Valores inválidos: weight, reps y rm_maximo deben ser > 0, rpe entre 1 y 10, reps <= 30' });
    }
    if (!['kg', 'lb'].includes(unit)) {
      return res.status(400).json({ error: 'Unidad inválida: debe ser "kg" o "lb"' });
    }

    const result = await rmService.saveOneRepMax({ email, weight, unit, reps, rpe, rm_maximo, fecha, exercise });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error al guardar el 1RM' });
  }
};