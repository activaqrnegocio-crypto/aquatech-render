const groqKey = process.env.GROQ_API_KEY || "TU_KEY_AQUI";

async function testGroq() {
  console.log("Testing new Groq API Key...");
  try {
    const resGroq = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${groqKey}` }
    });
    console.log("Groq status:", resGroq.status);
    if (!resGroq.ok) {
        console.log("Groq error:", await resGroq.text());
    } else {
        console.log("Groq is working perfectly!");
    }
  } catch (e) {
    console.error("Groq network error:", e);
  }
}

testGroq();
