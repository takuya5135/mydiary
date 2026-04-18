const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
let key = '';
envContent.split('\n').forEach(line => {
  if (line.startsWith('GEMINI_API_KEY=')) {
    key = line.split('=')[1].trim().replace(/^"|"$/g, '');
  }
});

fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
  .then(res => res.json())
  .then(data => {
    console.log("Models supporting generateContent:");
    data.models.forEach(m => {
       if (m.supportedGenerationMethods.includes("generateContent")) {
          console.log(m.name);
       }
    });
  })
  .catch(console.error);
