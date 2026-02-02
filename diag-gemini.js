const { GoogleGenAI } = require("@google/genai");

async function main() {
  console.log("Starting diagnostic...");
  const apiKey = "AIzaSyAM06FrDw0NhQnQkCtYCFqPe0dihidivik";
  
  try {
    console.log("Initializing SDK...");
    const ai = new GoogleGenAI({ apiKey });
    
    console.log("Calling generateContent...");
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Hello",
    });
    
    console.log("Success! Response:", response.text);
  } catch (error) {
    console.error("DIAGNOSTIC ERROR:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    if (error.response) {
      console.error("Response status:", error.response.status);
    }
  }
}

main().then(() => console.log("Diagnostic finished."));
setTimeout(() => { console.log("Diagnostic timed out after 10s"); process.exit(1); }, 10000);
