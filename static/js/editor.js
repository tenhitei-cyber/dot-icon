let currentGridSize = 24;
let gridData = [];
let currentTool = 'pen';
let isDrawing = false;

// 💡 拡大・縮小・移動用のパラメータ ＆ 下絵の濃さパラメータ
let scaleFactor = 1.0;
let shiftX = 0;
let shiftY = 0;
let ghostAlpha = 0.25; // 初期の下絵の濃さ (25%)

function openEditor(grid, size) {
  gridData = JSON.parse(JSON.stringify(grid));
  currentGridSize = size;
  
  // パラメータ初期化
  scaleFactor = 1.0;
  shiftX = 0;
  shiftY = 0;
  
  const slider = document.getElementById('scaleSlider');
  if (slider) slider.value = 1.0;

  const ghostSlider = document.getElementById('ghostSlider');
  if (ghostSlider) {
    ghostAlpha = parseFloat(ghostSlider.value);
  }

  document.getElementById('candidatesSection').style.display = 'none';
  document.getElementById('editorSection').style.display = 'flex';
  renderEditor();
}

function renderEditor() {
  const canvas = document.getElementById('editorCanvas');
  drawTransformedEditorDots(canvas, gridData, currentGridSize, scaleFactor, shiftX, shiftY, ghostAlpha);
  
  const preview = document.getElementById('previewCanvas');
  // プレビュー側には下絵を表示させず、純粋なドット結果だけを描画
  drawTransformedEditorDots(preview, gridData, currentGridSize, scaleFactor, shiftX, shiftY, 0);
}

// 💡 下絵（rawImage）とうっすら重ねて描画する拡張関数
function drawTransformedEditorDots(canvas, grid, size, scale, dx, dy, alpha) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  ctx.clearRect(0, 0, w, w);

  // 黒背景丸（ベース）
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
  ctx.fill();

  // 💡 1. 下絵（rawImage）が存在する場合、エディタ側にうっすらと描画する
  if (alpha > 0 && typeof rawImage !== 'undefined' && rawImage) {
    ctx.save();
    ctx.globalAlpha = alpha; // スライダーに応じた透明度
    // アスペクト比を維持して中央配置（main.jsのprocessToGridと同じ計算）
    const imgScale = Math.min(w / rawImage.width, w / rawImage.height);
    const iw = rawImage.width * imgScale;
    const ih = rawImage.height * imgScale;
    ctx.drawImage(rawImage, (w - iw) / 2, (w - ih) / 2, iw, ih);
    ctx.restore();
  }

  const cellSize = (w * 0.8) / size;
  const offset = w * 0.1;

  ctx.save();
  // キャンバスの中心を基準に拡大・縮小と移動を行う
  ctx.translate(w / 2 + dx * cellSize, w / 2 + dy * cellSize);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -w / 2);

  // 白ドットの描画
  ctx.fillStyle = '#ffffff';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y] && grid[y][x] === 1) {
        const cx = offset + x * cellSize + cellSize / 2;
        const cy = offset + y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

// --- 💡 スライダー・ボタン操作用関数 ---
function onScaleChange(val) {
  scaleFactor = parseFloat(val);
  renderEditor();
}

function adjustScale(delta) {
  const slider = document.getElementById('scaleSlider');
  if (!slider) return;
  let newVal = parseFloat(slider.value) + delta;
  newVal = Math.max(0.5, Math.min(1.5, newVal)); // 0.5倍〜1.5倍の制限
  slider.value = newVal;
  scaleFactor = newVal;
  renderEditor();
}

function shiftPattern(dx, dy) {
  shiftX += dx;
  shiftY += dy;
  renderEditor();
}

function resetTransform() {
  scaleFactor = 1.0;
  shiftX = 0;
  shiftY = 0;
  const slider = document.getElementById('scaleSlider');
  if (slider) slider.value = 1.0;
  renderEditor();
}

// 💡 下絵の濃さスライダー操作用
function onGhostAlphaChange(val) {
  ghostAlpha = parseFloat(val);
  renderEditor();
}
// ------------------------------------

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

  // 拡大・縮小や位置移動のオフセットを逆算して、クリックされたセルの位置を正確に割り出す
  const centerX = w / 2;
  const adjustedX = (clickX - centerX) / scaleFactor + centerX - (shiftX * cellSize);
  const adjustedY = (clickY - centerX) / scaleFactor + centerX - (shiftY * cellSize);

  const x = Math.floor((adjustedX - offset) / cellSize);
  const y = Math.floor((adjustedY - offset) / cellSize);

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
