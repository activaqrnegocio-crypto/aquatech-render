const openRouterKey = "sk-or-v1-ae8fe09f4906f3f30e2170a6a33fd87274ecb0b5394547e20ded20e26";

async function testOR() {
  console.log("Testing OpenRouter Audio...");
  const fd = new FormData();
  // We just send a dummy blob, it might fail with "invalid file" but if the endpoint doesn't exist it gives 404.
  fd.append('file', new Blob(['test']), 'audio.webm');
  fd.append('model', 'openai/whisper-1');

  try {
    const res = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openRouterKey}` },
      body: fd
    });
    console.log("OpenRouter Audio status:", res.status);
    console.log("OpenRouter Audio body:", await res.text());
  } catch(e) {
    console.log("Error:", e);
  }
}
testOR();
