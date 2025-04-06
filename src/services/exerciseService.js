import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';


const validBodyParts = [
  'back', 'cardio', 'chest', 'lower arms', 'lower legs',
  'neck', 'shoulders', 'upper arms', 'upper legs', 'waist'
];

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


export async function fetchExercises(bodyPart) {
  if (!validBodyParts.includes(bodyPart.replace('%20', ' '))) {
    throw new Error(`Parte del cuerpo no válida: ${bodyPart}. Debe ser uno de: ${validBodyParts.join(', ')}`);
  }

  const options = {
    method: 'GET',
    url: `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${bodyPart}`,
    params: {
      limit: '10',
      t: Date.now(),
    },
    headers: {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
      'Cache-Control': 'no-cache',
    },
  };

  try {
    const response = await axios.request(options);
    const exercises = response.data;

    
    const translatedExercises = await Promise.all(
      exercises.map(async (exercise) => {
        const translatedName = await translateTextWithOpenAI(exercise.name, 'es');
        const translatedTarget = await translateTextWithOpenAI(exercise.target, 'es');
        const translatedEquipment = await translateTextWithOpenAI(exercise.equipment, 'es');
        const translatedBodyPart = await translateTextWithOpenAI(exercise.bodyPart, 'es');
        const translatedInstructions = await Promise.all(
          exercise.instructions.map((instruction) =>
            translateTextWithOpenAI(instruction, 'es')
          )
        );
        const translatedSecondaryMuscles = await Promise.all(
          exercise.secondaryMuscles.map((muscle) =>
            translateTextWithOpenAI(muscle, 'es')
          )
        );

        return {
          ...exercise,
          name: translatedName,
          target: translatedTarget,
          equipment: translatedEquipment,
          bodyPart: translatedBodyPart,
          instructions: translatedInstructions,
          secondaryMuscles: translatedSecondaryMuscles,
        };
      })
    );

    return translatedExercises;
  } catch (error) {
    console.error('Error en fetchExercises:', error.response?.data || error.message);
    throw new Error('Error al consultar los ejercicios');
  }
}