// check.js
const API_KEY = "AIzaSyDjE6JsF4nDXhp-4JEXcEuFyKBPC0Jtfqo"; // <-- Put your actual key here temporarily

async function run() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    
    // In TypeScript, we type the parsed JSON as 'any' for quick scripts
    const data: any = await res.json();
    
    console.log("Allowed Models for your key:");
    
    // 🚨 Check if Google returned an error instead of a list of models
    if (!data.models) {
      console.log("❌ ERROR: Google did not return any models. Here is why:");
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    // Iterate through the models array
    data.models.forEach((m: any) => {
      // Only show Gemini models that support text generation
      if (
        m.name.includes("gemini") && 
        m.supportedGenerationMethods && 
        m.supportedGenerationMethods.includes("generateContent")
      ) {
        console.log(`✅ ${m.name.replace('models/', '')}`);
      }
    });

  } catch (error) {
    console.error("❌ Request completely failed:", error);
  }
}
run();