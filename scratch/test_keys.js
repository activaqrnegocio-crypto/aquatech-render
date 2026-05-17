const groqKey = "gsk_EDIbV5G1A518yKixWdbbF3RYCsRXRgfbmmE11uLoA5";
const openRouterKey = "sk-or-v1-ae8fe09f4906f3f30e2170a6a33fd87274ecb0b5394547e20ded20e26";

async function test() {
  console.log("Testing Groq...");
  try {
    const resGroq = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${groqKey}` }
    });
    console.log("Groq status:", resGroq.status);
    if (!resGroq.ok) console.log("Groq error:", await resGroq.text());
  } catch (e) {
    console.error("Groq network error:", e);
  }

  console.log("Testing OpenRouter...");
  try {
    const resOR = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${openRouterKey}` }
    });
    console.log("OpenRouter status:", resOR.status);
    if (!resOR.ok) console.log("OpenRouter error:", await resOR.text());
  } catch (e) {
    console.error("OpenRouter network error:", e);
  }
}

test();
