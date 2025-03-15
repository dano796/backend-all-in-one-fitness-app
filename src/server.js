import axios from 'axios';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';

dotenv.config(); // Cargar variables de entorno desde el archivo .env

// Claves y URLs para las APIs de OpenAI y FatSecret
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const API_URL = 'https://platform.fatsecret.com/rest/server.api';
const CONSUMER_KEY = process.env.FATSECRET_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.FATSECRET_CONSUMER_SECRET;
const OAUTH_VERSION = '1.0';
const OAUTH_SIGNATURE_METHOD = 'HMAC-SHA1';

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
        model: 'gpt-4o-mini', // Modelo utilizado para la traducción
        messages: [
          { role: 'system', content: `You are a translator. Translate the following text to ${targetLang}.` },
          { role: 'user', content: text },
        ],
        max_tokens: 15, // Límite de tokens para evitar respuestas demasiado largas
        temperature: 0.3, // Reduce la variabilidad para respuestas más precisas
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.choices[0].message.content.trim(); // Devuelve el texto traducido
  } catch (error) {
    console.error('Error al traducir con OpenAI:', error);
    throw error;
  }
};

// Función principal para buscar alimentos en la API de FatSecret
export const searchFoods = async (req, res) => {
  let { query, max_results = '10' } = req.query;

  try {
    // 1. Traducir el término de búsqueda al inglés para FatSecret
    query = await translateTextWithOpenAI(query, 'en');

    // 2. Configurar los parámetros de la solicitud a FatSecret
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

    // 3. Generar la firma de autenticación
    const signature = generateSignature('GET', API_URL, params);
    params.oauth_signature = signature;

    // 4. Realizar la solicitud GET a la API de FatSecret
    const response = await axios.get(API_URL, { params });
    const foodData = response.data.foods.food; // Extraer los alimentos de la respuesta

    if (!foodData) {
      return res.json(response.data); // Si no hay resultados, devolver la respuesta tal cual
    }

    // 5. Traducir los nombres de los alimentos al español
    const translatedFoods = await Promise.all(
      (Array.isArray(foodData) ? foodData : [foodData]).map(async (food) => {
        const translatedName = await translateTextWithOpenAI(food.food_name, 'es');
        return {
          ...food,
          food_name: translatedName, // Reemplazar con la traducción
        };
      })
    );

    // 6. Devolver los resultados con los nombres traducidos
    res.json({
      ...response.data,
      foods: {
        ...response.data.foods,
        food: translatedFoods,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar la API de FatSecret o al traducir con OpenAI' });
  }
};
