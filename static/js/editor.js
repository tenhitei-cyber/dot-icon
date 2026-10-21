let currentGridSize = 24;
let gridData = [];
let currentTool = 'pen';
let isDrawing = false;
let isTraceMode = false; // 下絵トレースモードかどうか

// グリッド吸着モードの管理（true: 吸着あり, false: 自由配置）
let isSnapMode = true;
let freeDots = []; // 自由配置モード時のドットリスト [{x, y, radiusRatio}]

// ドラッグ移動管理用変数
let isDraggingDot = false;
let draggedDotValue = null; 
let dragSourcePos = null;   
let draggedFreeDotIndex = -1;
let currentMousePos = { x: 0, y: 0 }; // ドラッグ中のマウス位置追跡用

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
  isSnapMode = true; // 開く時はデフォルトで吸着ON
  freeDots = [];
  
  // パラメータ初期化
  resetTransformParams();

  // HTML側のチェックボックスの状態を同期
  const cb = document.getElementById('snapToggleCheckbox');
  if (cb) cb.checked = isSnapMode;

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

// スイッチ切り替え時の処理（グリッド⇔自由配置データの相互変換）
function toggleSnapMode(isChecked) {
  isSnapMode = isChecked;
  const w = 384;
  const size = currentGridSize;
  const cellSize = (w * 0.8) / size;
  const offset = w * 0.1;

  if (!isSnapMode) {
    // 【吸着ON ⇒ 自由配置OFF】 gridData から freeDots へ変換
    freeDots = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const val = gridData[y][x];
        if (val && val > 0) {
          const cx = offset + x * cellSize + cellSize / 2;
          const cy = offset + y * cellSize + cellSize / 2;
          freeDots.push({ x: cx, y: cy, radiusRatio: val === 1 ? 0.4 : val });
        }
      }
    }
  } else {
    // 【自由配置OFF ⇒ 吸着ON】 freeDots から gridData へ変換
    gridData = Array.from({ length: size }, () => Array(size).fill(0));
    freeDots.forEach(dot => {
      const gx = Math.floor((dot.x - offset) / cellSize);
      const gy = Math.floor((dot.y - offset) / cellSize);
      if (gx >= 0 && gx < size && gy >= 0 && gy < size) {
        gridData[gy][gx] = dot.radiusRatio;
      }
    });
    freeDots = [];
  }
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
  drawTransformedEditorDots(canvas, currentGridSize, scaleFactor, shiftX, shiftY, drawAlpha);
  
  const preview = document.getElementById('previewCanvas');
  drawTransformedEditorDots(preview, currentGridSize, scaleFactor, shiftX, shiftY, 0);

  updateDotSizePreview();
}

function updateDotSizePreview() {
  const pCanvas = document.getElementById('dotSizePreviewCanvas');
  if (!pCanvas) return;
  const pCtx = pCanvas.getContext('2d');
  const pw = pCanvas.width;
  pCtx.clearRect(0, 0, pw, pw);

  const cellSize = (384 * 0.8) / currentGridSize;
  const radius = cellSize * dotRadiusRatio;

  pCtx.fillStyle = '#ffffff';
  pCtx.beginPath();
  pCtx.arc(pw / 2, pw / 2, radius, 0, Math.PI * 2);
  pCtx.fill();
}

function drawTransformedEditorDots(canvas, size, scale, dx, dy, alpha) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  ctx.clearRect(0, 0, w, w);

  // キャンバス外枠にピッタリ内接する黒背景丸
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
  ctx.fill();

  // 下絵描画
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

  // グリッド線（ガイド）の描画
  if (appMode === 'manual' || isTraceMode) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i++) {
      ctx.beginPath();
      ctx.moveTo(offset + i * cellSize, offset);
      ctx.lineTo(offset + i * cellSize, offset + size * cellSize);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(offset, offset + i * cellSize);
      ctx.lineTo(offset + size * cellSize, offset + i * cellSize);
      ctx.stroke();
    }
  }

  // 白ドットの描画（吸着モードか自由配置モードかで切り替え）
  ctx.fillStyle = '#ffffff';
  if (isSnapMode) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cellValue = gridData[y] && gridData[y][x];
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
    // 吸着モードでドラッグ中の場合、マウス位置に掴んでいるドットを半透明で常時表示する
    if (isDraggingDot && draggedDotValue !== null) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(currentMousePos.localX, currentMousePos.localY, cellSize * draggedDotValue, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    freeDots.forEach((dot, index) => {
      // 自由配置モードでドラッグ中のドットは、元の位置ではなくマウス位置に表示するためここではスキップ
      if (!(isDraggingDot && index === draggedFreeDotIndex)) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, cellSize * dot.radiusRatio, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    // 自由配置モードでドラッグ中のドットをマウス位置に表示
    if (isDraggingDot && draggedFreeDotIndex !== -1) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(currentMousePos.localX, currentMousePos.localY, cellSize * draggedDotValue, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function onDotSizeChange(val) {
  dotRadiusRatio = parseFloat(val);
  updateDotSizePreview();
}

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
  freeDots = [];
  renderEditor();
}

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

// キャンバス描画・マウスイベント処理
const editorCanvas = document.getElementById('editorCanvas');

editorCanvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  handlePointerDown(e);
});

editorCanvas.addEventListener('mousemove', (e) => {
  const { localX, localY } = getLocalCoords(e);
  currentMousePos = { localX, localY };
  if (isDrawing) {
    handlePointerMove(e);
  }
});

window.addEventListener('mouseup', (e) => {
  if (isDrawing) {
    handlePointerUp(e);
  }
  isDrawing = false;
  isDraggingDot = false;
  draggedDotValue = null;
  dragSourcePos = null;
  draggedFreeDotIndex = -1;
  renderEditor();
});

function getLocalCoords(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const scaleX = editorCanvas.width / rect.width;
  const scaleY = editorCanvas.height / rect.height;

  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;

  const w = editorCanvas.width;
  const cellSize = (w * 0.8) / currentGridSize;

  const centerX = w / 2;
  const centerY = w / 2;
  const localX = (clickX - centerX - (shiftX * cellSize)) / scaleFactor + centerX;
  const localY = (clickY - centerY - (shiftY * cellSize)) / scaleFactor + centerY;

  return { localX, localY };
}

function handlePointerDown(e) {
  const { localX, localY } = getLocalCoords(e);
  currentMousePos = { localX, localY };
  const w = editorCanvas.width;
  const cellSize = (w * 0.8) / currentGridSize;
  const offset = w * 0.1;

  if (isSnapMode) {
    const x = Math.floor((localX - offset) / cellSize);
    const y = Math.floor((localY - offset) / cellSize);

    if (x >= 0 && x < currentGridSize && y >= 0 && y < currentGridSize) {
      if (currentTool === 'pen') {
        if (gridData[y][x] > 0) {
          isDraggingDot = true;
          draggedDotValue = gridData[y][x];
          dragSourcePos = { x, y };
          gridData[y][x] = 0;
        } else {
          gridData[y][x] = dotRadiusRatio;
        }
      } else {
        gridData[y][x] = 0;
      }
      renderEditor();
    }
  } else {
    if (currentTool === 'pen') {
      const hitIndex = freeDots.findIndex(dot => {
        const dist = Math.hypot(dot.x - localX, dot.y - localY);
        return dist <= (cellSize * dot.radiusRatio * 1.5); // 掴みやすく少し判定を拡大
      });

      if (hitIndex !== -1) {
        isDraggingDot = true;
        draggedFreeDotIndex = hitIndex;
        draggedDotValue = freeDots[hitIndex].radiusRatio;
        // ドラッグ中はリストから外さず保持し、描画側でマウス位置に追従させる
      } else {
        freeDots.push({ x: localX, y: localY, radiusRatio: dotRadiusRatio });
      }
    } else {
      freeDots = freeDots.filter(dot => {
        const dist = Math.hypot(dot.x - localX, dot.y - localY);
        return dist > (cellSize * dot.radiusRatio);
      });
    }
    renderEditor();
  }
}

function handlePointerMove(e) {
  if (isDraggingDot) {
    renderEditor(); // ドラッグ中はマウス位置に円が追従して描き直される
  } else if (currentTool === 'pen' && isSnapMode) {
    const { localX, localY } = getLocalCoords(e);
    const w = editorCanvas.width;
    const cellSize = (w * 0.8) / currentGridSize;
    const offset = w * 0.1;
    const x = Math.floor((localX - offset) / cellSize);
    const y = Math.floor((localY - offset) / cellSize);
    if (x >= 0 && x < currentGridSize && y >= 0 && y < currentGridSize) {
      gridData[y][x] = dotRadiusRatio;
      renderEditor();
    }
  } else if (currentTool === 'eraser') {
    const { localX, localY } = getLocalCoords(e);
    const w = editorCanvas.width;
    const cellSize = (w * 0.8) / currentGridSize;
    const offset = w * 0.1;
    if (isSnapMode) {
      const x = Math.floor((localX - offset) / cellSize);
      const y = Math.floor((localY - offset) / cellSize);
      if (x >= 0 && x < currentGridSize && y >= 0 && y < currentGridSize) {
        gridData[y][x] = 0;
        renderEditor();
      }
    } else {
      freeDots = freeDots.filter(dot => {
        const dist = Math.hypot(dot.x - localX, dot.y - localY);
        return dist > (cellSize * dot.radiusRatio);
      });
      renderEditor();
    }
  }
}

function handlePointerUp(e) {
  const { localX, localY } = getLocalCoords(e);
  const w = editorCanvas.width;
  const cellSize = (w * 0.8) / currentGridSize;
  const offset = w * 0.1;

  if (isSnapMode && isDraggingDot) {
    const x = Math.floor((localX - offset) / cellSize);
    const y = Math.floor((localY - offset) / cellSize);

    if (x >= 0 && x < currentGridSize && y >= 0 && y < currentGridSize) {
      gridData[y][x] = draggedDotValue;
    } else if (dragSourcePos) {
      gridData[dragSourcePos.y][dragSourcePos.x] = draggedDotValue;
    }
  } else if (!isSnapMode && isDraggingDot && draggedFreeDotIndex !== -1) {
    // 自由配置モードのドロップ：元の位置のデータを更新または新規追加
    freeDots[draggedFreeDotIndex] = { x: localX, y: localY, radiusRatio: draggedDotValue };
  }
  renderEditor();
}

function setTool(tool) {
  currentTool = tool;
  document.getElementById('penBtn').classList.toggle('active', tool === 'pen');
  document.getElementById('eraserBtn').classList.toggle('active', tool === 'eraser');
}

function clearEditor() {
  gridData = Array.from({ length: currentGridSize }, () => Array(currentGridSize).fill(0));
  freeDots = [];
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

function downloadIcon() {
  const dlCanvas = document.createElement('canvas');
  dlCanvas.width = 64;
  dlCanvas.height = 64;
  
  if (!isSnapMode) {
    const tempGrid = Array.from({ length: currentGridSize }, () => Array(currentGridSize).fill(0));
    const w = 384;
    const size = currentGridSize;
    const cellSize = (w * 0.8) / size;
    const offset = w * 0.1;
    freeDots.forEach(dot => {
      const gx = Math.floor((dot.x - offset) / cellSize);
      const gy = Math.floor((dot.y - offset) / cellSize);
      if (gx >= 0 && gx < size && gy >= 0 && gy < size) {
        tempGrid[gy][gx] = dot.radiusRatio;
      }
    });
    drawTransformedEditorDotsCustom(dlCanvas, tempGrid, currentGridSize, scaleFactor, shiftX, shiftY, 0);
  } else {
    drawTransformedEditorDots(dlCanvas, currentGridSize, scaleFactor, shiftX, shiftY, 0);
  }

  const link = document.createElement('a');
  link.download = 'dot-icon-64x64.png';
  link.href = dlCanvas.toDataURL('image/png');
  link.click();
}

function drawTransformedEditorDotsCustom(canvas, grid, size, scale, dx, dy, alpha) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  ctx.clearRect(0, 0, w, w);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
  ctx.fill();

  const cellSize = (w * 0.8) / size;
  const offset = w * 0.1;

  ctx.save();
  ctx.translate(w / 2 + dx * cellSize, w / 2 + dy * cellSize);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -w / 2);

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
