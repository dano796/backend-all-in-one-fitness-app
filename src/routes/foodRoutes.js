import axios from 'axios';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
import { supabase } from '../lib/supabaseClient.js';

dotenv.config(); // Carga las variables de entorno desde el archivo .env

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

// Genera la firma HMAC-SHA1 requerida por la API de FatSecret para autenticación
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
  let { query, max_results = '10' } = req.query; // Extrae la consulta y el máximo de resultados desde los parámetros de la solicitud

  if (!query) {
    return res.status(400).json({ error: 'El parámetro "query" es requerido' }); // Valida que se haya proporcionado una consulta
  }

  try {
    query = await translateTextWithOpenAI(query, 'en'); // Traduce la consulta al inglés para la búsqueda en FatSecret

    // Configura los parámetros OAuth y de búsqueda para la solicitud a FatSecret
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

    const signature = generateSignature('GET', API_URL, params); // Genera la firma OAuth
    params.oauth_signature = signature;

    const response = await axios.get(API_URL, { params }); // Realiza la solicitud a la API de FatSecret
    const foodData = response.data.foods.food;

    if (!foodData) {
      return res.json(response.data); // Si no hay datos de alimentos, devuelve la respuesta cruda
    }

    // Traduce los nombres de los alimentos al español
    const translatedFoods = await Promise.all(
      (Array.isArray(foodData) ? foodData : [foodData]).map(async (food) => {
        const translatedName = await translateTextWithOpenAI(food.food_name, 'es');
        return {
          ...food,
          food_name: translatedName,
        };
      })
    );

    // Construye y envía la respuesta con los alimentos traducidos
    res.json({
      ...response.data,
      foods: {
        ...response.data.foods,
        food: translatedFoods,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar la API de FatSecret o al traducir con OpenAI' });
  }
};

// Endpoint para agregar una comida a la tabla ComidasxUsuario en Supabase
export const addFood = async (req, res) => {
  const { email, food_id, food_name, food_description } = req.body; // Extrae los datos del cuerpo de la solicitud

  if (!email || !food_id || !food_name || !food_description) {
    return res.status(400).json({ error: 'Faltan datos requeridos: email, food_id, food_name y food_description son obligatorios' }); // Valida que todos los campos necesarios estén presentes
  }

  try {
    // Busca el ID del usuario en la tabla "Inicio Sesion" usando el correo
    const { data: user, error: userError } = await supabase
      .from("Inicio Sesion")
      .select("idusuario")
      .eq("Correo", email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: `Usuario con correo ${email} no encontrado` }); // Maneja el caso en que no se encuentre el usuario
    }

    const idusuario = user.idusuario;

    // Obtiene la fecha y hora local ajustada
    const now = new Date();
    const offsetHours = -5; // Ajusta esto según tu zona horaria (ejemplo: GMT-5)
    now.setHours(now.getHours() + offsetHours); // Ajusta la hora local
    const localDateISOString = now.toISOString(); // Convierte a formato ISO con la hora ajustada

    // Inserta la comida en la tabla "ComidasxUsuario" con los datos proporcionados
    const { error: insertError } = await supabase
      .from("ComidasxUsuario")
      .insert({
        idusuario: idusuario,
        id_comida: food_id,
        nombre_comida: food_name,
        descripcion: food_description,
        fecha: localDateISOString, // Usa la fecha ajustada
      });

    if (insertError) {
      return res.status(500).json({ error: 'Error al guardar la comida en la base de datos' }); // Maneja errores en la inserción
    }

    res.status(200).json({ message: "Comida agregada con éxito" }); // Responde con éxito si la inserción se completa
  } catch (error) {
    res.status(500).json({ error: "Error interno al agregar la comida" }); // Maneja errores inesperados
  }
};

// Endpoint para obtener las comidas registradas por un usuario en un día específico
export const getFoodsByUserAndDate = async (req, res) => {
  const { email, date } = req.query; // Extrae email y fecha de los parámetros de la solicitud

  if (!email || !date) {
    return res.status(400).json({ error: 'Faltan datos requeridos: email y date son obligatorios' });
  }

  try {
    // Busca el ID del usuario en la tabla "Inicio Sesion" usando el correo
    const { data: user, error: userError } = await supabase
      .from("Inicio Sesion")
      .select("idusuario")
      .eq("Correo", email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: `Usuario con correo ${email} no encontrado` });
    }

    const idusuario = user.idusuario;

    // Consulta las comidas registradas por el usuario en la fecha especificada
    const { data: foods, error: foodsError } = await supabase
      .from("ComidasxUsuario")
      .select("id_comida, nombre_comida, descripcion, fecha")
      .eq("idusuario", idusuario)
      .gte("fecha", `${date}T00:00:00.000Z`) // Fecha de inicio del día
      .lte("fecha", `${date}T23:59:59.999Z`); // Fecha de fin del día

    if (foodsError) {
      return res.status(500).json({ error: 'Error al consultar las comidas en la base de datos' });
    }

    res.status(200).json({ foods: foods || [] }); // Devuelve las comidas encontradas (o un arreglo vacío si no hay resultados)
  } catch (error) {
    res.status(500).json({ error: "Error interno al consultar las comidas" });
  }
};