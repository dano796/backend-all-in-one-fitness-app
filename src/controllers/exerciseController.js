import * as exerciseService from '../services/exerciseService.js';

export const getExercises = async (req, res) => {
  try {
    const { bodyPart } = req.query;

    if (!bodyPart) {
      return res.status(400).json({ error: 'Debe proporcionar una parte del cuerpo' });
    }

    const result = await exerciseService.fetchExercises(bodyPart);
    return res.status(200).json(result);
  } catch (err) {
    const errorMessage = err.message || 'Error al consultar los ejercicios';
    return res.status(500).json({ error: errorMessage });
  }
};