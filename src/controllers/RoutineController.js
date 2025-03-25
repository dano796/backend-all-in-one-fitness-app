import { supabase } from '../config/supabaseClient.js';

// Obtener todas las rutinas de un usuario
export const getUserRoutines = async (req, res) => {
  const { email } = req.query;

  console.log(`[getUserRoutines] Received request with email: ${email}`);

  if (!email) {
    console.log(`[getUserRoutines] Error: Email is required`);
    return res.status(400).json({ error: 'El correo del usuario es requerido' });
  }

  try {
    console.log(`[getUserRoutines] Querying user data for email: ${email}`);
    const { data: userData, error: userError } = await supabase
      .from('Inicio Sesion')
      .select('idusuario')
      .eq('Correo', email)
      .single();

    if (userError || !userData) {
      console.log(`[getUserRoutines] Error: User not found for email: ${email}, Error: ${userError?.message || 'No user data'}`);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const idusuario = userData.idusuario;
    console.log(`[getUserRoutines] Found user with idusuario: ${idusuario}`);

    console.log(`[getUserRoutines] Querying routines for user ID: ${idusuario}`);
    const { data, error } = await supabase
      .from('Rutinas')
      .select(`
        id_rutina,
        idusuario,
        id_dia,
        rutina,
        ejercicios,
        DiasRutinas (
          desc_dia
        )
      `)
      .eq('idusuario', idusuario);

    if (error) {
      console.log(`[getUserRoutines] Error querying routines: ${error.message}`);
      throw error;
    }

    console.log(`[getUserRoutines] Retrieved ${data.length} routines for user ID: ${idusuario}`);
    const formattedRoutines = data.map((routine) => ({
      id: routine.id_rutina,
      day: routine.DiasRutinas.desc_dia,
      name: routine.rutina,
      exercises: routine.ejercicios || [],
    }));

    console.log(`[getUserRoutines] Successfully formatted routines:`, formattedRoutines);
    res.status(200).json({ routines: formattedRoutines });
  } catch (error) {
    console.error(`[getUserRoutines] Unexpected error: ${error.message}`);
    res.status(500).json({ error: 'Error al consultar las rutinas' });
  }
};

// Crear una nueva rutina
export const createRoutine = async (req, res) => {
  const { user_email, day, name, exercises } = req.body;

  console.log(`[createRoutine] Received request with data:`, { user_email, day, name, exercises });

  if (!user_email || !day || !name) {
    console.log(`[createRoutine] Error: Missing required fields - user_email: ${user_email}, day: ${day}, name: ${name}`);
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  try {
    console.log(`[createRoutine] Querying user data for email: ${user_email}`);
    const { data: userData, error: userError } = await supabase
      .from('Inicio Sesion')
      .select('idusuario')
      .eq('Correo', user_email)
      .single();

    if (userError || !userData) {
      console.log(`[createRoutine] Error: User not found for email: ${user_email}, Error: ${userError?.message || 'No user data'}`);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const idusuario = userData.idusuario;
    console.log(`[createRoutine] Found user with idusuario: ${idusuario}`);

    console.log(`[createRoutine] Querying day ID for day: ${day}`);
    const { data: dayData, error: dayError } = await supabase
      .from('DiasRutinas')
      .select('id_dia')
      .eq('desc_dia', day)
      .single();

    if (dayError || !dayData) {
      console.log(`[createRoutine] Error: Day not found for desc_dia: ${day}, Error: ${dayError?.message || 'No day data'}`);
      return res.status(404).json({ error: 'Día no encontrado' });
    }

    const id_dia = dayData.id_dia;
    console.log(`[createRoutine] Found day with id_dia: ${id_dia}`);

    console.log(`[createRoutine] Inserting new routine for user ID: ${idusuario}, day ID: ${id_dia}`);
    const { data, error } = await supabase
      .from('Rutinas')
      .insert([
        {
          idusuario,
          id_dia,
          rutina: name,
          ejercicios: exercises || [],
        },
      ])
      .select(`
        id_rutina,
        idusuario,
        id_dia,
        rutina,
        ejercicios,
        DiasRutinas (
          desc_dia
        )
      `);

    if (error) {
      console.log(`[createRoutine] Error inserting routine: ${error.message}`);
      throw error;
    }

    console.log(`[createRoutine] Successfully inserted routine:`, data[0]);
    const formattedRoutine = {
      id: data[0].id_rutina,
      day: data[0].DiasRutinas.desc_dia,
      name: data[0].rutina,
      exercises: data[0].ejercicios || [],
    };

    console.log(`[createRoutine] Successfully formatted new routine:`, formattedRoutine);
    res.status(201).json({ routine: formattedRoutine });
  } catch (error) {
    console.error(`[createRoutine] Unexpected error: ${error.message}`);
    res.status(500).json({ error: 'Error al crear la rutina' });
  }
};

// Actualizar una rutina (por ejemplo, agregar ejercicios)
export const updateRoutine = async (req, res) => {
  const { id } = req.params;
  const { exercises } = req.body;

  console.log(`[updateRoutine] Received request to update routine ID: ${id} with exercises:`, exercises);

  try {
    console.log(`[updateRoutine] Updating routine with ID: ${id}`);
    const { data, error } = await supabase
      .from('Rutinas')
      .update({ ejercicios: exercises })
      .eq('id_rutina', id)
      .select(`
        id_rutina,
        idusuario,
        id_dia,
        rutina,
        ejercicios,
        DiasRutinas (
          desc_dia
        )
      `);

    if (error) {
      console.log(`[updateRoutine] Error updating routine: ${error.message}`);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log(`[updateRoutine] Error: Routine not found for ID: ${id}`);
      return res.status(404).json({ error: 'Rutina no encontrada' });
    }

    console.log(`[updateRoutine] Successfully updated routine:`, data[0]);
    const formattedRoutine = {
      id: data[0].id_rutina,
      day: data[0].DiasRutinas.desc_dia,
      name: data[0].rutina,
      exercises: data[0].ejercicios || [],
    };

    console.log(`[updateRoutine] Successfully formatted updated routine:`, formattedRoutine);
    res.status(200).json({ routine: formattedRoutine });
  } catch (error) {
    console.error(`[updateRoutine] Unexpected error: ${error.message}`);
    res.status(500).json({ error: 'Error al actualizar la rutina' });
  }
};

// Eliminar una rutina
export const deleteRoutine = async (req, res) => {
  const { id } = req.params;

  console.log(`[deleteRoutine] Received request to delete routine ID: ${id}`);

  try {
    console.log(`[deleteRoutine] Deleting routine with ID: ${id}`);
    const { error } = await supabase
      .from('Rutinas')
      .delete()
      .eq('id_rutina', id);

    if (error) {
      console.log(`[deleteRoutine] Error deleting routine: ${error.message}`);
      throw error;
    }

    console.log(`[deleteRoutine] Successfully deleted routine ID: ${id}`);
    res.status(200).json({ message: 'Rutina eliminada correctamente' });
  } catch (error) {
    console.error(`[deleteRoutine] Unexpected error: ${error.message}`);
    res.status(500).json({ error: 'Error al eliminar la rutina' });
  }
};
// Obtener una rutina específica por ID
export const getRoutineById = async (req, res) => {
    const { id } = req.params;
  
    console.log(`[getRoutineById] Received request for routine ID: ${id}`);
  
    try {
      console.log(`[getRoutineById] Querying routine with ID: ${id}`);
      const { data, error } = await supabase
        .from('Rutinas')
        .select(`
          id_rutina,
          idusuario,
          id_dia,
          rutina,
          ejercicios,
          DiasRutinas (
            desc_dia
          )
        `)
        .eq('id_rutina', id)
        .single();
  
      if (error) {
        console.log(`[getRoutineById] Error querying routine: ${error.message}`);
        throw error;
      }
  
      if (!data) {
        console.log(`[getRoutineById] Error: Routine not found for ID: ${id}`);
        return res.status(404).json({ error: 'Rutina no encontrada' });
      }
  
      console.log(`[getRoutineById] Retrieved routine:`, data);
  
      // Parsear el campo ejercicios si es una cadena
      const exercises = typeof data.ejercicios === 'string' ? JSON.parse(data.ejercicios) : data.ejercicios || [];
  
      const formattedRoutine = {
        id: data.id_rutina,
        day: data.DiasRutinas.desc_dia,
        name: data.rutina,
        exercises: exercises,
      };
  
      console.log(`[getRoutineById] Successfully formatted routine:`, formattedRoutine);
      res.status(200).json({ routine: formattedRoutine });
    } catch (error) {
      console.error(`[getRoutineById] Unexpected error: ${error.message}`);
      res.status(500).json({ error: 'Error al consultar la rutina' });
    }
  };