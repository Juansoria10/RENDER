const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { buildPrompt } = require('../utils/promptBuilder');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha cargado ninguna imagen.' });
    }

    const { description, renderType, style, light, quality, aspectRatio } = req.body;

    if (!description || description.trim() === '') {
      return res.status(400).json({ error: 'Por favor, describe el render que deseas generar.' });
    }

    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key no configurada. Contacta al administrador.' });
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
    const steps = quality === 'ultra' ? 4 : quality === 'alta' ? 3 : 2;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

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
          size: sizeMap[aspect] || '1024x1024',
          num_inference_steps: steps
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error de la API:', response.status, errorText);

      if (response.status === 503) {
        return res.status(503).json({ error: 'El modelo esta cargando. Intenta nuevamente en unos segundos.' });
      }
      if (response.status === 429) {
        return res.status(429).json({ error: 'Limite de generacion alcanzado. Intenta mas tarde.' });
      }
      return res.status(500).json({ error: `Error de la API (${response.status}): ${errorText.substring(0, 300)}` });
    }

    const data = await response.json();

    if (!data.data || !data.data[0] || !data.data[0].b64_json) {
      console.error('Respuesta sin imagen:', JSON.stringify(data).substring(0, 500));
      return res.status(500).json({ error: 'La API no devolvio una imagen valida.' });
    }

    const imageBuffer = Buffer.from(data.data[0].b64_json, 'base64');

    const outputFilename = `render-${Date.now()}.png`;
    const outputPath = path.join(__dirname, '../../uploads', outputFilename);
    fs.writeFileSync(outputPath, imageBuffer);

    console.log('Render generado exitosamente:', outputFilename);

    res.json({
      success: true,
      originalImage: `/uploads/${req.file.filename}`,
      renderImage: `/uploads/${outputFilename}`,
      prompt: prompt
    });

  } catch (error) {
    console.error('Error en la generacion:', error.message || error);

    if (error.type === 'aborted' || error.name === 'AbortError') {
      return res.status(504).json({ error: 'La generacion tardo demasiado. Intenta con una configuracion mas simple.' });
    }

    res.status(500).json({ error: `Error interno: ${error.message || 'Intenta nuevamente.'}` });
  }
});

module.exports = router;
