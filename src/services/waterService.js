import { supabase } from '../config/supabaseClient.js';
import { getIdUsuarioByEmail } from '../utils/helpers.js';

export const getWaterByUserAndDate = async ({ email, date }) => {
  const idusuario = await getIdUsuarioByEmail(email);

  const { data, error } = await supabase
    .from("aguaxusuario")
    .select("aguasllenadas")
    .eq("idusuario", idusuario)
    .eq("fecha", date)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error("Error al consultar los datos de agua.");
  }

  const aguasllenadas = data ? data.aguasllenadas : 0;
  return { aguasllenadas };
};

export const updateWaterData = async ({ email, date, aguasllenadas }) => {
  const idusuario = await getIdUsuarioByEmail(email);

  const { data: existingData, error: fetchError } = await supabase
    .from("aguaxusuario")
    .select("id_registro")
    .eq("idusuario", idusuario)
    .eq("fecha", date)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw new Error("Error al verificar los datos de agua.");
  }

  if (existingData) {
    const { error: updateError } = await supabase
      .from("aguaxusuario")
      .update({ aguasllenadas })
      .eq("id_registro", existingData.id_registro);

    if (updateError) {
      throw new Error("Error al actualizar los datos de agua.");
    }
  } else {
    const { error: insertError } = await supabase
      .from("aguaxusuario")
      .insert({ idusuario, fecha: date, aguasllenadas });

    if (insertError) {
      throw new Error("Error al guardar los datos de agua.");
    }
  }

  return { success: true };
};