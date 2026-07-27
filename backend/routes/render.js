const express = require('express');
const fetch = require('node-fetch');
const { buildPrompt } = require('../utils/promptBuilder');

const router = express.Router();

router.post('/', async (req, res) => {
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
});

module.exports = router;
