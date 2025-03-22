import { supabase } from '../config/supabaseClient.js';

export const getIdUsuarioByEmail = async (email) => {
  try {
    const { data, error } = await supabase
      .from("Inicio Sesion")
      .select("idusuario")
      .eq("Correo", email)
      .single();

    if (error || !data) {
      throw new Error("Usuario no encontrado en la tabla inicio_sesion.");
    }

    return data.idusuario;
  } catch (err) {
    throw new Error("Error al buscar el idusuario: " + err.message);
  }
};