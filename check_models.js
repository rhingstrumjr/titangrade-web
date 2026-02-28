const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
  .then(res => res.json())
  .then(data => {
    if (data.error) console.error(data.error);
    else console.log((data.models || []).map(m => m.name).filter(n => n.includes('flash') || n.includes('gemini-1.5')));
  })
  .catch(console.error);
