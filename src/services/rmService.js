import { supabase } from '../config/supabaseClient.js';
import { getIdUsuarioByEmail } from '../utils/helpers.js';

const convertWeight = (value, fromUnit, toUnit) => {
  if (fromUnit === toUnit) return value;
  return toUnit === 'kg'
    ? Math.round(value * 0.453592)
    : Math.round(value / 0.453592);
};

export const calculateOneRepMax = async ({ weight, unit, reps, rpe, exercise }) => {
  const weightInKg = unit === 'lb' ? convertWeight(weight, 'lb', 'kg') : weight;
  const isCompound = [
    'Peso Muerto',
    'Sentadilla',
    'Press de Banca',
    'Press Militar',
  ].includes(exercise);
  
  const oneRm = isCompound
    ? weightInKg * (1 + reps / 30) // Epley
    : weightInKg * (36 / (37 - reps)); // Brzycki

  const rpeAdjustment = 1 + (10 - rpe) * 0.027;
  const adjustedOneRm = Math.round(oneRm * rpeAdjustment);
  
  return unit === 'lb' ? convertWeight(adjustedOneRm, 'kg', 'lb') : adjustedOneRm;
};

export const saveOneRepMax = async ({ email, weight, unit, reps, rpe, rm_maximo, fecha, exercise }) => {
  const idusuario = await getIdUsuarioByEmail(email);

  const { error: insertError } = await supabase
    .from('OneRepMaxRecords')
    .insert({
      idusuario,
      peso: weight,
      unidad: unit,
      repeticiones: reps,
      rpe,
      rm_maximo,
      fecha,
      ejercicio: exercise,
    });

  if (insertError) {
    throw new Error('Error al guardar el registro en la base de datos: ' + insertError.message);
  }

  return { message: '1RM guardado con éxito' };
};

export const getRMProgress = async ({ email, exercise }) => {
    const idusuario = await getIdUsuarioByEmail(email);
  
    const { data, error } = await supabase
      .from('OneRepMaxRecords')
      .select('rm_maximo, fecha, unidad')
      .eq('idusuario', idusuario)
      .eq('ejercicio', exercise)
      .order('fecha', { ascending: true });
  
    if (error) throw new Error('Error al consultar los registros: ' + error.message);
  
    return data;
  };