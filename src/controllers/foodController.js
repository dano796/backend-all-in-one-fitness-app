import * as foodService from '../services/foodService.js';

export const searchFoods = async (req, res) => {
  try {
    const { query, max_results = '10' } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'El parámetro "query" es requerido' });
    }
    const result = await foodService.searchFoods({ query, max_results });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error al consultar la API de FatSecret o al traducir con OpenAI' });
  }
};

export const addFood = async (req, res) => {
  try {
    const { email, food_id, food_name, food_description, type } = req.body;
    if (!email || !food_id || !food_name || !food_description || !type) {
      return res.status(400).json({ error: 'Faltan datos requeridos: email, food_id, food_name, food_description y type son obligatorios' });
    }
    const result = await foodService.addFood({ email, food_id, food_name, food_description, type });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Error interno al agregar la comida" });
  }
};

export const getFoodsByUserAndDate = async (req, res) => {
  try {
    const { email, date } = req.query;
    if (!email || !date) {
      return res.status(400).json({ error: 'Faltan datos requeridos: email y date son obligatorios' });
    }
    const result = await foodService.getFoodsByUserAndDate({ email, date });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Error interno al consultar las comidas" });
  }
};

export const deleteFood = async (req, res) => {
  try {
    const { email, id_registro } = req.body;
    if (!email || email.trim() === '') {
      return res.status(400).json({ error: 'El campo "email" es requerido y no puede estar vacío' });
    }
    if (!id_registro || id_registro.toString().trim() === '') {
      return res.status(400).json({ error: 'El campo "id_registro" es requerido y no puede estar vacío' });
    }
    const result = await foodService.deleteFood({ email, id_registro });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Error interno al eliminar la comida" });
  }
};