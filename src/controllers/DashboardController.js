import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export const getDashboardData = async (req, res) => {
  try {
    const { email, startDate, endDate } = req.query;
    console.log(`[getDashboardData] Received request with email: ${email}, startDate: ${startDate}, endDate: ${endDate}`);

    if (!email || !startDate || !endDate) {
      console.log('[getDashboardData] Missing required parameters');
      return res.status(400).json({ error: 'Faltan datos requeridos: email, startDate y endDate son obligatorios' });
    }

    // Obtener el idusuario a partir del email usando la tabla Inicio Sesion
    console.log('[getDashboardData] Fetching idusuario from Inicio Sesion...');
    const { data: userData, error: userError } = await supabase
      .from('Inicio Sesion')
      .select('idusuario')
      .eq('Correo', email)
      .single();

    if (userError || !userData) {
      console.error(`[getDashboardData] Error fetching idusuario: ${userError?.message || 'User not found'}`);
      return res.status(404).json({ error: 'Usuario no encontrado en la tabla Inicio Sesion' });
    }

    const userId = userData.idusuario;
    console.log(`[getDashboardData] Fetched idusuario: ${userId}`);

    // Ajustar fechas a la zona horaria de Medellín (UTC-5)
    const start = new Date(startDate);
    start.setHours(start.getHours() - 5);
    const end = new Date(endDate);
    end.setHours(end.getHours() - 5);
    console.log(`[getDashboardData] Adjusted start date: ${start.toISOString()}, end date: ${end.toISOString()}`);

    // Obtener datos de comidas (calorías y macronutrientes)
    console.log('[getDashboardData] Fetching food data from ComidasxUsuario...');
    const { data: foodData, error: foodError } = await supabase
      .from('ComidasxUsuario')
      .select('calorias, proteina, grasas, carbs, fecha')
      .eq('idusuario', userId) // Usar userId en lugar de email
      .gte('fecha', start.toISOString())
      .lte('fecha', end.toISOString());

    if (foodError) {
      console.error(`[getDashboardData] Error fetching food data: ${foodError.message}`);
      throw new Error(foodError.message);
    }
    console.log(`[getDashboardData] Fetched food data: ${JSON.stringify(foodData)}`);

    // Calcular totales de calorías y macronutrientes
    const calorieIntake = {
      totalCalories: 0,
      totalProteins: 0,
      totalFats: 0,
      totalCarbs: 0,
      dailyBreakdown: [],
    };

    if (foodData && foodData.length > 0) {
      foodData.forEach((entry) => {
        calorieIntake.totalCalories += parseFloat(entry.calorias) || 0;
        calorieIntake.totalProteins += parseFloat(entry.proteina) || 0;
        calorieIntake.totalFats += parseFloat(entry.grasas) || 0;
        calorieIntake.totalCarbs += parseFloat(entry.carbs) || 0;

        const entryDate = new Date(entry.fecha).toISOString().split('T')[0];
        const existingDay = calorieIntake.dailyBreakdown.find((day) => day.date === entryDate);
        if (existingDay) {
          existingDay.calories += parseFloat(entry.calorias) || 0;
        } else {
          calorieIntake.dailyBreakdown.push({
            date: entryDate,
            calories: parseFloat(entry.calorias) || 0,
          });
        }
      });
    }
    console.log(`[getDashboardData] Calculated calorie intake: ${JSON.stringify(calorieIntake)}`);

    // Obtener meta de calorías
    console.log('[getDashboardData] Fetching calorie goal from UserCalorieGoals...');
    const { data: calorieGoalData, error: calorieGoalError } = await supabase
      .from('UserCalorieGoals')
      .select('calorie_goal')
      .eq('id_usuario', userId) // Usar userId en lugar de email
      .single();

    let calorieGoal = 2000; // Valor por defecto
    if (calorieGoalError) {
      console.warn(`[getDashboardData] Error fetching calorie goal, using default (2000): ${calorieGoalError.message}`);
    } else if (calorieGoalData) {
      calorieGoal = parseFloat(calorieGoalData.calorie_goal) || 2000;
    }
    console.log(`[getDashboardData] Fetched calorie goal: ${calorieGoal}`);

    // Obtener datos de agua
    console.log('[getDashboardData] Fetching water data from aguaxusuario...');
    const { data: waterData, error: waterError } = await supabase
      .from('aguaxusuario')
      .select('aguasllenadas')
      .eq('idusuario', userId) // Usar userId en lugar de email
      .gte('fecha', start.toISOString())
      .lte('fecha', end.toISOString());

    let totalWater = 0;
    if (waterError) {
      console.warn(`[getDashboardData] Error fetching water data, using default (0): ${waterError.message}`);
    } else if (waterData) {
      totalWater = waterData.reduce((sum, entry) => sum + (parseFloat(entry.cantidad) || 0), 0);
    }
    console.log(`[getDashboardData] Calculated total water intake: ${totalWater}`);

    // Preparar respuesta
    const response = {
      calorieIntake,
      calorieGoal,
      waterIntake: totalWater,
    };
    console.log(`[getDashboardData] Sending response: ${JSON.stringify(response)}`);

    return res.status(200).json(response);
  } catch (err) {
    console.error(`[getDashboardData] Unexpected error: ${err.message || err}`);
    return res.status(500).json({ error: err.message || 'Error al obtener los datos del dashboard' });
  }
};