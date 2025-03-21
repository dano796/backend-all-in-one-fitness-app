import { supabase } from "../lib/supabaseClient.js";

// Helper function to get idusuario from email
const getIdUsuarioByEmail = async (email) => {
  console.log(`[getIdUsuarioByEmail] Starting lookup for email: ${email}`);
  try {
    const { data, error } = await supabase
      .from("Inicio Sesion")
      .select("idusuario")
      .eq("Correo", email)
      .single();

    if (error || !data) {
      console.error(`[getIdUsuarioByEmail] Error: User not found for email: ${email}, Error: ${error?.message}`);
      throw new Error("Usuario no encontrado en la tabla inicio_sesion.");
    }

    console.log(`[getIdUsuarioByEmail] Found idusuario: ${data.idusuario} for email: ${email}`);
    return data.idusuario;
  } catch (err) {
    console.error(`[getIdUsuarioByEmail] Unexpected error: ${err.message}`);
    throw new Error("Error al buscar el idusuario: " + err.message);
  }
};

// Fetch water data for a user on a specific date
export const getWaterByUserAndDate = async (req, res) => {
  const { email, date } = req.query;

  console.log(`[getWaterByUserAndDate] Request received - Email: ${email}, Date: ${date}`);

  if (!email || !date) {
    console.warn(`[getWaterByUserAndDate] Missing parameters - Email: ${email}, Date: ${date}`);
    return res.status(400).json({ error: "Email y fecha son requeridos." });
  }

  try {
    // Get idusuario from email
    const idusuario = await getIdUsuarioByEmail(email);
    console.log(`[getWaterByUserAndDate] Retrieved idusuario: ${idusuario}`);

    console.log(`[getWaterByUserAndDate] Querying aguaxusuario for idusuario: ${idusuario}, Date: ${date}`);
    const { data, error } = await supabase
      .from("aguaxusuario")
      .select("aguasllenadas")
      .eq("idusuario", idusuario)
      .eq("fecha", date)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error(`[getWaterByUserAndDate] Error querying aguaxusuario: ${error.message}`);
      return res.status(500).json({ error: "Error al consultar los datos de agua." });
    }

    const aguasllenadas = data ? data.aguasllenadas : 0;
    console.log(`[getWaterByUserAndDate] Successfully retrieved aguasllenadas: ${aguasllenadas}`);
    return res.status(200).json({ aguasllenadas }); // Changed to match the field name
  } catch (err) {
    console.error(`[getWaterByUserAndDate] Unexpected error: ${err.message}`);
    return res.status(500).json({ error: err.message || "Error en el servidor." });
  }
};

// Update or insert water data for a user on a specific date
export const updateWaterData = async (req, res) => {
  const { email, date, aguasllenadas } = req.body; // Changed from bottles to aguasllenadas

  console.log(`[updateWaterData] Request received - Email: ${email}, Date: ${date}, Aguasllenadas: ${aguasllenadas}`);

  if (!email || !date || aguasllenadas === undefined) {
    console.warn(`[updateWaterData] Missing parameters - Email: ${email}, Date: ${date}, Aguasllenadas: ${aguasllenadas}`);
    return res.status(400).json({ error: "Email, fecha y aguasllenadas son requeridos." });
  }

  try {
    // Get idusuario from email
    const idusuario = await getIdUsuarioByEmail(email);
    console.log(`[updateWaterData] Retrieved idusuario: ${idusuario}`);

    // Check if a record exists
    console.log(`[updateWaterData] Checking if record exists for idusuario: ${idusuario}, Date: ${date}`);
    const { data: existingData, error: fetchError } = await supabase
      .from("aguaxusuario")
      .select("id_registro")
      .eq("idusuario", idusuario)
      .eq("fecha", date)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error(`[updateWaterData] Error checking existing record: ${fetchError.message}`);
      return res.status(500).json({ error: "Error al verificar los datos de agua." });
    }

    if (existingData) {
      // Update existing record
      console.log(`[updateWaterData] Updating existing record with id_registro: ${existingData.id_registro}, aguasllenadas: ${aguasllenadas}`);
      const { error: updateError } = await supabase
        .from("aguaxusuario")
        .update({ aguasllenadas }) // Changed from botellas to aguasllenadas
        .eq("id_registro", existingData.id_registro);

      if (updateError) {
        console.error(`[updateWaterData] Error updating record: ${updateError.message}`);
        return res.status(500).json({ error: "Error al actualizar los datos de agua." });
      }
      console.log(`[updateWaterData] Successfully updated record with id_registro: ${existingData.id_registro}`);
    } else {
      // Insert new record
      console.log(`[updateWaterData] Inserting new record for idusuario: ${idusuario}, Date: ${date}, aguasllenadas: ${aguasllenadas}`);
      const { error: insertError } = await supabase
        .from("aguaxusuario")
        .insert({ idusuario, fecha: date, aguasllenadas }); // Changed from botellas to aguasllenadas

      if (insertError) {
        console.error(`[updateWaterData] Error inserting new record: ${insertError.message}`);
        return res.status(500).json({ error: "Error al guardar los datos de agua." });
      }
      console.log(`[updateWaterData] Successfully inserted new record`);
    }

    console.log(`[updateWaterData] Operation completed successfully`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(`[updateWaterData] Unexpected error: ${err.message}`);
    return res.status(500).json({ error: err.message || "Error en el servidor." });
  }
};