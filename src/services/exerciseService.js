import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const validBodyParts = [
  'back', 'cardio', 'chest', 'lower arms', 'lower legs',
  'neck', 'shoulders', 'upper arms', 'upper legs', 'waist'
];

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

  console.log('URL completa enviada a RapidAPI:', options.url);
  try {
    const response = await axios.request(options);
    const exercises = response.data;
    return exercises; 
  } catch (error) {
    console.error('Error en fetchExercises:', error.response?.data || error.message);
    throw new Error('Error al consultar los ejercicios');
  }
}