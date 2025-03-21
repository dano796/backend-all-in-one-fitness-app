import { supabase } from "../lib/supabaseClient.js";

// Registrar usuario
export const registerUser = async (req, res) => {
    console.log("Solicitud recibida para /api/register:", req.body);

    try {
        const { usuario, correo, contraseña } = req.body;

        if (!usuario || !correo || !contraseña) {
            console.log("Error: Faltan datos requeridos");
            return res.status(400).json({ error: "Faltan datos requeridos." });
        }

        const usuarioLower = usuario.toLowerCase();
        console.log("Usuario convertido a minúsculas:", usuarioLower);

        // Password validation
        const hasUpperCase = /[A-Z]/.test(contraseña);
        const hasLowerCase = /[a-z]/.test(contraseña);
        const hasNumber = /\d/.test(contraseña);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(contraseña);
        const isLongEnough = contraseña.length >= 8;

        if (!isLongEnough) {
            console.log("Error: Contraseña demasiado corta");
            return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
        }
        if (!hasUpperCase) {
            console.log("Error: La contraseña debe contener al menos una letra mayúscula");
            return res.status(400).json({ error: "La contraseña debe contener al menos una letra mayúscula." });
        }
        if (!hasLowerCase) {
            console.log("Error: La contraseña debe contener al menos una letra minúscula");
            return res.status(400).json({ error: "La contraseña debe contener al menos una letra minúscula." });
        }
        if (!hasNumber) {
            console.log("Error: La contraseña debe contener al menos un número");
            return res.status(400).json({ error: "La contraseña debe contener al menos un número." });
        }
        if (!hasSpecialChar) {
            console.log("Error: La contraseña debe contener al menos un carácter especial");
            return res.status(400).json({ error: "La contraseña debe contener al menos un carácter especial (e.g., !@#$%)." });
        }

        console.log("Verificando si el usuario existe en la tabla 'Inicio Sesion'...");
        const { data: usuarioExistente, error: usuarioError } = await supabase
            .from("Inicio Sesion")
            .select("Usuario")
            .eq("Usuario", usuarioLower)
            .single();

        if (usuarioError) {
            console.log("Error al verificar usuario:", usuarioError);
            if (usuarioError.code !== "PGRST116") {
                return res.status(500).json({ error: "Error al verificar el usuario. Intenta de nuevo." });
            }
        }
        if (usuarioExistente) {
            console.log("Usuario ya existe:", usuarioExistente);
            return res.status(400).json({ error: "El nombre de usuario ya está en uso." });
        }

        console.log("Verificando si el correo existe en la tabla 'Inicio Sesion'...");
        const { data: correoExistente, error: correoError } = await supabase
            .from("Inicio Sesion")
            .select("Correo")
            .eq("Correo", correo)
            .single();

        if (correoError) {
            console.log("Error al verificar correo:", correoError);
            if (correoError.code !== "PGRST116") {
                return res.status(500).json({ error: "Error al verificar el correo. Intenta de nuevo." });
            }
        }
        if (correoExistente) {
            console.log("Correo ya registrado:", correoExistente);
            return res.status(400).json({ error: "El correo ya está registrado." });
        }

        console.log("Registrando usuario en Supabase Auth...");
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: correo,
            password: contraseña,
            options: {
                data: { usuario: usuarioLower }, // Pasa el usuario como metadato
                emailRedirectTo: `${process.env.FRONTEND_URL}/login`,
            },
        });

        if (signUpError) {
            console.log("Error al registrar en Supabase Auth:", signUpError);
            if (signUpError.message.includes("User already registered")) {
                return res.status(400).json({ error: "El correo ya está registrado pero no autenticado." });
            }
            return res.status(500).json({ error: `Error al registrar: ${signUpError.message}` });
        }

        console.log("Usuario registrado en Supabase Auth:", signUpData);

        // Insert the user into the "Inicio Sesion" table
        console.log("Guardando usuario en la tabla 'Inicio Sesion'...");
        const { data: insertData, error: insertError } = await supabase
            .from("Inicio Sesion")
            .insert([
                {
                    Usuario: usuarioLower,
                    Correo: correo,
                    Contraseña: contraseña, // Note: Storing passwords in plain text is not recommended
                },
            ]);

        if (insertError) {
            console.log("Error al guardar en la tabla 'Inicio Sesion':", insertError);
            return res.status(500).json({ error: "Error al guardar el usuario en la base de datos. Intenta de nuevo." });
        }

        console.log("Usuario guardado en la tabla 'Inicio Sesion':", insertData);

        // Skip automatic login since email verification is required
        console.log("Registro exitoso. Enviando respuesta...");
        return res.status(201).json({
            success: `Registro exitoso. Verifica el correo enviado a ${correo} para activar tu cuenta.`,
        });
    } catch (err) {
        console.error("Excepción no manejada en registrarUsuario:", err);
        return res.status(500).json({ error: "Ocurrió un error inesperado. Intenta de nuevo." });
    }
};

// Iniciar sesión
export const loginUser = async (req, res) => {
    const { input, password } = req.body;

    if (!input || !password) {
        return res.status(400).json({ error: "Faltan datos requeridos." });
    }

    let email = input;
    const inputLower = input.toLowerCase();

    try {
        if (!input.includes("@")) {
            const { data, error } = await supabase
                .from("Inicio Sesion")
                .select("Correo")
                .eq("Usuario", inputLower)
                .single();

            if (error || !data) {
                return res.status(404).json({ error: "Usuario no encontrado." });
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
            return res.status(401).json({ error: mensajeError });
        }

        return res.status(200).json({ success: "Inicio de sesión exitoso", token: data.session.access_token });
    } catch (err) {
        return res.status(500).json({ error: "Ocurrió un error inesperado. Inténtalo de nuevo." });
    }
};

// Restablecer contraseña
export const resetPasswordForEmail = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "El correo es requerido." });
    }

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
        });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ success: "Se ha enviado un correo para restablecer tu contraseña" });
    } catch (err) {
        return res.status(500).json({ error: "Ocurrió un error inesperado. Inténtalo de nuevo." });
    }
};

export const setCalorieGoal = async (req, res) => {
    const { email, calorieGoal } = req.body;

    // Validación de datos requeridos
    if (!email || calorieGoal === undefined) {
        return res.status(400).json({ error: "Faltan datos requeridos: email y calorieGoal." });
    }

    // Validación del valor de calorieGoal
    if (!Number.isInteger(calorieGoal)) {
        return res.status(400).json({ error: "El límite de calorías debe ser un número entero." });
    }

    // Permitir calorieGoal: 0 para eliminar el límite, de lo contrario debe ser >= 2000
    if (calorieGoal !== 0 && calorieGoal < 2000) {
        return res.status(400).json({ error: "El límite de calorías debe ser 0 (para eliminar) o mayor o igual a 2000." });
    }

    try {
        // Buscar el idusuario correspondiente al email en la tabla "Inicio Sesion"
        const { data: userData, error: userError } = await supabase
            .from("Inicio Sesion")
            .select("idusuario")
            .eq("Correo", email)
            .single();

        if (userError || !userData) {
            console.log("Error al buscar el usuario:", userError);
            return res.status(404).json({ error: "Usuario no encontrado." });
        }

        const idusuario = userData.idusuario;

        if (calorieGoal === 0) {
            // Si calorieGoal es 0, eliminar el registro de UserCalorieGoals
            const { error: deleteError } = await supabase
                .from("UserCalorieGoals")
                .delete()
                .eq("idusuario", idusuario);

            if (deleteError) {
                console.log("Error al eliminar el límite de calorías:", deleteError);
                return res.status(500).json({ error: "Error al eliminar el límite de calorías." });
            }

            return res.status(200).json({ success: "Límite de calorías eliminado exitosamente." });
        } else {
            // Guardar el límite de calorías usando el idusuario
            const { data, error } = await supabase
                .from("UserCalorieGoals")
                .upsert({ idusuario, calorie_goal: calorieGoal }, { onConflict: "idusuario" });

            if (error) {
                console.log("Error al establecer el límite de calorías:", error);
                return res.status(500).json({ error: "Error al establecer el límite de calorías." });
            }

            return res.status(200).json({ success: "Límite de calorías establecido exitosamente.", calorieGoal });
        }
    } catch (err) {
        console.error("Excepción no manejada en setCalorieGoal:", err);
        return res.status(500).json({ error: "Ocurrió un error inesperado. Intenta de nuevo." });
    }
};

// Obtener el límite de calorías de un usuario
export const getCalorieGoal = async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: "Falta el parámetro email." });
    }

    try {
        // Buscar el idusuario correspondiente al email en la tabla "Inicio Sesion"
        const { data: userData, error: userError } = await supabase
            .from("Inicio Sesion")
            .select("idusuario")
            .eq("Correo", email)
            .single();

        if (userError || !userData) {
            console.log("Error al buscar el usuario:", userError);
            return res.status(404).json({ error: "Usuario no encontrado." });
        }

        const idusuario = userData.idusuario;

        // Obtener el límite de calorías usando el idusuario
        const { data, error } = await supabase
            .from("UserCalorieGoals")
            .select("calorie_goal")
            .eq("idusuario", idusuario)
            .single();

        if (error) {
            if (error.code === "PGRST116") {
                // No se encontró un límite para el usuario
                return res.status(200).json({ calorieGoal: null });
            }
            console.log("Error al obtener el límite de calorías:", error);
            return res.status(500).json({ error: "Error al obtener el límite de calorías." });
        }

        return res.status(200).json({ calorieGoal: data?.calorie_goal || null });
    } catch (err) {
        console.error("Excepción no manejada en getCalorieGoal:", err);
        return res.status(500).json({ error: "Ocurrió un error inesperado. Intenta de nuevo." });
    }
};