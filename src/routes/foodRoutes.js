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
  console.log(`[INFO] Iniciando traducción de texto: "${text}" a ${targetLang}`);
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
    const translatedText = response.data.choices[0].message.content.trim();
    console.log(`[INFO] Traducción exitosa: "${text}" -> "${translatedText}"`);
    return translatedText;
  } catch (error) {
    console.error(`[ERROR] Error al traducir el texto con OpenAI: ${error.message}`);
    throw new Error('Error al traducir el texto con OpenAI');
  }
};

// Función para extraer datos nutricionales y valores de "per" de la descripción
const extractNutritionalData = (description) => {
  console.log(`[INFO] Extrayendo datos nutricionales de la descripción: "${description}"`);
  const parts = description.split('|').map(part => part.trim());

  // Extraer valores de "perg" y "peroz"
  let perg = null, peroz = null;
  const perPart = parts[0].toLowerCase();

  // Verificar si es "Per #g"
  const perGramMatch = perPart.match(/per\s+(\d+)\s*g/i);
  if (perGramMatch) {
    perg = perGramMatch[1]; // Extrae solo el número (e.g., "100")
  }

  // Verificar si es "Per # oz" o "Per # fl oz"
  const perOzMatch = perPart.match(/per\s+(\d+)\s*(fl\s*)?oz/i);
  if (perOzMatch) {
    peroz = perOzMatch[1]; // Extrae solo el número (e.g., "8")
  }

  console.log(`[INFO] Valores de per extraídos: perg=${perg}, peroz=${peroz}`);

  // Extraer valores numéricos con expresiones regulares
  let calorias = null, grasas = null, carbs = null, proteina = null;

  parts.forEach(part => {
    if (part.includes('Calories:')) {
      const match = part.match(/Calories:\s*(\d*\.?\d+)/i);
      calorias = match ? match[1] : null;
    }
    if (part.includes('Fat:')) {
      const match = part.match(/Fat:\s*(\d*\.?\d+)/i);
      grasas = match ? match[1] : null;
    }
    if (part.includes('Carbs:')) {
      const match = part.match(/Carbs:\s*(\d*\.?\d+)/i);
      carbs = match ? match[1] : null;
    }
    if (part.includes('Protein:')) {
      const match = part.match(/Protein:\s*(\d*\.?\d+)/i);
      proteina = match ? match[1] : null;
    }
  });

  console.log(`[INFO] Datos nutricionales extraídos: calorias=${calorias}, grasas=${grasas}, carbs=${carbs}, proteina=${proteina}`);
  return { perg, peroz, calorias, grasas, carbs, proteina };
};

// Endpoint para buscar alimentos en la API de FatSecret
export const searchFoods = async (req, res) => {
  console.log(`[INFO] Entrando en endpoint searchFoods. Query: ${req.query.query}, Max Results: ${req.query.max_results}`);
  let { query, max_results = '10' } = req.query;

  if (!query) {
    console.log(`[WARN] Parámetro "query" no proporcionado`);
    return res.status(400).json({ error: 'El parámetro "query" es requerido' });
  }

  try {
    query = await translateTextWithOpenAI(query, 'en');
    console.log(`[INFO] Query traducido a inglés: ${query}`);

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

    console.log(`[INFO] Parámetros para la firma OAuth: ${JSON.stringify(params)}`);
    const signature = generateSignature('GET', API_URL, params);
    params.oauth_signature = signature;
    console.log(`[INFO] Firma OAuth generada: ${signature}`);

    console.log(`[INFO] Realizando solicitud a FatSecret API con params: ${JSON.stringify(params)}`);
    const response = await axios.get(API_URL, { params });
    console.log(`[INFO] Respuesta recibida de FatSecret API: ${JSON.stringify(response.data)}`);
    const foodData = response.data.foods.food;

    if (!foodData) {
      console.log(`[INFO] No se encontraron alimentos en la respuesta`);
      return res.json(response.data);
    }

    const translatedFoods = await Promise.all(
      (Array.isArray(foodData) ? foodData : [foodData]).map(async (food) => {
        console.log(`[INFO] Traduciendo nombre de alimento: ${food.food_name}`);
        const translatedName = await translateTextWithOpenAI(food.food_name, 'es');
        const serving = food.servings?.serving?.[0] || {};
        const description = serving.measurement_description || food.food_description || 'Per 100g';
        const { perg, peroz, calorias, grasas, carbs, proteina } = extractNutritionalData(description);
        console.log(`[INFO] Datos extraídos de descripción: perg=${perg}, peroz=${peroz}, calorias=${calorias}, grasas=${grasas}, carbs=${carbs}, proteina=${proteina}`);
        return {
          ...food,
          food_name: translatedName,
          perg,
          peroz,
          calorias,
          grasas,
          carbs,
          proteina,
        };
      })
    );

    console.log(`[INFO] Alimentos traducidos: ${JSON.stringify(translatedFoods)}`);
    res.json({
      ...response.data,
      foods: {
        ...response.data.foods,
        food: translatedFoods,
      },
    });
    console.log(`[INFO] Respuesta enviada al cliente`);
  } catch (error) {
    console.error(`[ERROR] Error al consultar la API de FatSecret o al traducir con OpenAI: ${error.message}`);
    res.status(500).json({ error: 'Error al consultar la API de FatSecret o al traducir con OpenAI' });
  }
};

// Endpoint para agregar una comida
export const addFood = async (req, res) => {
  console.log(`[INFO] Entrando en endpoint addFood. Datos recibidos: ${JSON.stringify(req.body)}`);
  const { email, food_id, food_name, food_description, calorias, grasas, carbs, proteina, perg, peroz } = req.body;

  if (!email || !food_id || !food_name || !food_description) {
    console.log(`[WARN] Faltan datos requeridos: email=${email}, food_id=${food_id}, food_name=${food_name}, food_description=${food_description}`);
    return res.status(400).json({ error: 'Faltan datos requeridos: email, food_id, food_name y food_description son obligatorios' });
  }

  try {
    const now = new Date().toISOString();
    console.log(`[INFO] Fecha actual: ${now}`);

    console.log(`[INFO] Buscando usuario con email: ${email}`);
    const { data: user, error: userError } = await supabase
      .from("Inicio Sesion")
      .select("idusuario")
      .eq("Correo", email)
      .single();

    if (userError || !user) {
      console.log(`[ERROR] Usuario no encontrado o error en consulta. Email: ${email}, Error: ${userError?.message || 'Usuario no existe'}`);
      return res.status(404).json({ error: `Usuario con correo ${email} no encontrado` });
    }

    const idusuario = user.idusuario;
    console.log(`[INFO] Usuario encontrado. ID: ${idusuario}`);

    // Extraer datos de la descripción si no se proporcionan en el cuerpo
    const { perg: extractedPerg, peroz: extractedPeroz, calorias: extractedCalorias, grasas: extractedGrasas, carbs: extractedCarbs, proteina: extractedProteina } = extractNutritionalData(food_description);
    const finalPerg = perg || extractedPerg;
    const finalPeroz = peroz || extractedPeroz;
    const finalCalorias = calorias || extractedCalorias;
    const finalGrasas = grasas || extractedGrasas;
    const finalCarbs = carbs || extractedCarbs;
    const finalProteina = proteina || extractedProteina;

    console.log(`[INFO] Valores finales: perg=${finalPerg}, peroz=${finalPeroz}, calorias=${finalCalorias}, grasas=${finalGrasas}, carbs=${finalCarbs}, proteina=${finalProteina}`);

    console.log(`[INFO] Insertando comida en la base de datos con datos: idusuario=${idusuario}, id_comida=${food_id}, nombre_comida=${food_name}, descripcion=${food_description}, fecha=${now}, perg=${finalPerg}, peroz=${finalPeroz}, calorias=${finalCalorias}, grasas=${finalGrasas}, carbs=${finalCarbs}, proteina=${finalProteina}`);
    const { error: insertError } = await supabase
      .from("ComidasxUsuario")
      .insert({
        idusuario: idusuario,
        id_comida: food_id,
        nombre_comida: food_name,
        descripcion: food_description,
        fecha: now,
        perg: finalPerg,
        peroz: finalPeroz,
        calorias: finalCalorias || null,
        grasas: finalGrasas || null,
        carbs: finalCarbs || null,
        proteina: finalProteina || null,
      });

    if (insertError) {
      console.log(`[ERROR] Error al guardar la comida en la base de datos: ${insertError.message}`);
      return res.status(500).json({ error: 'Error al guardar la comida en la base de datos' });
    }

    console.log(`[INFO] Comida agregada con éxito`);
    res.status(200).json({ message: "Comida agregada con éxito" });
  } catch (error) {
    console.error(`[ERROR] Error interno al agregar la comida: ${error.message}`);
    res.status(500).json({ error: "Error interno al agregar la comida" });
  }
};

// Endpoint para obtener las comidas registradas por un usuario en un día específico
export const getFoodsByUserAndDate = async (req, res) => {
  console.log(`[INFO] Entrando en endpoint getFoodsByUserAndDate. Query: ${JSON.stringify(req.query)}`);
  const { email, date } = req.query;

  if (!email || !date) {
    console.log(`[WARN] Faltan datos requeridos: email=${email}, date=${date}`);
    return res.status(400).json({ error: 'Faltan datos requeridos: email y date son obligatorios' });
  }

  try {
    const TIMEZONE = 'America/Bogota';
    const now = new Date();
    console.log(`[INFO] Fecha actual: ${now.toISOString()}`);

    console.log(`[INFO] Buscando usuario con email: ${email}`);
    const { data: user, error: userError } = await supabase
      .from("Inicio Sesion")
      .select("idusuario")
      .eq("Correo", email)
      .single();

    if (userError || !user) {
      console.log(`[ERROR] Usuario no encontrado o error en consulta. Email: ${email}, Error: ${userError?.message || 'Usuario no existe'}`);
      return res.status(404).json({ error: `Usuario con correo ${email} no encontrado` });
    }

    const idusuario = user.idusuario;
    console.log(`[INFO] Usuario encontrado. ID: ${idusuario}`);

    console.log(`[INFO] Consultando comidas para usuario ${idusuario} en fecha ${date}`);
    const { data: foods, error: foodsError } = await supabase
      .from("ComidasxUsuario")
      .select("id_comida, nombre_comida, descripcion, fecha, perg, peroz, calorias, grasas, carbs, proteina")
      .eq("idusuario", idusuario)
      .eq("fecha::date", date);

    if (foodsError) {
      console.log(`[ERROR] Error al consultar las comidas en la base de datos: ${foodsError.message}`);
      return res.status(500).json({ error: 'Error al consultar las comidas en la base de datos' });
    }

    console.log(`[INFO] Comidas encontradas: ${JSON.stringify(foods)}`);
    const organizedFoods = {
      Desayuno: [],
      Almuerzo: [],
      Merienda: [],
      Cena: [],
    };

    foods.forEach((food) => {
      organizedFoods["Otros"].push({
        ...food,
        isEditable: false,
      });
    });

    const isToday = date === now.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
    console.log(`[INFO] ¿Es hoy? ${isToday}`);

    console.log(`[INFO] Enviando respuesta al cliente con foods: ${JSON.stringify(organizedFoods)}`);
    res.status(200).json({
      foods: organizedFoods,
      currentFoodType: null,
      isToday,
    });
  } catch (error) {
    console.error(`[ERROR] Error interno al consultar las comidas: ${error.message}`);
    res.status(500).json({ error: "Error interno al consultar las comidas" });
  }
};

// Endpoint para eliminar una comida
export const deleteFood = async (req, res) => {
  console.log(`[INFO] Entrando en endpoint deleteFood. Datos recibidos: ${JSON.stringify(req.body)}`);
  const { email, food_id } = req.body;

  if (!email || !food_id) {
    console.log(`[WARN] Faltan datos requeridos. Email: ${email}, Food ID: ${food_id}`);
    return res.status(400).json({ error: 'Faltan datos requeridos: email y food_id son obligatorios' });
  }

  try {
    const now = new Date().toISOString();
    console.log(`[INFO] Fecha actual obtenida: ${now}`);

    console.log(`[INFO] Buscando usuario con email: ${email}`);
    const { data: user, error: userError } = await supabase
      .from("Inicio Sesion")
      .select("idusuario")
      .eq("Correo", email)
      .single();

    if (userError || !user) {
      console.log(`[ERROR] Usuario no encontrado o error en consulta. Email: ${email}, Error: ${userError?.message || 'Usuario no existe'}`);
      return res.status(404).json({ error: `Usuario con correo ${email} no encontrado` });
    }

    const idusuario = user.idusuario;
    console.log(`[INFO] Usuario encontrado. ID: ${idusuario}`);

    const currentDate = new Date(now).toISOString().split("T")[0];
    console.log(`[INFO] Fecha actual formateada: ${currentDate}`);

    console.log(`[INFO] Buscando comida para usuario ${idusuario} con ID ${food_id} en fecha ${currentDate}`);
    const { data: foods, error: foodError } = await supabase
      .from("ComidasxUsuario")
      .select("id_comida, fecha")
      .eq("idusuario", idusuario)
      .eq("id_comida", food_id)
      .eq("fecha::date", currentDate);

    if (foodError) {
      console.log(`[ERROR] Error al buscar comida: ${foodError.message}`);
      return res.status(500).json({ error: "Error al buscar la comida en la base de datos" });
    }

    if (!foods || foods.length === 0) {
      console.log(`[WARN] No se encontraron comidas. ID comida: ${food_id}, Usuario: ${idusuario}, Fecha: ${currentDate}`);
      return res.status(404).json({ error: `Comida con ID ${food_id} no encontrada para este usuario` });
    }

    console.log(`[INFO] Comida encontrada. Total registros: ${foods.length}, Detalle: ${JSON.stringify(foods)}`);

    console.log(`[INFO] Eliminando comida para usuario ${idusuario}, ID comida: ${food_id}`);
    const { error: deleteError } = await supabase
      .from("ComidasxUsuario")
      .delete()
      .eq("idusuario", idusuario)
      .eq("id_comida", food_id)
      .eq("fecha::date", currentDate)
      .order("fecha", { ascending: false })
      .limit(1);

    if (deleteError) {
      console.log(`[ERROR] Error al eliminar comida: ${deleteError.message}`);
      return res.status(500).json({ error: "Error al eliminar la comida de la base de datos" });
    }

    console.log(`[INFO] Comida eliminada exitosamente para usuario ${idusuario}, ID comida: ${food_id}`);
    res.status(200).json({ message: "Comida eliminada con éxito" });
  } catch (error) {
    console.error(`[ERROR] Error interno al eliminar la comida: ${error.message}`);
    res.status(500).json({ error: "Error interno al eliminar la comida" });
  }
};