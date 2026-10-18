let currentGridSize = 24;
let gridData = [];
let currentTool = 'pen';
let isDrawing = false;

function openEditor(grid, size) {
  gridData = JSON.parse(JSON.stringify(grid));
  currentGridSize = size;
  document.getElementById('candidatesSection').style.display = 'none';
  document.getElementById('editorSection').style.display = 'flex';
  renderEditor();
}

function renderEditor() {
  const canvas = document.getElementById('editorCanvas');
  drawDotsOnCanvas(canvas, gridData, currentGridSize);
  
  const preview = document.getElementById('previewCanvas');
  drawDotsOnCanvas(preview, gridData, currentGridSize);
}

const editorCanvas = document.getElementById('editorCanvas');
editorCanvas.addEventListener('mousedown', (e) => { isDrawing = true; editCell(e); });
editorCanvas.addEventListener('mousemove', (e) => { if (isDrawing) editCell(e); });
window.addEventListener('mouseup', () => { isDrawing = false; });

function editCell(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  const w = editorCanvas.width;
  const cellSize = (w * 0.8) / currentGridSize;
  const offset = w * 0.1;

  const x = Math.floor((clickX - offset) / cellSize);
  const y = Math.floor((clickY - offset) / cellSize);

  if (x >= 0 && x < currentGridSize && y >= 0 && y < currentGridSize) {
    gridData[y][x] = (currentTool === 'pen') ? 1 : 0;
    renderEditor();
  }
}

function setTool(tool) {
  currentTool = tool;
  document.getElementById('penBtn').classList.toggle('active', tool === 'pen');
  document.getElementById('eraserBtn').classList.toggle('active', tool === 'eraser');
}

function clearEditor() {
  gridData = Array.from({ length: currentGridSize }, () => Array(currentGridSize).fill(0));
  renderEditor();
}

function backToCandidates() {
  document.getElementById('candidatesSection').style.display = 'block';
  document.getElementById('editorSection').style.display = 'none';
}

function downloadIcon() {
  const link = document.createElement('a');
  link.download = 'dot-icon.png';
  link.href = document.getElementById('previewCanvas').toDataURL();
  link.click();
}