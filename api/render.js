const fetch = require('node-fetch');

const renderTypes = {
  arquitectura: 'architectural visualization',
  interior: 'interior design rendering',
  exterior: 'exterior architectural rendering',
  producto: 'product photography',
  paisaje: 'landscape visualization'
};

const styles = {
  moderno: 'modern contemporary design',
  minimalista: 'minimalist clean design',
  industrial: 'industrial style',
  clasico: 'classical traditional design',
  futurista: 'futuristic design',
  realista: 'photorealistic'
};

const lightingMap = {
  dia: 'bright natural daylight',
  noche: 'nighttime with artificial lighting',
  atardecer: 'golden hour sunset lighting',
  calida: 'warm soft lighting',
  fria: 'cool blue toned lighting'
};

function buildPrompt(description, config) {
  const { renderType, style, light, quality } = config;
  let qualityPrefix = '';
  if (quality === 'alta') qualityPrefix = 'high quality, detailed, ';
  if (quality === 'ultra') qualityPrefix = 'ultra detailed, 8K resolution, professional, award winning, ';
  const base = `${qualityPrefix}Photorealistic ${renderTypes[renderType] || renderTypes.arquitectura}, ${styles[style] || styles.moderno}, ${lightingMap[light] || lightingMap.dia}, realistic materials, physically accurate lighting, natural shadows, high-quality textures, realistic reflections, professional photography, global illumination`;
  const userPart = description ? `. ${description}` : '';
  const negative = 'deformed, distorted, disfigured, poorly drawn, bad anatomy, extra limb, missing limb, mutated hands, extra fingers, missing fingers, ugly, blurry, low quality, text, watermark, signature, duplicate objects';
  return { prompt: base + userPart, negative_prompt: negative };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const { imageBase64, mimeType, description, renderType, style, light, quality, aspectRatio } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No se ha cargado ninguna imagen.' });
    }

    if (!description || description.trim() === '') {
      return res.status(400).json({ error: 'Por favor, describe el render que deseas generar.' });
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key no configurada.' });
    }

    const { prompt, negative_prompt } = buildPrompt(description, {
      renderType: renderType || 'arquitectura',
      style: style || 'moderno',
      light: light || 'dia',
      quality: quality || 'estandar'
    });

    console.log('Generando render...');
    console.log('Prompt:', prompt);

    const sizeMap = {
      '1:1': '1024x1024',
      '16:9': '1344x768',
      '4:3': '1152x864',
      '9:16': '768x1344'
    };
    const aspect = aspectRatio || '1:1';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(
      'https://router.huggingface.co/nscale/v1/images/generations',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'black-forest-labs/FLUX.1-schnell',
          prompt: prompt,
          negative_prompt: negative_prompt,
          n: 1,
          size: sizeMap[aspect] || '1024x1024'
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      if (response.status === 429) {
        return res.status(429).json({ error: 'Limite de generacion alcanzado. Intenta mas tarde.' });
      }
      return res.status(500).json({ error: `Error de la API (${response.status}): ${errorText.substring(0, 300)}` });
    }

    const data = await response.json();

    if (!data.data || !data.data[0] || !data.data[0].b64_json) {
      return res.status(500).json({ error: 'La API no devolvio una imagen valida.' });
    }

    const renderBase64 = data.data[0].b64_json;

    console.log('Render generado exitosamente');

    res.json({
      success: true,
      originalImage: `data:${mimeType || 'image/png'};base64,${imageBase64}`,
      renderImage: `data:image/png;base64,${renderBase64}`,
      prompt: prompt
    });

  } catch (error) {
    console.error('Error:', error.message || error);
    if (error.type === 'aborted' || error.name === 'AbortError') {
      return res.status(504).json({ error: 'La generacion tardo demasiado.' });
    }
    res.status(500).json({ error: `Error interno: ${error.message || 'Intenta nuevamente.'}` });
  }
};
