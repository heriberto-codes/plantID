const MAX_FILE_SIZE = 10 * 1024 * 1024;

const photoInput = document.getElementById('photoInput');
const previewImage = document.getElementById('previewImage');
const fileName = document.getElementById('fileName');
const uploadPanel = document.querySelector('.upload-panel');

const resultContainerIds = [
  'plant-name-container',
  'probability-container',
  'isPlant-container',
  'common-name-container',
  'description-container',
  'plant-health-status-container',
  'plant-disease-name-container',
  'plant-disease-probabilty',
  'plant-disease-description',
  'plant-disease-treatment'
];

function setUploadStatus(message, tone = '') {
  const status = document.getElementById('uploadStatus');
  status.textContent = message;
  status.dataset.tone = tone;
}

function setAnalyzing(isAnalyzing) {
  const button = document.getElementById('analyzeButton');
  const buttonText = document.getElementById('analyzeButtonText');
  button.disabled = isAnalyzing;
  buttonText.textContent = isAnalyzing ? 'Analyzing…' : 'Analyze plant';
}

function clearRenderedResults() {
  resultContainerIds.forEach(function (id) {
    document.getElementById(id).replaceChildren();
  });

  document.getElementById('plant-similiar-image').hidden = true;
  document.getElementById('plant-similiar-image-with-disease').hidden = true;
}

function resetResultState() {
  clearRenderedResults();
  document.getElementById('resultEmpty').hidden = false;
  document.getElementById('resultContent').hidden = true;
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function addResultLine(containerId, label, value) {
  const container = document.getElementById(containerId);
  const paragraph = document.createElement('p');
  const strong = document.createElement('strong');

  strong.textContent = `${label}: `;
  paragraph.append(strong, document.createTextNode(String(value)));
  container.appendChild(paragraph);
}

function previewSelectedFile(file) {
  if (!file) {
    previewImage.hidden = true;
    previewImage.removeAttribute('src');
    fileName.textContent = 'No file chosen';
    return;
  }

  fileName.textContent = file.name;

  if (!file.type.startsWith('image/')) {
    setUploadStatus('Please choose an image file.', 'error');
    previewImage.hidden = true;
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    setUploadStatus('Please choose an image smaller than 10 MB.', 'error');
    previewImage.hidden = true;
    return;
  }

  const reader = new FileReader();
  reader.onload = function (event) {
    previewImage.src = event.target.result;
    previewImage.hidden = false;
  };
  reader.readAsDataURL(file);

  resetResultState();
  setUploadStatus('Photo ready to analyze.', 'success');
}

function renderTreatment(treatment) {
  const treatmentContainer = document.getElementById('plant-disease-treatment');

  if (!treatment || Object.keys(treatment).length === 0) {
    addResultLine('plant-disease-treatment', 'Treatment', 'No treatment information available');
    return;
  }

  Object.entries(treatment).forEach(function ([category, steps]) {
    const heading = document.createElement('strong');
    const list = document.createElement('ul');

    heading.textContent = `${category.charAt(0).toUpperCase()}${category.slice(1)} treatment`;
    (steps || []).forEach(function (step) {
      const item = document.createElement('li');
      item.textContent = step;
      list.appendChild(item);
    });

    treatmentContainer.append(heading, list);
  });
}

function displayPlantIDInfo(plantIdResponse) {
  const result = plantIdResponse && plantIdResponse.result;
  const suggestion = result && result.classification && result.classification.suggestions
    ? result.classification.suggestions[0]
    : null;

  if (!result || !suggestion) {
    throw new Error('Plant.id did not return an identification suggestion.');
  }

  if (!result.is_plant || !result.is_plant.binary) {
    resetResultState();
    setUploadStatus('This photo does not appear to contain a plant. Try a closer, clearer image.', 'error');
    return;
  }

  clearRenderedResults();
  document.getElementById('resultEmpty').hidden = true;
  document.getElementById('resultContent').hidden = false;

  const details = suggestion.details || {};
  const commonNames = details.common_names || [];
  const description = details.description && details.description.value
    ? details.description.value
    : 'No description is available for this suggestion.';
  const isHealthy = Boolean(result.is_healthy && result.is_healthy.binary);

  addResultLine('plant-name-container', 'Name', suggestion.name || 'Unknown plant');
  addResultLine('common-name-container', 'Common name', commonNames[0] || 'No common name available');
  addResultLine('probability-container', 'Confidence', formatPercent(suggestion.probability));
  addResultLine('plant-health-status-container', 'Health', isHealthy ? 'Healthy' : 'Needs attention');
  addResultLine('isPlant-container', 'Plant detected', 'Yes');
  addResultLine('description-container', 'Description', description);

  const similarImage = suggestion.similar_images && suggestion.similar_images[0];
  const similarImageElement = document.getElementById('plant-similiar-image');
  if (similarImage && similarImage.url) {
    similarImageElement.src = similarImage.url;
    similarImageElement.hidden = false;
  }

  const disease = result.disease && result.disease.suggestions
    ? result.disease.suggestions[0]
    : null;

  if (!disease) {
    addResultLine('plant-disease-name-container', 'Health note', 'No disease suggestion returned');
    return;
  }

  addResultLine('plant-disease-name-container', 'Possible issue', disease.name || 'Unknown');
  addResultLine('plant-disease-probabilty', 'Likelihood', formatPercent(disease.probability));
  addResultLine(
    'plant-disease-description',
    'Description',
    disease.details && disease.details.description
      ? disease.details.description
      : 'No disease description is available.'
  );
  renderTreatment(disease.details && disease.details.treatment);

  const diseaseImage = disease.similar_images && disease.similar_images[0];
  const diseaseImageElement = document.getElementById('plant-similiar-image-with-disease');
  if (diseaseImage && diseaseImage.url) {
    diseaseImageElement.src = diseaseImage.url;
    diseaseImageElement.hidden = false;
  }
}

function uploadAndIdentifyPlantID() {
  const selectedFile = photoInput.files[0];

  if (!selectedFile) {
    setUploadStatus('Please choose a plant photo before analyzing.', 'error');
    return;
  }

  if (!selectedFile.type.startsWith('image/')) {
    setUploadStatus('Please choose an image file.', 'error');
    return;
  }

  if (selectedFile.size > MAX_FILE_SIZE) {
    setUploadStatus('Please choose an image smaller than 10 MB.', 'error');
    return;
  }

  const reader = new FileReader();
  setAnalyzing(true);
  setUploadStatus('Plant.id is examining the photo…');

  reader.onload = function (event) {
    axios.post('/api/identify', {
      images: [event.target.result],
      latitude: 49.207,
      longitude: 16.608,
      health: 'all',
      similar_images: true
    })
      .then(function (response) {
        displayPlantIDInfo(response.data);
        if (response.data.result && response.data.result.is_plant && response.data.result.is_plant.binary) {
          setUploadStatus('Identification complete.', 'success');
        }
      })
      .catch(function (error) {
        const apiMessage = error.response && error.response.data && error.response.data.detail
          ? error.response.data.detail
          : error.message || 'The request could not be completed.';
        setUploadStatus(`Plant.id error: ${apiMessage}`, 'error');
        console.error('Plant.id request failed:', error);
      })
      .finally(function () {
        setAnalyzing(false);
      });
  };

  reader.onerror = function () {
    setUploadStatus('The selected photo could not be read.', 'error');
    setAnalyzing(false);
  };

  reader.readAsDataURL(selectedFile);
}

photoInput.addEventListener('change', function () {
  previewSelectedFile(photoInput.files[0]);
});

['dragenter', 'dragover'].forEach(function (eventName) {
  uploadPanel.addEventListener(eventName, function (event) {
    event.preventDefault();
    uploadPanel.classList.add('is-dragging');
  });
});

['dragleave', 'drop'].forEach(function (eventName) {
  uploadPanel.addEventListener(eventName, function (event) {
    event.preventDefault();
    uploadPanel.classList.remove('is-dragging');
  });
});

uploadPanel.addEventListener('drop', function (event) {
  const droppedFile = event.dataTransfer.files[0];
  if (!droppedFile) return;

  const transfer = new DataTransfer();
  transfer.items.add(droppedFile);
  photoInput.files = transfer.files;
  previewSelectedFile(droppedFile);
});

if (new URLSearchParams(window.location.search).has('demo')) {
  displayPlantIDInfo({
    result: {
      is_plant: { binary: true, probability: 0.998 },
      is_healthy: { binary: true, probability: 0.96 },
      classification: {
        suggestions: [{
          name: 'Monstera deliciosa',
          probability: 0.92,
          similar_images: [{ url: 'assets/monstera-result.jpg' }],
          details: {
            common_names: ['Swiss Cheese Plant'],
            description: {
              value: 'A tropical evergreen known for its large, naturally split leaves.'
            }
          }
        }]
      },
      disease: {
        suggestions: [{
          name: 'No significant issue detected',
          probability: 0.03,
          similar_images: [],
          details: {
            description: 'The leaves appear vibrant and show no major signs of disease.',
            treatment: {
              prevention: ['Provide bright, indirect light and allow the soil to drain well.']
            }
          }
        }]
      }
    }
  });
  setUploadStatus('Example identification result.', 'success');
}
