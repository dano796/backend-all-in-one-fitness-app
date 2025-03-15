import axios from 'axios';
import CryptoJS from 'crypto-js';
import dotenv from 'dotenv';

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
    console.error('Error al traducir con OpenAI:', error);
    throw error;
  }
};

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
    console.error(error);
    res.status(500).json({ error: 'Error al consultar la API de FatSecret o al traducir con OpenAI' });
  }
};
