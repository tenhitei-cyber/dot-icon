let currentGridSize = 24;
let gridData = [];
let currentTool = 'pen';
let isDrawing = false;
let isTraceMode = false; // 下絵トレースモードかどうか

// 現在のペンの太さ（ドットスライダーの値。初期値 0.4）
let dotRadiusRatio = 0.4;

// 拡大・縮小・移動・下絵濃度
let scaleFactor = 1.0;
let shiftX = 0;
let shiftY = 0;
let ghostAlpha = 0.3;

function openEditor(grid, size, isTrace = false) {
  gridData = JSON.parse(JSON.stringify(grid)).map(row => 
    row.map(cell => (cell === 1 ? 0.4 : cell))
  );
  currentGridSize = size;
  isTraceMode = isTrace;
  
  // パラメータ初期化
  resetTransformParams();

  // 下絵コントロールの表示/非表示
  const ghostControl = document.getElementById('ghostControl');
  if (ghostControl) ghostControl.style.display = isTraceMode ? 'block' : 'none';

  const title = document.getElementById('editorTitle');
  if (title) {
    if (isTraceMode) title.innerText = '🎨 下絵トレーシングエディタ';
    else if (appMode === 'manual') title.innerText = '✏️ 白紙手動作成エディタ';
    else title.innerText = 'ドット微調整エディタ';
  }

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
  dotRadiusRatio = 0.4;
  
  const scaleSlider = document.getElementById('scaleSlider');
  if (scaleSlider) scaleSlider.value = 1.0;

  const dotSizeSlider = document.getElementById('dotSizeSlider');
  if (dotSizeSlider) dotSizeSlider.value = 0.4;

  const ghostSlider = document.getElementById('ghostSlider');
  if (ghostSlider) ghostAlpha = parseFloat(ghostSlider.value);
  
  updateDotSizePreview();
}

function renderEditor() {
  const canvas = document.getElementById('editorCanvas');
  const drawAlpha = isTraceMode ? ghostAlpha : 0;
  drawTransformedEditorDots(canvas, gridData, currentGridSize, scaleFactor, shiftX, shiftY, drawAlpha);
  
  const preview = document.getElementById('previewCanvas');
  drawTransformedEditorDots(preview, gridData, currentGridSize, scaleFactor, shiftX, shiftY, 0);

  updateDotSizePreview();
}

// ==========================================
// 【完全一致方式】実際の1マスのピクセルサイズをプレビューにそのまま適用
// ==========================================
function updateDotSizePreview() {
  const pCanvas = document.getElementById('dotSizePreviewCanvas');
  if (!pCanvas) return;
  const pCtx = pCanvas.getContext('2d');
  const pw = pCanvas.width; // 36px
  pCtx.clearRect(0, 0, pw, pw);

  // メイン画面の1マス（cellSize）の大きさをそのまま基準にする
  const cellSize = (384 * 0.8) / currentGridSize;
  const radius = cellSize * dotRadiusRatio;

  pCtx.fillStyle = '#ffffff';
  pCtx.beginPath();
  pCtx.arc(pw / 2, pw / 2, radius, 0, Math.PI * 2);
  pCtx.fill();
}

function drawTransformedEditorDots(canvas, grid, size, scale, dx, dy, alpha) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  ctx.clearRect(0, 0, w, w);

  // キャンバス外枠にピッタリ内接する黒背景丸
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
  ctx.fill();

  // 下絵描画 (トレースモードかつ画像が存在する場合のみ)
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

  // グリッド線（方眼）の描画：手動作成またはトレースモードのときに表示
  if (appMode === 'manual' || isTraceMode) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i++) {
      // 縦線
      ctx.beginPath();
      ctx.moveTo(offset + i * cellSize, offset);
      ctx.lineTo(offset + i * cellSize, offset + size * cellSize);
      ctx.stroke();
      // 横線
      ctx.beginPath();
      ctx.moveTo(offset, offset + i * cellSize);
      ctx.lineTo(offset + size * cellSize, offset + i * cellSize);
      ctx.stroke();
    }
  }

  // 白ドット
  ctx.fillStyle = '#ffffff';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cellValue = grid[y] && grid[y][x];
      if (cellValue && cellValue > 0) {
        const radiusRatio = (cellValue === 1) ? 0.4 : cellValue;
        
        const cx = offset + x * cellSize + cellSize / 2;
        const cy = offset + y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * radiusRatio, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

// ドットサイズスライダー操作
function onDotSizeChange(val) {
  dotRadiusRatio = parseFloat(val);
  updateDotSizePreview();
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

// 初期状態にリセット
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

// 単一セルクリック＆描画処理（マウス位置のズレなし）
function editCell(e) {
  const rect = editorCanvas.getBoundingClientRect();
  
  const scaleX = editorCanvas.width / rect.width;
  const scaleY = editorCanvas.height / rect.height;

  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;

  const w = editorCanvas.width;
  const cellSize = (w * 0.8) / currentGridSize;
  const offset = w * 0.1;

  const centerX = w / 2;
  const centerY = w / 2;
  const localX = (clickX - centerX - (shiftX * cellSize)) / scaleFactor + centerX;
  const localY = (clickY - centerY - (shiftY * cellSize)) / scaleFactor + centerY;

  const x = Math.floor((localX - offset) / cellSize);
  const y = Math.floor((localY - offset) / cellSize);

  if (x >= 0 && x < currentGridSize && y >= 0 && y < currentGridSize) {
    if (currentTool === 'pen') {
      gridData[y][x] = dotRadiusRatio;
    } else {
      gridData[y][x] = 0;
    }
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
  if (isTraceMode || appMode === 'manual') {
    document.getElementById('editorSection').style.display = 'none';
  } else {
    document.getElementById('candidatesSection').style.display = 'block';
    document.getElementById('editorSection').style.display = 'none';
  }
}

// 外枠 64×64 ピクセル・ぴったり内接する円アイコンとしてダウンロード
function downloadIcon() {
  const dlCanvas = document.createElement('canvas');
  dlCanvas.width = 64;
  dlCanvas.height = 64;
  
  drawTransformedEditorDots(dlCanvas, gridData, currentGridSize, scaleFactor, shiftX, shiftY, 0);

  const link = document.createElement('a');
  link.download = 'dot-icon-64x64.png';
  link.href = dlCanvas.toDataURL('image/png');
  link.click();
}
