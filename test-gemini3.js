const { GoogleGenAI } = require("@google/genai");

async function main() {
  const apiKey = "AIzaSyAM06FrDw0NhQnQkCtYCFqPe0dihidivik"; // Using the user's key from .env
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: "Hello" }] }],
    });
    console.log("Success:", response.text);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
