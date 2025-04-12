import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

// Función para convertir la imagen a base64 desde el buffer
const imageToBase64 = (file) => {
  try {
    if (!file.buffer) {
      throw new Error("El buffer del archivo no está disponible");
    }

    const base64 = file.buffer.toString("base64");
    return `data:${file.mimetype};base64,${base64}`;
  } catch (error) {
    throw new Error("Error al convertir la imagen a base64: " + error.message);
  }
};

// Función para generar un ID numérico de 7 dígitos
const generate7DigitId = () => {
  return Math.floor(1000000 + Math.random() * 9000000);
};

export const analyzeFoodImage = async (file) => {
  try {
    const base64Image = imageToBase64(file);

    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a nutrition expert. Identify the food in the image and provide its nutritional information per 100g. Return the response in two lines:\n" +
              "First line: 'Food name: <food name in Spanish>.'\n" +
              "Second line: 'Per 100g - Calories: <number>kcal | Fat: <number>g | Carbs: <number>g | Protein: <number>g.'\n" +
              "Ensure the nutritional values are numeric and do not include additional text or explanations. If you cannot identify the food, respond with 'Food name: Unknown. Per 100g - Calories: 0kcal | Fat: 0g | Carbs: 0g | Protein: 0g.'",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: base64Image,
                },
              },
              {
                type: "text",
                text: "Identify the food in this image and provide its nutritional information per 100g.",
              },
            ],
          },
        ],
        max_tokens: 150,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const responseContent = response.data.choices[0].message.content.trim();
    console.log("Respuesta de OpenAI:", responseContent);

    const lines = responseContent.split("\n");
    if (lines.length < 2) {
      throw new Error("La respuesta de OpenAI no tiene el formato esperado (se esperaban dos líneas)");
    }

    const foodNameMatch = lines[0].match(/Food name: (.*?)\./);
    if (!foodNameMatch) {
      throw new Error("No se pudo parsear el nombre de la comida en la respuesta de OpenAI");
    }

    const foodDescriptionMatch = lines[1].match(
      /Per 100g - Calories: (\d+)kcal \| Fat: ([\d.]+)g \| Carbs: ([\d.]+)g \| Protein: ([\d.]+)g/
    );
    if (!foodDescriptionMatch) {
      throw new Error("No se pudo parsear la información nutricional en la respuesta de OpenAI");
    }

    const foodName = foodNameMatch[1];
    const foodDescription = `Per 100g - Calories: ${foodDescriptionMatch[1]}kcal | Fat: ${foodDescriptionMatch[2]}g | Carbs: ${foodDescriptionMatch[3]}g | Protein: ${foodDescriptionMatch[4]}g`;

    const result = {
      foods: {
        food: [
          {
            food_description: foodDescription,
            food_id: generate7DigitId(), // Nuevo ID numérico
            food_name: foodName,
            food_type: "Generic",
            food_url: "",
          },
        ],
        max_results: "1",
        page_number: "0",
        total_results: "1",
      },
    };

    return result;
  } catch (error) {
    throw new Error("Error al analizar la imagen con OpenAI: " + error.message);
  }
};
