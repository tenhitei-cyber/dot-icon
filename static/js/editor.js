let currentGridSize = 24;
let gridData = [];
let currentTool = 'pen';
let isDrawing = false;
let isTraceMode = false; // 下絵モードかどうか

// ドットの円の大きさ係数（初期値 0.4 = 標準、最大 1.5 = 約3.75倍の大粒サイズ）
let dotRadiusRatio = 0.4;

// 拡大・縮小・移動・下絵濃度
let scaleFactor = 1.0;
let shiftX = 0;
let shiftY = 0;
let ghostAlpha = 0.3;

function openEditor(grid, size, isTrace = false) {
  gridData = JSON.parse(JSON.stringify(grid));
  currentGridSize = size;
  isTraceMode = isTrace;
  
  // パラメータ初期化
  resetTransformParams();

  // 下絵コントロールの表示/非表示（トレーシングモードのみ下絵表示）
  const ghostControl = document.getElementById('ghostControl');
  if (ghostControl) ghostControl.style.display = isTraceMode ? 'block' : 'none';

  const title = document.getElementById('editorTitle');
  if (title) title.innerText = isTraceMode ? '🎨 下絵トレーシングエディタ' : 'ドット微調整エディタ';

  const select = document.getElementById('gridSizeSelect');
  if (select) select.value = size;

  document.getElementById('candidatesSection').style.display = 'none';
  document.getElementById('editorSection').style.display = 'flex';
  renderEditor();
}

function resetTransformParams() {
  scaleFactor = 1.0;
  shiftX = 0;
  shiftY = 0;
  dotRadiusRatio = 0.4; // 初期ドットサイズに戻す
  
  const scaleSlider = document.getElementById('scaleSlider');
  if (scaleSlider) scaleSlider.value = 1.0;

  const dotSizeSlider = document.getElementById('dotSizeSlider');
  if (dotSizeSlider) dotSizeSlider.value = 0.4;

  const ghostSlider = document.getElementById('ghostSlider');
  if (ghostSlider) ghostAlpha = parseFloat(ghostSlider.value);
}

function renderEditor() {
  const canvas = document.getElementById('editorCanvas');
  const drawAlpha = isTraceMode ? ghostAlpha : 0; // 自動モードなら下絵なし(0)
  drawTransformedEditorDots(canvas, gridData, currentGridSize, scaleFactor, shiftX, shiftY, drawAlpha);
  
  const preview = document.getElementById('previewCanvas');
  drawTransformedEditorDots(preview, gridData, currentGridSize, scaleFactor, shiftX, shiftY, 0);
}

function drawTransformedEditorDots(canvas, grid, size, scale, dx, dy, alpha) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  ctx.clearRect(0, 0, w, w);

  // 黒背景丸
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
  ctx.fill();

  // 下絵描画 (トレーシングモードのみ)
  if (alpha > 0 && typeof rawImage !== 'undefined' && rawImage) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const imgScale = Math.min(w / rawImage.width, w / rawImage.height);
    const iw = rawImage.width * imgScale;
    const ih = rawImage.height * imgScale;
    ctx.drawImage(rawImage, (w - iw) / 2, (w - ih) / 2, iw, ih);
    ctx.restore();
  }

  const cellSize = (w * 0.8) / size;
  const offset = w * 0.1;

  ctx.save();
  ctx.translate(w / 2 + dx * cellSize, w / 2 + dy * cellSize);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -w / 2);

  // 白ドット（dotRadiusRatio を変更することで、ドットの径がダイナミックに拡大）
  ctx.fillStyle = '#ffffff';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y] && grid[y][x] === 1) {
        const cx = offset + x * cellSize + cellSize / 2;
        const cy = offset + y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * dotRadiusRatio, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

// ドットの円の大きさスライダー操作
function onDotSizeChange(val) {
  dotRadiusRatio = parseFloat(val);
  renderEditor();
}

// マス目サイズ（グリッド数）変更
function changeGridSize(newSize) {
  newSize = parseInt(newSize);
  const oldGrid = gridData;
  const oldSize = currentGridSize;
  const newGrid = Array.from({ length: newSize }, () => Array(newSize).fill(0));

  for (let y = 0; y < Math.min(oldSize, newSize); y++) {
    for (let x = 0; x < Math.min(oldSize, newSize); x++) {
      newGrid[y][x] = oldGrid[y][x];
    }
  }
  gridData = newGrid;
  currentGridSize = newSize;
  renderEditor();
}

// ワンボタンで全設定を初期状態（デフォルト）にリセット
function resetToDefaultAll() {
  resetTransformParams();
  renderEditor();
}

function onScaleChange(val) {
  scaleFactor = parseFloat(val);
  renderEditor();
}

function adjustScale(delta) {
  const slider = document.getElementById('scaleSlider');
  if (!slider) return;
  let newVal = parseFloat(slider.value) + delta;
  newVal = Math.max(0.5, Math.min(1.5, newVal));
  slider.value = newVal;
  scaleFactor = newVal;
  renderEditor();
}

function shiftPattern(dx, dy) {
  shiftX += dx;
  shiftY += dy;
  renderEditor();
}

function onGhostAlphaChange(val) {
  ghostAlpha = parseFloat(val);
  renderEditor();
}

// キャンバス描画イベント
const editorCanvas = document.getElementById('editorCanvas');
editorCanvas.addEventListener('mousedown', (e) => { isDrawing = true; editCell(e); });
editorCanvas.addEventListener('mousemove', (e) => { if (isDrawing) editCell(e); });
window.addEventListener('mouseup', () => { isDrawing = false; });

// 単一セルクリック＆描画処理
function editCell(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  const w = editorCanvas.width;
  const cellSize = (w * 0.8) / currentGridSize;
  const offset = w * 0.1;

  const centerX = w / 2;
  const localX = (clickX - centerX - (shiftX * cellSize)) / scaleFactor + centerX;
  const localY = (clickY - centerX - (shiftY * cellSize)) / scaleFactor + centerX;

  const x = Math.floor((localX - offset) / cellSize);
  const y = Math.floor((localY - offset) / cellSize);

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

function backToPrev() {
  if (isTraceMode) {
    document.getElementById('editorSection').style.display = 'none';
  } else {
    document.getElementById('candidatesSection').style.display = 'block';
    document.getElementById('editorSection').style.display = 'none';
  }
}

function downloadIcon() {
  const link = document.createElement('a');
  link.download = 'dot-icon.png';
  link.href = document.getElementById('previewCanvas').toDataURL();
  link.click();
}