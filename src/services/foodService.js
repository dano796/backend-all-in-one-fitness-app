import axios from 'axios';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';
import { supabase } from '../config/supabaseClient.js';
import { getIdUsuarioByEmail } from '../utils/helpers.js';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';
const CONSUMER_KEY = process.env.FATSECRET_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.FATSECRET_CONSUMER_SECRET;
const OAUTH_VERSION = '1.0';
const OAUTH_SIGNATURE_METHOD = 'HMAC-SHA1';

const generateNonce = () => Math.random().toString(36).substring(2, 15);
const generateTimestamp = () => Math.floor(Date.now() / 1000).toString();

const generateSignature = (method, url, params) => {
  const paramString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(CONSUMER_SECRET)}&`;
  return CryptoJS.HmacSHA1(baseString, signingKey).toString(CryptoJS.enc.Base64);
};

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

const parseFoodDescription = (description) => {
  const result = {
    calories: null,
    fat: null,
    carbs: null,
    protein: null,
    perg: null,
    peroz: null,
    percup: null,
    peru: null,
  };

  if (!description) {
    return result;
  }

  const parts = description.split(' - ');
  if (parts.length < 2) {
    return result;
  }

  const perPart = parts[0].trim();
  const perMatchG = perPart.match(/Per\s+(\d+(?:\.\d+)?)\s*g/i);
  const perMatchOz = perPart.match(/Per\s+([\d\/]+)\s*(fl\s*)?oz/i);
  const perMatchCup = perPart.match(/Per\s+([\d\/]+)\s*(cup|cups)/i);
  const perMatchUnit = perPart.match(/Per\s+(\d+)\s*(\w+)/i);

  if (perMatchG) {
    result.perg = parseInt(perMatchG[1], 10);
  } else if (perMatchOz) {
    const ozValue = perMatchOz[1];
    result.peroz = parseFraction(ozValue);
  } else if (perMatchCup) {
    const cupValue = perMatchCup[1];
    result.percup = parseFraction(cupValue);
  } else if (perMatchUnit) {
    const unitValue = perMatchUnit[1];
    result.peru = parseInt(unitValue, 10);
  }

  const nutritionPart = parts[1].split(' | ');
  nutritionPart.forEach((item) => {
    if (item.includes('Calories')) {
      const match = item.match(/Calories:\s*(\d+)\s*kcal/i);
      if (match) result.calories = parseInt(match[1], 10);
    } else if (item.includes('Fat')) {
      const match = item.match(/Fat:\s*([\d.]+)\s*g/i);
      if (match) result.fat = parseFloat(match[1]);
    } else if (item.includes('Carbs')) {
      const match = item.match(/Carbs:\s*([\d.]+)\s*g/i);
      if (match) result.carbs = parseFloat(match[1]);
    } else if (item.includes('Protein')) {
      const match = item.match(/Protein:\s*([\d.]+)\s*g/i);
      if (match) result.protein = parseFloat(match[1]);
    }
  });

  return result;
};

const parseFraction = (value) => {
  if (typeof value !== 'string') return null;

  const fractionMatch = value.match(/^(\d+)(?:\/(\d+))?$/);
  if (fractionMatch) {
    const whole = fractionMatch[1];
    const numerator = fractionMatch[2] ? fractionMatch[2] : null;
    if (numerator) {
      return `${whole}/${numerator}`;
    }
    return parseInt(whole, 10);
  }
  return parseInt(value, 10) || null;
};

export const searchFoods = async ({ query, max_results }) => {
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
    return response.data;
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

  return {
    ...response.data,
    foods: {
      ...response.data.foods,
      food: translatedFoods,
    },
  };
};

export const addFood = async ({ email, food_id, food_name, food_description, type }) => {
  const now = new Date();
  const idusuario = await getIdUsuarioByEmail(email);

  const parsedDescription = parseFoodDescription(food_description);

  let baseUnit = null;
  let baseQuantity = null;
  if (parsedDescription.perg) {
    baseUnit = 'g';
    baseQuantity = parsedDescription.perg;
  } else if (parsedDescription.peroz) {
    baseUnit = 'oz';
    baseQuantity = parsedDescription.peroz;
  } else if (parsedDescription.percup) {
    baseUnit = 'cup';
    baseQuantity = parsedDescription.percup;
  } else if (parsedDescription.peru) {
    baseUnit = 'unit';
    baseQuantity = parsedDescription.peru;
  }

  let adjustedCalories = parsedDescription.calories;
  let adjustedFat = parsedDescription.fat;
  let adjustedCarbs = parsedDescription.carbs;
  let adjustedProtein = parsedDescription.protein;

  const perMatchG = food_description.match(/Per\s+(\d+(?:\.\d+)?)\s*g/i);
  const perMatchOz = food_description.match(/Per\s+([\d\/]+)\s*(fl\s*)?oz/i);
  const perMatchCup = food_description.match(/Per\s+([\d\/]+)\s*(cup|cups)/i);
  const perMatchUnit = food_description.match(/Per\s+(\d+)\s*(\w+)/i);

  let adjustedQuantity = null;
  let adjustedUnit = null;

  if (perMatchG) {
    adjustedQuantity = parseInt(perMatchG[1], 10);
    adjustedUnit = 'g';
  } else if (perMatchOz) {
    adjustedQuantity = parseFraction(perMatchOz[1]);
    adjustedUnit = 'oz';
  } else if (perMatchCup) {
    adjustedQuantity = parseFraction(perMatchCup[1]);
    adjustedUnit = 'cup';
  } else if (perMatchUnit) {
    adjustedQuantity = parseInt(perMatchUnit[1], 10);
    adjustedUnit = 'unit';
  }

  if (adjustedQuantity && adjustedUnit && baseQuantity && baseUnit) {
    let factor = 1;

    if (adjustedUnit === 'g' && baseUnit === 'g') {
      factor = adjustedQuantity / baseQuantity;
    } else if (adjustedUnit === 'oz' && baseUnit === 'oz') {
      factor = adjustedQuantity / baseQuantity;
    } else if (adjustedUnit === 'cup' && baseUnit === 'cup') {
      factor = adjustedQuantity / baseQuantity;
    } else if (adjustedUnit === 'unit' && baseUnit === 'unit') {
      factor = adjustedQuantity / baseQuantity;
    } else {
      if (baseUnit === 'g' && adjustedUnit === 'oz') {
        factor = (adjustedQuantity * 28.3495) / baseQuantity;
      } else if (baseUnit === 'oz' && adjustedUnit === 'g') {
        factor = (adjustedQuantity / 28.3495) / baseQuantity;
      } else if (baseUnit === 'g' && adjustedUnit === 'cup') {
        factor = (adjustedQuantity * 240) / baseQuantity;
      } else if (baseUnit === 'cup' && adjustedUnit === 'g') {
        factor = (adjustedQuantity / 240) / baseQuantity;
      } else if (baseUnit === 'oz' && adjustedUnit === 'cup') {
        factor = (adjustedQuantity * 8) / baseQuantity;
      } else if (baseUnit === 'cup' && adjustedUnit === 'oz') {
        factor = (adjustedQuantity / 8) / baseQuantity;
      } else {
        if (baseUnit === 'unit' && adjustedUnit === 'unit') {
          factor = adjustedQuantity / baseQuantity;
        } else {
          factor = 1;
        }
      }
    }

    adjustedCalories = adjustedCalories ? Math.round(adjustedCalories * factor) : null;
    adjustedFat = adjustedFat ? Number((adjustedFat * factor).toFixed(2)) : null;
    adjustedCarbs = adjustedCarbs ? Number((adjustedCarbs * factor).toFixed(2)) : null;
    adjustedProtein = adjustedProtein ? Number((adjustedProtein * factor).toFixed(2)) : null;
  }

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
      calorias: adjustedCalories,
      grasas: adjustedFat,
      carbs: adjustedCarbs,
      proteina: adjustedProtein,
      perg: adjustedUnit === 'g' ? adjustedQuantity : parsedDescription.perg,
      peroz: adjustedUnit === 'oz' ? adjustedQuantity : parsedDescription.peroz,
      percup: adjustedUnit === 'cup' ? adjustedQuantity : parsedDescription.percup,
      peru: adjustedUnit === 'unit' ? adjustedQuantity : parsedDescription.peru,
      tipo: type,
    });

  if (insertError) {
    throw new Error('Error al guardar la comida en la base de datos: ' + insertError.message);
  }

  return { message: "Comida agregada con éxito" };
};

export const getFoodsByUserAndDate = async ({ email, date }) => {
  const TIMEZONE = 'America/Bogota';
  const now = new Date();
  const idusuario = await getIdUsuarioByEmail(email);

  const { data: foods, error: foodsError } = await supabase
    .from("ComidasxUsuario")
    .select("id_registro, id_comida, nombre_comida, descripcion, fecha, calorias, grasas, carbs, proteina, perg, peroz, percup, peru, tipo")
    .eq("idusuario", idusuario)
    .gte("fecha", `${date}T00:00:00.000Z`)
    .lte("fecha", `${date}T23:59:59.999Z`);

  if (foodsError) {
    throw new Error('Error al consultar las comidas en la base de datos');
  }

  const organizedFoods = {
    Desayuno: [],
    Almuerzo: [],
    Merienda: [],
    Cena: [],
  };

  foods.forEach((food) => {
    if (food.tipo && organizedFoods[food.tipo]) {
      organizedFoods[food.tipo].push({
        ...food,
        isEditable: new Date(food.fecha).toLocaleDateString("en-CA", { timeZone: TIMEZONE }) === new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE }),
      });
    }
  });

  const currentFoodType = null;
  const isToday = date === now.toLocaleDateString("en-CA", { timeZone: TIMEZONE });

  return {
    foods: organizedFoods,
    currentFoodType,
    isToday,
  };
};

export const deleteFood = async ({ email, id_registro }) => {
  const idusuario = await getIdUsuarioByEmail(email);

  const { data: foods, error: foodError } = await supabase
    .from("ComidasxUsuario")
    .select("id_registro, idusuario")
    .eq("idusuario", idusuario)
    .eq("id_registro", id_registro);

  if (foodError) {
    throw new Error("Error al buscar la comida en la base de datos: " + foodError.message);
  }

  if (!foods || foods.length === 0) {
    throw new Error(`Comida con id_registro ${id_registro} no encontrada para este usuario`);
  }

  if (foods[0].idusuario !== idusuario) {
    throw new Error('No tienes permiso para eliminar esta comida');
  }

  const { error: deleteError } = await supabase
    .from("ComidasxUsuario")
    .delete()
    .eq("idusuario", idusuario)
    .eq("id_registro", id_registro);

  if (deleteError) {
    throw new Error("Error al eliminar la comida de la base de datos: " + deleteError.message);
  }

  return { message: "Comida eliminada con éxito" };
};