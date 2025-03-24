import { supabase } from '../config/supabaseClient.js';
import { getIdUsuarioByEmail } from '../utils/helpers.js';

export const registerUser = async ({ usuario, correo, contraseña }) => {

  const usuarioLower = usuario.toLowerCase();

  // Validar la contraseña
  const hasUpperCase = /[A-Z]/.test(contraseña);
  const hasLowerCase = /[a-z]/.test(contraseña);
  const hasNumber = /\d/.test(contraseña);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(contraseña);
  const isLongEnough = contraseña.length >= 8;

  if (!isLongEnough) {
    console.log("Error: Contraseña demasiado corta");
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }
  if (!hasUpperCase) {
    console.log("Error: La contraseña debe contener al menos una letra mayúscula");
    throw new Error("La contraseña debe contener al menos una letra mayúscula.");
  }
  if (!hasLowerCase) {
    console.log("Error: La contraseña debe contener al menos una letra minúscula");
    throw new Error("La contraseña debe contener al menos una letra minúscula.");
  }
  if (!hasNumber) {
    console.log("Error: La contraseña debe contener al menos un número");
    throw new Error("La contraseña debe contener al menos un número.");
  }
  if (!hasSpecialChar) {
    console.log("Error: La contraseña debe contener al menos un carácter especial");
    throw new Error("La contraseña debe contener al menos un carácter especial (e.g., !@#$%).");
  }

  const { data: usuarioExistente, error: usuarioError } = await supabase
    .from("Inicio Sesion")
    .select("Usuario")
    .eq("Usuario", usuarioLower)
    .single();

  if (usuarioError) {
    console.log("Error al verificar usuario:", usuarioError);
    if (usuarioError.code !== "PGRST116") {
      throw new Error("Error al verificar el usuario. Intenta de nuevo.");
    }
  }
  if (usuarioExistente) {
    console.log("Usuario ya existe:", usuarioExistente);
    throw new Error("El nombre de usuario ya está en uso.");
  }

  const { data: correoExistente, error: correoError } = await supabase
    .from("Inicio Sesion")
    .select("Correo")
    .eq("Correo", correo)
    .single();

  if (correoError) {
    console.log("Error al verificar correo:", correoError);
    if (correoError.code !== "PGRST116") {
      throw new Error("Error al verificar el correo. Intenta de nuevo.");
    }
  }
  if (correoExistente) {
    console.log("Correo ya registrado:", correoExistente);
    throw new Error("El correo ya está registrado.");
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: correo,
    password: contraseña,
    options: {
      data: { usuario: usuarioLower },
      emailRedirectTo: `${process.env.FRONTEND_URL}/login`,
    },
  });

  if (signUpError) {
    console.log("Error al registrar en Supabase:", signUpError);
    if (signUpError.message.includes("User already registered")) {
      throw new Error("El correo ya está registrado pero no autenticado.");
    }
    throw new Error(`Error al registrar: ${signUpError.message}`);
  }

  console.log("Usuario registrado", signUpData);

  const { data: insertData, error: insertError } = await supabase
    .from("Inicio Sesion")
    .insert([
      {
        Usuario: usuarioLower,
        Correo: correo,
        Contraseña: contraseña, // Nota: No se recomienda almacenar contraseñas en texto plano
      },
    ]);

  if (insertError) {
    console.log("Error al guardar en la tabla 'Inicio Sesion':", insertError);
    throw new Error("Error al guardar el usuario en la base de datos. Intenta de nuevo.");
  }

  return {
    success: `Registro exitoso. Verifica el correo enviado a ${correo} para activar tu cuenta.`,
  };
};

export const loginUser = async ({ input, password }) => {
  let email = input;
  const inputLower = input.toLowerCase();

  if (!input.includes("@")) {
    const { data, error } = await supabase
      .from("Inicio Sesion")
      .select("Correo")
      .eq("Usuario", inputLower)
      .single();

    if (error || !data) {
      throw new Error("Usuario no encontrado.");
    }

    email = data.Correo;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const mensajeError = error.message.includes("Email not confirmed")
      ? "Por favor, verifica tu correo antes de iniciar sesión."
      : error.message.includes("Invalid login credentials")
      ? "Credenciales incorrectas."
      : error.message;
    throw new Error(mensajeError);
  }

  return { success: "Inicio de sesión exitoso", token: data.session.access_token };
};

export const resetPasswordForEmail = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { success: "Se ha enviado un correo para restablecer tu contraseña" };
};

export const setCalorieGoal = async ({ email, calorieGoal }) => {
  const idusuario = await getIdUsuarioByEmail(email);

  if (calorieGoal === 0) {
    const { error: deleteError } = await supabase
      .from("UserCalorieGoals")
      .delete()
      .eq("idusuario", idusuario);

    if (deleteError) {
      console.log("Error al eliminar el límite de calorías:", deleteError);
      throw new Error("Error al eliminar el límite de calorías.");
    }

    return { success: "Límite de calorías eliminado exitosamente." };
  } else {
    const { data, error } = await supabase
      .from("UserCalorieGoals")
      .upsert({ idusuario, calorie_goal: calorieGoal }, { onConflict: "idusuario" });

    if (error) {
      throw new Error("Error al establecer el límite de calorías.");
    }

    return { success: "Límite de calorías establecido exitosamente.", calorieGoal };
  }
};

export const getCalorieGoal = async (email) => {
  const idusuario = await getIdUsuarioByEmail(email);

  const { data, error } = await supabase
    .from("UserCalorieGoals")
    .select("calorie_goal")
    .eq("idusuario", idusuario)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { calorieGoal: null };
    }
    throw new Error("Error al obtener el límite de calorías.");
  }

  return { calorieGoal: data?.calorie_goal || null };
};