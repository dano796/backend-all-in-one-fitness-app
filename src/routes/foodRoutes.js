import axios from 'axios';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Variables de entorno
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const API_URL = 'https://platform.fatsecret.com/rest/server.api';
const CONSUMER_KEY = process.env.FATSECRET_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.FATSECRET_CONSUMER_SECRET;
const OAUTH_VERSION = '1.0';
const OAUTH_SIGNATURE_METHOD = 'HMAC-SHA1';

// Inicializar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
console.log('Inicializando Supabase con URL:', supabaseUrl, 'y Key:', supabaseKey ? 'presente' : 'ausente');
const supabase = createClient(supabaseUrl, supabaseKey);

// Verificar conexión con Supabase al inicio
(async () => {
  try {
    const { data, error } = await supabase.from('comidasregistradas').select('id_registro', { count: 'exact' });
    console.log('Health check Supabase:', { data, error, count: data ? data.length : 'sin datos' });
  } catch (err) {
    console.error('Error en health check de Supabase:', err);
  }
})();

// Genera un "nonce" aleatorio para la autenticación en FatSecret
const generateNonce = () => Math.random().toString(36).substring(2, 15);

// Genera un timestamp en formato UNIX (segundos desde 1970)
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

// Función para traducir texto usando la API de OpenAI (GPT-4o Mini)
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
    console.error('Error al traducir con OpenAI:', error);
    throw error;
  }
};

// Función para buscar alimentos en la API de FatSecret
export const searchFoods = async (req, res) => {
  let { query, max_results = '10' } = req.query;

  try {
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
    console.error('Error en searchFoods:', error);
    res.status(500).json({ error: 'Error al consultar la API de FatSecret o al traducir con OpenAI' });
  }
};

// Función para registrar comidas en la tabla ComidasRegistradas
export const logFood = async (req, res) => {
  const { user_id, food_id, nombre_comida, descripcion } = req.body;

  console.log('Datos recibidos en logFood:', req.body);

  // Validación básica
  if (!user_id || !food_id || !nombre_comida) {
    return res.status(400).json({ error: "Faltan datos requeridos: user_id, food_id, nombre_comida" });
  }

  try {
    console.log('Intentando insertar en Supabase con:', { user_id, food_id, nombre_comida, descripcion });
    const { data, error } = await supabase
      .from("comidasregistradas") // Usar minúsculas aquí
      .insert({
        id_usuario: user_id,
        id_comida: food_id,
        nombre_comida,
        descripcion,
        fecha: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error('Error completo al registrar comida:', JSON.stringify(error, null, 2));
      return res.status(500).json({ error: "Error al registrar la comida", details: error });
    }

    console.log('Inserción exitosa, datos devueltos:', data);
    return res.status(201).json({ success: "Comida registrada con éxito", data: data[0] });
  } catch (err) {
    console.error('Excepción al registrar comida:', err.message || err.stack || err);
    return res.status(500).json({ error: "Ocurrió un error inesperado", details: err.message || err.stack || err });
  }
};

export default { searchFoods, logFood };