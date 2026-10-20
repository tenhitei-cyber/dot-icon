let rawImage = null;
let appMode = 'auto'; // 'auto': 自動変換 / 'trace': 下絵トレース / 'manual': 白紙手動作成

// モード切替処理
function switchMode(mode) {
  appMode = mode;
  document.getElementById('tabAutoMode').className = (mode === 'auto') ? 'btn active' : 'btn btn-secondary';
  document.getElementById('tabTraceMode').className = (mode === 'trace') ? 'btn active' : 'btn btn-secondary';
  document.getElementById('tabManualMode').className = (mode === 'manual') ? 'btn active' : 'btn btn-secondary';
  
  const uploadArea = document.getElementById('dropArea');
  const manualArea = document.getElementById('manualStartArea');

  if (mode === 'auto') {
    uploadArea.style.display = 'block';
    manualArea.style.display = 'none';
    document.getElementById('uploadText').innerText = '📁 画像をドラッグ＆ドロップ（自動で20候補を作成）';
  } else if (mode === 'trace') {
    uploadArea.style.display = 'block';
    manualArea.style.display = 'none';
    document.getElementById('uploadText').innerText = '📁 下絵画像をドラッグ＆ドロップ（下絵を見ながら手動トレース）';
  } else { // 'manual'
    uploadArea.style.display = 'none';
    manualArea.style.display = 'block';
  }
}

// ドロップ・ファイル読み込み処理
const dropArea = document.getElementById('dropArea');
dropArea.addEventListener('dragover', (e) => { e.preventDefault(); });
dropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files.length) handleImage(e.dataTransfer.files[0]);
});

function handleImage(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      rawImage = img;
      if (appMode === 'auto') {
        document.getElementById('candidatesSection').style.display = 'block';
        document.getElementById('editorSection').style.display = 'none';
        generate20Candidates();
      } else {
        document.getElementById('candidatesSection').style.display = 'none';
        const emptyGrid = Array.from({ length: 24 }, () => Array(24).fill(0));
        openEditor(emptyGrid, 24, true); // 下絵トレースモード
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// 白紙手動作成のスタート
function startBlankManual() {
  rawImage = null;
  document.getElementById('candidatesSection').style.display = 'none';
  const emptyGrid = Array.from({ length: 24 }, () => Array(24).fill(0));
  openEditor(emptyGrid, 24, false); // 白紙手動モード（下絵なし）
}

// パターン別・パラメータ生成 (20候補)
function generate20Candidates() {
  if (!rawImage) return;  
  const randomOffset = Math.random() * 0.1 - 0.05;

  renderGroup('gridA', 24, (i) => ({ thresh: 0.5 + i * 0.08 + randomOffset, mode: 'standard' }));
  renderGroup('gridB', 32, (i) => ({ thresh: 0.4 + i * 0.1 + randomOffset, mode: 'fine' }));
  renderGroup('gridC', 18, (i) => ({ thresh: 0.5 + i * 0.08 + randomOffset, mode: 'retro' }));
  renderGroup('gridD', 24, (i) => ({ thresh: 0.3 + i * 0.1 + randomOffset, mode: 'outline' }));
}

function renderGroup(elementId, size, paramFunc) {
  const container = document.getElementById(elementId);
  container.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const params = paramFunc(i);
    const card = document.createElement('div');
    card.className = 'candidate-card';

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    
    const gData = processToGrid(rawImage, size, params);
    drawDotsOnCanvas(canvas, gData, size);

    card.appendChild(canvas);
    card.onclick = () => openEditor(gData, size, false); // 自動変換モード（下絵なし）
    container.appendChild(card);
  }
}

// 画像から2Dグリッド配列(0/1)に変換処理
function processToGrid(img, gridSize, params) {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = gridSize;
  tempCanvas.height = gridSize;
  const ctx = tempCanvas.getContext('2d');

  const scale = Math.min(gridSize / img.width, gridSize / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (gridSize - w) / 2, (gridSize - h) / 2, w, h);

  const imgData = ctx.getImageData(0, 0, gridSize, gridSize);
  const data = imgData.data;

  const isBackground = floodFillBackground(data, gridSize, gridSize);
  const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const idx = (y * gridSize + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
      
      if (a < 30) continue;

      if (isBackground[y][x]) {
        grid[y][x] = 0;
        continue;
      }

      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      grid[y][x] = (brightness < params.thresh) ? 1 : 0;
    }
  }
  return grid;
}

function floodFillBackground(data, width, height) {
  const visited = Array.from({ length: height }, () => Array(width).fill(false));
  const isBg = Array.from({ length: height }, () => Array(width).fill(false));

  const sampleColors = [
    [data[0], data[1], data[2]],
    [data[(width - 1) * 4], data[(width - 1) * 4 + 1], data[(width - 1) * 4 + 2]],
    [data[((height - 1) * width) * 4], data[((height - 1) * width) * 4 + 1], data[((height - 1) * width) * 4 + 2]],
    [data[((height - 1) * width + width - 1) * 4], data[((height - 1) * width + width - 1) * 4 + 1], data[((height - 1) * width + width - 1) * 4 + 2]]
  ];

  const queue = [];
  const startPoints = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];

  startPoints.forEach(([sx, sy]) => {
    queue.push([sx, sy]);
    visited[sy][sx] = true;
  });

  const colorTolerance = 35;
  function colorMatch(r1, g1, b1, r2, g2, b2) {
    return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) < colorTolerance;
  }

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    isBg[y][x] = true;

    const idx = (y * width + x) * 4;
    const cr = data[idx], cg = data[idx+1], cb = data[idx+2];

    const neighbors = [[x+1, y], [x-1, y], [x, y+1], [x, y-1]];
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny][nx]) {
        visited[ny][nx] = true;
        const nIdx = (ny * width + nx) * 4;
        const nr = data[nIdx], ng = data[nIdx+1], nb = data[nIdx+2];

        let matches = sampleColors.some(sc => colorMatch(nr, ng, nb, sc[0], sc[1], sc[2])) ||
                      colorMatch(nr, ng, nb, cr, cg, cb);

        if (matches) queue.push([nx, ny]);
      }
    }
  }

  return isBg;
}

function drawDotsOnCanvas(canvas, grid, gridSize) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  ctx.clearRect(0, 0, w, w);

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
  ctx.fill();

  const cellSize = (w * 0.8) / gridSize;
  const offset = w * 0.1;
  ctx.fillStyle = '#ffffff';

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x] === 1) {
        const cx = offset + x * cellSize + cellSize / 2;
        const cy = offset + y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
