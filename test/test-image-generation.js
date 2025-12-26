import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:8045/v1/chat/completions';
const API_KEY = 'sk-text';

async function testImageGeneration(stream = true) {
  console.log(`Testing image generation model (${stream ? 'streaming' : 'non-streaming'})...\n`);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash-image',
      messages: [{ role: 'user', content: 'Draw an anime girl' }],
      stream
    })
  });

  let fullContent = '';

  if (stream) {
    let buffer = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          const content = data.choices[0]?.delta?.content;
          if (content) fullContent = content;
        } catch (e) { }
      }
    }
  } else {
    const data = await response.json();
    fullContent = data.choices[0]?.message?.content || '';
  }

  console.log('Response content:\n', fullContent.substring(0, 200), '...\n');

  // Extract images from markdown
  const imageRegex = /!\[.*?\]\((data:image\/(.*?);base64,([^)]+))\)/g;
  let match;
  let imageCount = 0;

  while ((match = imageRegex.exec(fullContent)) !== null) {
    imageCount++;
    const base64Data = match[3];
    const ext = match[2];
    const filename = `generated_${Date.now()}_${imageCount}.${ext}`;
    const filepath = path.join('test', filename);

    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
    console.log(`✓ Image saved: ${filepath}`);
  }

  if (imageCount === 0) {
    console.log('✗ No images found');
  } else {
    console.log(`\n✓ Total ${imageCount} images saved`);
  }
}

(async () => {
  // await testImageGeneration(true);
  // console.log('\n' + '='.repeat(50) + '\n');
  await testImageGeneration(false);
})().catch(console.error);
