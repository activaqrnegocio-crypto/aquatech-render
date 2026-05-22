const geminiKey = "AIzaSyAmMpStS5CrFL3udfRoHWECQgLhBA6c";

async function testGemini() {
  console.log("Testing Gemini...");
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'Hola' }
          ]
        }]
      })
    });
    console.log("Gemini status:", res.status);
    console.log("Gemini body:", await res.text());
  } catch(e) {
    console.log("Error:", e);
  }
}
testGemini();
