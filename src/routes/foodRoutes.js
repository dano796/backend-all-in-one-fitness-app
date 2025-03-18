import axios from 'axios';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
import { supabase } from '../lib/supabaseClient.js';

dotenv.config();

// Configuración de claves y URLs para las APIs
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';
const CONSUMER_KEY = process.env.FATSECRET_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.FATSECRET_CONSUMER_SECRET;
const OAUTH_VERSION = '1.0';
const OAUTH_SIGNATURE_METHOD = 'HMAC-SHA1';

// Genera un "nonce" aleatorio para la autenticación OAuth
const generateNonce = () => Math.random().toString(36).substring(2, 15);

// Genera un timestamp en formato UNIX (segundos desde 1970) para OAuth
const generateTimestamp = () => Math.floor(Date.now() / 1000).toString();

// Genera la firma HMAC-SHA1 requerida por la API de FatSecret
const generateSignature = (method, url, params) => {
  const paramString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(CONSUMER_SECRET)}&`;
  return CryptoJS.HmacSHA1(baseString, signingKey).toString(CryptoJS.enc.Base64);
};

// Traduce texto usando la API de OpenAI (GPT-4o Mini)
const translateTextWithOpenAI = async (text, targetLang = 'es') => {
  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are a translator. Translate the following text to ${targetLang}.` },
          { role: 'user', content: text },
        ],
        max_tokens: 15,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    throw new Error('Error al traducir el texto con OpenAI');
  }
};

// Endpoint para buscar alimentos en la API de FatSecret
export const searchFoods = async (req, res) => {
  let { query, max_results = '10' } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'El parámetro "query" es requerido' });
  }

  try {
    const now = new Date();

    query = await translateTextWithOpenAI(query, 'en');

    const params = {
      method: 'foods.search',
      oauth_consumer_key: CONSUMER_KEY,
      oauth_nonce: generateNonce(),
      oauth_timestamp: generateTimestamp(),
      oauth_signature_method: OAUTH_SIGNATURE_METHOD,
      oauth_version: OAUTH_VERSION,
      format: 'json',
      search_expression: query,
      max_results: max_results,
    };

    const signature = generateSignature('GET', API_URL, params);
    params.oauth_signature = signature;

    const response = await axios.get(API_URL, { params });
    const foodData = response.data.foods.food;

    if (!foodData) {
      return res.json(response.data);
    }

    const translatedFoods = await Promise.all(
      (Array.isArray(foodData) ? foodData : [foodData]).map(async (food) => {
        const translatedName = await translateTextWithOpenAI(food.food_name, 'es');
        return {
          ...food,
          food_name: translatedName,
        };
      })
    );

    res.json({
      ...response.data,
      foods: {
        ...response.data.foods,
        food: translatedFoods,
      },
    });
  } catch (error) {
    console.error(`[ERROR] Error al consultar la API de FatSecret o al traducir con OpenAI: ${error.message}`);
    res.status(500).json({ error: 'Error al consultar la API de FatSecret o al traducir con OpenAI' });
  }
};

// Endpoint para agregar una comida
export const addFood = async (req, res) => {
  const { email, food_id, food_name, food_description } = req.body;

  if (!email || !food_id || !food_name || !food_description) {
    return res.status(400).json({ error: 'Faltan datos requeridos: email, food_id, food_name y food_description son obligatorios' });
  }

  try {
    const now = new Date();

    const { data: user, error: userError } = await supabase
      .from("Inicio Sesion")
      .select("idusuario")
      .eq("Correo", email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: `Usuario con correo ${email} no encontrado` });
    }

    const idusuario = user.idusuario;

    const localDateISOString = now
      .toLocaleString('sv-SE', { timeZone: 'America/Bogota' })
      .replace(' ', 'T') + '.000';

    const { error: insertError } = await supabase
      .from("ComidasxUsuario")
      .insert({
        idusuario: idusuario,
        id_comida: food_id,
        nombre_comida: food_name,
        descripcion: food_description,
        fecha: localDateISOString,
      });

    if (insertError) {
      return res.status(500).json({ error: 'Error al guardar la comida en la base de datos' });
    }

    res.status(200).json({ message: "Comida agregada con éxito" });
  } catch (error) {
    console.error(`[ERROR] Error interno al agregar la comida: ${error.message}`);
    res.status(500).json({ error: "Error interno al agregar la comida" });
  }
};

// Endpoint para obtener las comidas registradas por un usuario en un día específico
export const getFoodsByUserAndDate = async (req, res) => {
  const { email, date } = req.query;

  if (!email || !date) {
    return res.status(400).json({ error: 'Faltan datos requeridos: email y date son obligatorios' });
  }

  try {
    const TIMEZONE = 'America/Bogota';
    const now = new Date();

    const { data: user, error: userError } = await supabase
      .from("Inicio Sesion")
      .select("idusuario")
      .eq("Correo", email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: `Usuario con correo ${email} no encontrado` });
    }

    const idusuario = user.idusuario;

    const { data: foods, error: foodsError } = await supabase
      .from("ComidasxUsuario")
      .select("id_comida, nombre_comida, descripcion, fecha")
      .eq("idusuario", idusuario)
      .gte("fecha", `${date}T00:00:00.000Z`)
      .lte("fecha", `${date}T23:59:59.999Z`);

    if (foodsError) {
      return res.status(500).json({ error: 'Error al consultar las comidas en la base de datos' });
    }

    // Determina el tipo de comida según la hora
    const determineFoodType = (dateTime) => {
      const date = new Date(dateTime);
      const hour = parseInt(date.toLocaleString('es-ES', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }), 10);
      if (hour >= 5 && hour < 12) return "Desayuno";
      if (hour >= 12 && hour < 15) return "Almuerzo";
      if (hour >= 15 && hour < 19) return "Merienda";
      if (hour >= 19 || hour < 2) return "Cena";
      return "Otros";
    };

    // Determina el tipo de comida actual según la hora actual
    const determineCurrentFoodType = () => {
      const hour = parseInt(now.toLocaleString('es-ES', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }), 10);
      if (hour >= 5 && hour < 12) return "Desayuno";
      if (hour >= 12 && hour < 15) return "Almuerzo";
      if (hour >= 15 && hour < 19) return "Merienda";
      if (hour >= 19 || hour < 2) return "Cena";
      return "Otros";
    };

    // Verifica si la comida es del día actual
    const isFoodFromToday = (foodDate) => {
      const foodDateFormatted = new Date(foodDate).toLocaleDateString("en-CA", { timeZone: TIMEZONE });
      const currentDateFormatted = now.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
      return foodDateFormatted === currentDateFormatted;
    };

    // Organiza las comidas y añade el campo isEditable
    const organizedFoods = {
      Desayuno: [],
      Almuerzo: [],
      Merienda: [],
      Cena: [],
    };

    foods.forEach((food) => {
      const foodType = determineFoodType(food.fecha);
      if (foodType !== "Otros") {
        organizedFoods[foodType].push({
          ...food,
          isEditable: isFoodFromToday(food.fecha),
        });
      }
    });

    const currentFoodType = determineCurrentFoodType();
    const isToday = date === now.toLocaleDateString("en-CA", { timeZone: TIMEZONE });

    res.status(200).json({
      foods: organizedFoods,
      currentFoodType: currentFoodType === "Otros" ? null : currentFoodType,
      isToday,
    });
  } catch (error) {
    console.error(`[ERROR] Error interno al consultar las comidas: ${error.message}`);
    res.status(500).json({ error: "Error interno al consultar las comidas" });
  }
};

// Endpoint para eliminar una comida
export const deleteFood = async (req, res) => {
  const { email, food_id } = req.body;

  if (!email || !food_id) {
    return res.status(400).json({ error: 'Faltan datos requeridos: email y food_id son obligatorios' });
  }

  try {
    const now = new Date();

    const { data: user, error: userError } = await supabase
      .from("Inicio Sesion")
      .select("idusuario")
      .eq("Correo", email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: `Usuario con correo ${email} no encontrado` });
    }

    const idusuario = user.idusuario;
    const currentDate = now.toISOString().split("T")[0];

    const { data: foods, error: foodError } = await supabase
      .from("ComidasxUsuario")
      .select("id_comida, fecha")
      .eq("idusuario", idusuario)
      .eq("id_comida", food_id)
      .gte("fecha", `${currentDate}T00:00:00.000Z`)
      .lte("fecha", `${currentDate}T23:59:59.999Z`);

    if (foodError) {
      console.log("Error al buscar comida:", foodError.message);
      return res.status(500).json({ error: "Error al buscar la comida en la base de datos" });
    }

    if (!foods || foods.length === 0) {
      console.log("Comidas encontradas:", foods);
      return res.status(404).json({ error: `Comida con ID ${food_id} no encontrada para este usuario` });
    }

    const { error: deleteError } = await supabase
      .from("ComidasxUsuario")
      .delete()
      .eq("idusuario", idusuario)
      .eq("id_comida", food_id)
      .gte("fecha", `${currentDate}T00:00:00.000Z`)
      .lte("fecha", `${currentDate}T23:59:59.999Z`)
      .order("fecha", { ascending: false })
      .limit(1);

    if (deleteError) {
      console.log("Error al eliminar:", deleteError.message);
      return res.status(500).json({ error: "Error al eliminar la comida de la base de datos" });
    }

    res.status(200).json({ message: "Comida eliminada con éxito" });
  } catch (error) {
    console.error(`[ERROR] Error interno al eliminar la comida: ${error.message}`);
    res.status(500).json({ error: "Error interno al eliminar la comida" });
  }
};