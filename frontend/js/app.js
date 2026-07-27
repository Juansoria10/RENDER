const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const previewImage = document.getElementById('previewImage');
const removeImage = document.getElementById('removeImage');
const generateBtn = document.getElementById('generateBtn');
const btnText = document.querySelector('.btn-text');
const btnLoader = document.querySelector('.btn-loader');
const emptyState = document.getElementById('emptyState');
const comparisonContainer = document.getElementById('comparisonContainer');
const originalResult = document.getElementById('originalResult');
const renderResult = document.getElementById('renderResult');
const regenerateBtn = document.getElementById('regenerateBtn');
const compareBtn = document.getElementById('compareBtn');
const downloadBtn = document.getElementById('downloadBtn');
const progressOverlay = document.getElementById('progressOverlay');
const progressFill = document.getElementById('progressFill');
const promptDisplay = document.getElementById('promptDisplay');
const promptText = document.getElementById('promptText');
const sliderContainer = document.getElementById('sliderContainer');
const sliderInput = document.getElementById('sliderInput');
const sliderRender = document.getElementById('sliderRender');
const sliderOriginal = document.getElementById('sliderOriginal');
const toast = document.getElementById('toast');
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');

let selectedFile = null;
let lastRenderUrl = null;

menuToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.style.borderColor = 'var(--accent)';
  uploadZone.style.background = 'rgba(108, 92, 231, 0.08)';
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.style.borderColor = '';
  uploadZone.style.background = '';
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.style.borderColor = '';
  uploadZone.style.background = '';
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

removeImage.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  uploadZone.style.display = '';
  previewContainer.style.display = 'none';
});

function handleFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    showToast('Formato no soportado. Usa JPG, PNG o WEBP.', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('El archivo excede 10MB.', 'error');
    return;
  }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.src = e.target.result;
    uploadZone.style.display = 'none';
    previewContainer.style.display = '';
  };
  reader.readAsDataURL(file);
}

generateBtn.addEventListener('click', async () => {
  const description = document.getElementById('description').value.trim();

  if (!selectedFile) {
    showToast('Por favor, carga una imagen primero.', 'error');
    return;
  }
  if (!description) {
    showToast('Por favor, describe el render que deseas.', 'error');
    return;
  }

  setLoading(true);
  showProgress(true);

  const formData = new FormData();
  formData.append('image', selectedFile);
  formData.append('description', description);
  formData.append('renderType', document.getElementById('renderType').value);
  formData.append('style', document.getElementById('style').value);
  formData.append('light', document.getElementById('lighting').value);
  formData.append('quality', document.getElementById('quality').value);
  formData.append('aspectRatio', document.getElementById('aspectRatio').value);

  try {
    const response = await fetch('/api/render', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al generar el render.');
    }

    originalResult.src = data.originalImage;
    renderResult.src = data.renderImage;
    sliderRender.src = data.renderImage;
    sliderOriginal.src = data.originalImage;
    lastRenderUrl = data.renderImage;

    if (data.prompt) {
      promptText.textContent = data.prompt;
      promptDisplay.style.display = '';
    }

    emptyState.style.display = 'none';
    comparisonContainer.style.display = '';
    sliderContainer.style.display = 'none';
    showToast('Render generado exitosamente.', 'success');

  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setLoading(false);
    showProgress(false);
  }
});

regenerateBtn.addEventListener('click', () => generateBtn.click());

compareBtn.addEventListener('click', () => {
  if (sliderContainer.style.display === 'none') {
    sliderContainer.style.display = '';
    compareBtn.textContent = '✕ Cerrar Comparación';
  } else {
    sliderContainer.style.display = 'none';
    compareBtn.textContent = '🔍 Comparar Antes/Después';
    sliderInput.value = 50;
    sliderRender.style.clipPath = 'inset(0 50% 0 0)';
  }
});

sliderInput.addEventListener('input', (e) => {
  const val = e.target.value;
  sliderRender.style.clipPath = `inset(0 ${100 - val}% 0 0)`;
  document.querySelector('.slider-line').style.left = `${val}%`;
});

downloadBtn.addEventListener('click', () => {
  if (!lastRenderUrl) return;
  const a = document.createElement('a');
  a.href = lastRenderUrl;
  a.download = `render-ia-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

function setLoading(loading) {
  generateBtn.disabled = loading;
  btnText.style.display = loading ? 'none' : '';
  btnLoader.style.display = loading ? '' : 'none';
}

function showProgress(show) {
  progressOverlay.style.display = show ? '' : 'none';
  if (show) {
    progressFill.style.width = '0%';
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 90) {
        clearInterval(interval);
        progress = 90;
      }
      progressFill.style.width = `${progress}%`;
    }, 2000);
    window._progressInterval = interval;
  } else {
    clearInterval(window._progressInterval);
    progressFill.style.width = '100%';
  }
}

function showToast(message, type) {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = '';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}
