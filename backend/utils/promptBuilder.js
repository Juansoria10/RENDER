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

function buildPrompt(userDescription, config) {
  const { renderType, style, light, quality } = config;

  let qualityPrefix = '';
  if (quality === 'alta') qualityPrefix = 'high quality, detailed, ';
  if (quality === 'ultra') qualityPrefix = 'ultra detailed, 8K resolution, professional, award winning, ';

  const base = `${qualityPrefix}Photorealistic ${renderTypes[renderType] || renderTypes.arquitectura}, ${styles[style] || styles.moderno}, ${lightingMap[light] || lightingMap.dia}, realistic materials, physically accurate lighting, natural shadows, high-quality textures, realistic reflections, professional photography, global illumination`;

  const userPart = userDescription ? `. ${userDescription}` : '';

  const negative = 'deformed, distorted, disfigured, poorly drawn, bad anatomy, extra limb, missing limb, mutated hands, extra fingers, missing fingers, ugly, blurry, low quality, text, watermark, signature, duplicate objects';

  return {
    prompt: base + userPart,
    negative_prompt: negative
  };
}

module.exports = { buildPrompt };
