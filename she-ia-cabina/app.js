/* Cabina SHE IA — todo se procesa en el navegador. No hay red, ni almacenamiento, ni analítica. */
(function () {
  'use strict';

  // ---------- Constantes de composición ----------
  var W = 900, H = 2400;           // tira
  var PX = 60, PW = 780, PH = 580, GAP = 30, PY = 300;
  var ASPECT = PW / PH;
  var SW = 1080, SH = 1920;        // historias
  var STORY_TOP = 250, STORY_BOTTOM = 300; // márgenes seguros de la interfaz de Instagram
  var LOGO_BOX = { x: 170, y: 70, w: 560, h: 190 };
  var LOGO_SRC = 'assets/logo-she-ia.png';
  var TAGLINE = 'Mujeres en IA, creando el futuro';
  var DATE_TXT = '22 de octubre de 2026 · Panamá';
  var HASHTAG = '#SheIAExpo';

  var FRAMES = {
    esencial: { bg: '#FFFFFF', ink: '#1B1D4F', dot: '#E9E6FF', line: '#FFB6E6', spark: '#FF4DB8', plate: false, storyBg: '#E9E6FF' },
    noche:    { bg: '#1B1D4F', ink: '#FFFFFF', dot: 'rgba(255,182,230,0.22)', line: 'rgba(255,77,184,0.55)', spark: '#FFB6E6', plate: true, storyBg: '#1B1D4F' },
    conexion: { bg: '#E9E6FF', ink: '#1B1D4F', dot: 'rgba(106,61,255,0.18)', line: '#FFB6E6', spark: '#6A3DFF', plate: false, storyBg: '#FFFFFF' }
  };

  // ---------- Estado ----------
  var $ = function (id) { return document.getElementById(id); };
  var els = {};
  ['screenWelcome', 'screenCamera', 'screenResult', 'video', 'overlay', 'shotLabel', 'count', 'flash', 'liveRegion', 'thumbs',
   'camHint', 'btnShoot', 'btnCancelShoot', 'btnExitCamera', 'btnOpenCamera', 'btnGallery', 'fileInput', 'welcomeError',
   'inAppNotice', 'noCameraNotice', 'noCameraText', 'btnCopyLink', 'stripCanvas', 'btnSaveStrip', 'btnSaveStory', 'btnShare',
   'btnRestart', 'resultStatus', 'working', 'brandLogo', 'logoMissing'].forEach(function (id) { els[id] = $(id); });

  var state = {
    frame: 'esencial',
    stream: null,
    photos: [],        // canvases PW:PH (recorte cover)
    runId: 0,          // cambia al cancelar para abortar la secuencia
    busy: false,
    screen: 'welcome',
    stripBlob: null,
    renderToken: 0,
    logo: null         // HTMLImageElement | null
  };
  var wake = null;     // función para despertar un sleep al cancelar

  // ---------- Utilidades ----------
  function show(name) {
    state.screen = name;
    els.screenWelcome.hidden = name !== 'welcome';
    els.screenCamera.hidden = name !== 'camera';
    els.screenResult.hidden = name !== 'result';
    window.scrollTo(0, 0);
  }
  function setError(msg) {
    els.welcomeError.textContent = msg || '';
    els.welcomeError.hidden = !msg;
  }
  function setStatus(msg) {
    els.resultStatus.textContent = msg || '';
    els.resultStatus.hidden = !msg;
  }
  function sleep(ms) {
    return new Promise(function (resolve) {
      var t = setTimeout(done, ms);
      function done() { clearTimeout(t); wake = null; resolve(); }
      wake = done;
    });
  }
  function isInApp() { return /Instagram|FBAN|FBAV|FB_IAB|Messenger|TikTok|Snapchat|Line\//i.test(navigator.userAgent); }
  function cameraSupported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext !== false; }

  // ---------- Logo ----------
  function loadLogo() {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { state.logo = img; els.brandLogo.src = LOGO_SRC; els.brandLogo.hidden = false; els.logoMissing.hidden = true; resolve(); };
      img.onerror = function () { state.logo = null; els.brandLogo.hidden = true; els.logoMissing.hidden = false; resolve(); };
      img.src = LOGO_SRC;
    });
  }

  // ---------- Dibujo ----------
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function sparkle(ctx, cx, cy, s, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.quadraticCurveTo(cx, cy, cx + s, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + s);
    ctx.quadraticCurveTo(cx, cy, cx - s, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - s);
    ctx.fill();
    ctx.restore();
  }
  function circuit(ctx, x, y, dir, f) {
    // dir: 1 = crece hacia la derecha, -1 = hacia la izquierda
    ctx.save();
    ctx.strokeStyle = f.line; ctx.fillStyle = f.line; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + dir * 90, y); ctx.lineTo(x + dir * 120, y + 30); ctx.lineTo(x + dir * 200, y + 30);
    ctx.moveTo(x, y + 44); ctx.lineTo(x + dir * 50, y + 44); ctx.lineTo(x + dir * 70, y + 64); ctx.lineTo(x + dir * 120, y + 64);
    ctx.stroke();
    [[x + dir * 90, y], [x + dir * 200, y + 30], [x + dir * 120, y + 64]].forEach(function (p) {
      ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }
  function dotColumn(ctx, x, y0, y1, step, f) {
    ctx.fillStyle = f.dot;
    for (var y = y0; y <= y1; y += step) { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawLogoArea(ctx, f) {
    var b = LOGO_BOX;
    if (!state.logo) {
      ctx.save();
      ctx.setLineDash([14, 10]); ctx.lineWidth = 3; ctx.strokeStyle = '#6A3DFF';
      rr(ctx, b.x, b.y + 15, b.w, b.h - 30, 24); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = f.ink === '#FFFFFF' ? '#FFB6E6' : '#6A3DFF';
      ctx.font = '600 28px Poppins, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ESPACIO PARA EL LOGO SHE IA', b.x + b.w / 2, b.y + b.h / 2);
      ctx.restore();
      return;
    }
    var iw = state.logo.naturalWidth, ih = state.logo.naturalHeight;
    var s = Math.min(b.w / iw, b.h / ih);
    var w = iw * s, h = ih * s, x = b.x + (b.w - w) / 2, y = b.y + (b.h - h) / 2;
    if (f.plate) { // el logo conserva sus colores sobre una placa blanca
      ctx.save(); ctx.fillStyle = '#FFFFFF'; rr(ctx, x - 28, y - 22, w + 56, h + 44, 30); ctx.fill(); ctx.restore();
    }
    ctx.drawImage(state.logo, x, y, w, h);
  }
  function drawStrip(ctx, f) {
    ctx.save();
    ctx.fillStyle = f.bg; ctx.fillRect(0, 0, W, H);
    // decoración en los márgenes (fuera de rostros y logo)
    dotColumn(ctx, 30, PY, PY + 3 * PH + 2 * GAP, 60, f);
    dotColumn(ctx, W - 30, PY, PY + 3 * PH + 2 * GAP, 60, f);
    circuit(ctx, 0, 50, 1, f); circuit(ctx, W, 50, -1, f);
    sparkle(ctx, 130, 250, 16, f.spark); sparkle(ctx, 782, 120, 22, f.spark);

    drawLogoArea(ctx, f);

    for (var i = 0; i < 3; i++) {
      var y = PY + i * (PH + GAP);
      ctx.save();
      rr(ctx, PX, y, PW, PH, 24); ctx.clip();
      ctx.fillStyle = '#E9E6FF'; ctx.fillRect(PX, y, PW, PH);
      if (state.photos[i]) ctx.drawImage(state.photos[i], PX, y, PW, PH);
      ctx.restore();
    }

    // pie
    var fy = PY + 3 * PH + 2 * GAP; // 2100
    var g = ctx.createLinearGradient(W / 2 - 70, 0, W / 2 + 70, 0);
    g.addColorStop(0, '#6A3DFF'); g.addColorStop(1, '#FF4DB8');
    ctx.fillStyle = g; rr(ctx, W / 2 - 70, fy + 28, 140, 6, 3); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = f.ink; ctx.font = '600 40px Poppins, Arial, sans-serif';
    ctx.fillText(DATE_TXT, W / 2, fy + 100);
    ctx.font = '700 56px Poppins, Arial, sans-serif';
    if (f.plate) { ctx.fillStyle = '#FFB6E6'; }
    else { var hw = ctx.measureText(HASHTAG).width; var hg = ctx.createLinearGradient(W / 2 - hw / 2, 0, W / 2 + hw / 2, 0); hg.addColorStop(0, '#6A3DFF'); hg.addColorStop(1, '#FF4DB8'); ctx.fillStyle = hg; }
    ctx.fillText(HASHTAG, W / 2, fy + 180);
    ctx.fillStyle = f.ink; ctx.globalAlpha = 0.85; ctx.font = '500 26px Montserrat, Arial, sans-serif';
    ctx.fillText(TAGLINE, W / 2, fy + 240);
    ctx.restore();
  }

  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('600 40px Poppins'), document.fonts.load('700 56px Poppins'),
      document.fonts.load('500 26px Montserrat'), document.fonts.load('400 16px Montserrat')
    ]).catch(function () {});
  }

  function renderStrip() {
    var f = FRAMES[state.frame];
    var ctx = els.stripCanvas.getContext('2d');
    drawStrip(ctx, f);
    state.stripBlob = null;
    var token = ++state.renderToken;
    try {
      els.stripCanvas.toBlob(function (b) { if (token === state.renderToken) state.stripBlob = b; }, 'image/png');
    } catch (e) { /* se reintenta al guardar */ }
  }

  function buildStoryCanvas() {
    var f = FRAMES[state.frame];
    var c = document.createElement('canvas'); c.width = SW; c.height = SH;
    var ctx = c.getContext('2d');
    ctx.fillStyle = f.storyBg; ctx.fillRect(0, 0, SW, SH);
    var fs = { dot: f.plate ? 'rgba(255,182,230,0.2)' : 'rgba(106,61,255,0.14)', line: f.plate ? 'rgba(255,77,184,0.5)' : '#FFB6E6' };
    for (var gx = 40; gx < SW; gx += 54) for (var gy = 40; gy < SH; gy += 54) {
      var edge = Math.min(gx, SW - gx) < 220 || gy < 200 || gy > SH - 200;
      if (!edge) continue;
      ctx.fillStyle = fs.dot; ctx.beginPath(); ctx.arc(gx, gy, 3, 0, Math.PI * 2); ctx.fill();
    }
    circuit(ctx, 0, 120, 1, fs); circuit(ctx, SW, SH - 220, -1, fs);
    sparkle(ctx, 120, 400, 20, f.plate ? '#FFB6E6' : '#FF4DB8'); sparkle(ctx, SW - 110, 640, 26, f.plate ? '#FFB6E6' : '#6A3DFF');

    var sc = (SH - STORY_TOP - STORY_BOTTOM) / H;
    var sw = W * sc, sx = (SW - sw) / 2, sy = STORY_TOP, rad = 40;
    if (!f.plate) { ctx.save(); ctx.shadowColor = 'rgba(27,29,79,0.28)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18; ctx.fillStyle = '#fff'; rr(ctx, sx, sy, sw, H * sc, rad); ctx.fill(); ctx.restore(); }
    ctx.save();
    rr(ctx, sx, sy, sw, H * sc, rad); ctx.clip();
    ctx.translate(sx, sy); ctx.scale(sc, sc);
    drawStrip(ctx, f);
    ctx.restore();
    ctx.save(); ctx.lineWidth = 5; ctx.strokeStyle = f.plate ? '#FFB6E6' : 'rgba(106,61,255,0.45)'; rr(ctx, sx, sy, sw, H * sc, rad); ctx.stroke(); ctx.restore();
    return c;
  }

  // ---------- Recorte sin deformar ----------
  function coverCrop(sw, sh, focusY) {
    var cw, ch, cx, cy;
    if (sw / sh > ASPECT) { ch = sh; cw = ch * ASPECT; cx = (sw - cw) / 2; cy = 0; }
    else { cw = sw; ch = cw / ASPECT; cx = 0; cy = (sh - ch) * focusY; }
    return { x: cx, y: cy, w: cw, h: ch };
  }
  function makePhoto(source, sw, sh, mirror, focusY) {
    var r = coverCrop(sw, sh, focusY);
    var ow = Math.min(Math.round(r.w), PW * 2), oh = Math.round(ow / ASPECT);
    var c = document.createElement('canvas'); c.width = ow; c.height = oh;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    if (mirror) { ctx.translate(ow, 0); ctx.scale(-1, 1); }
    ctx.drawImage(source, r.x, r.y, r.w, r.h, 0, 0, ow, oh);
    return c;
  }
  function releasePhotos() {
    state.photos.forEach(function (c) { c.width = 0; c.height = 0; });
    state.photos = [];
    Array.prototype.forEach.call(els.thumbs.children, function (t) { t.style.backgroundImage = ''; t.classList.remove('has'); });
  }
  function setThumb(i, canvas) {
    var t = document.createElement('canvas'); t.width = 112; t.height = Math.round(112 / ASPECT);
    t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
    els.thumbs.children[i].style.backgroundImage = 'url(' + t.toDataURL('image/jpeg', 0.6) + ')';
    els.thumbs.children[i].classList.add('has');
  }

  // ---------- Cámara ----------
  function stopCamera() {
    if (state.stream) { state.stream.getTracks().forEach(function (t) { t.stop(); }); state.stream = null; }
    els.video.srcObject = null;
  }
  function cameraErrorMessage(err) {
    var n = err && err.name;
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError')
      return 'No tenemos permiso para usar la cámara. Activala en los ajustes del sitio de tu navegador (ícono de candado o «Ajustes del sitio») y volvé a tocar «Abrir cámara». También podés elegir 3 fotos de tu galería.';
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError')
      return 'No encontramos una cámara en este dispositivo. Podés elegir 3 fotos de tu galería.';
    if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError')
      return 'La cámara está siendo usada por otra app o pestaña. Cerrala y volvé a intentar, o elegí 3 fotos de tu galería.';
    return 'No pudimos abrir la cámara. ' + (isInApp() ? 'Abrí este enlace en Safari o Chrome. ' : '') + 'También podés elegir 3 fotos de tu galería.';
  }
  function startCamera() {
    setError('');
    if (!cameraSupported()) {
      setError(isInApp()
        ? 'Este navegador integrado no permite usar la cámara. Abrí el enlace en Safari o Chrome, o elegí 3 fotos de tu galería.'
        : 'Este navegador no permite usar la cámara (se necesita una conexión segura HTTPS). Elegí 3 fotos de tu galería.');
      return Promise.resolve(false);
    }
    var base = { audio: false };
    var wanted = Object.assign({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } } }, base);
    return navigator.mediaDevices.getUserMedia(wanted).catch(function (err) {
      if (err && err.name === 'OverconstrainedError') return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      throw err;
    }).then(function (stream) {
      state.stream = stream;
      els.video.srcObject = stream;
      show('camera');
      return els.video.play().catch(function () {}).then(function () { return true; });
    }).catch(function (err) {
      stopCamera(); show('welcome'); setError(cameraErrorMessage(err)); return false;
    });
  }

  function setShooting(on) {
    state.busy = on;
    els.btnShoot.hidden = on; els.btnShoot.disabled = on;
    els.btnCancelShoot.hidden = !on;
    els.btnExitCamera.hidden = on;
    els.shotLabel.classList.toggle('on', on);
    els.camHint.hidden = on;
    if (!on) { els.count.textContent = ''; els.shotLabel.textContent = ''; }
  }
  function cancelSequence() {
    state.runId++;
    if (wake) wake();
    releasePhotos();
    setShooting(false);
    els.liveRegion.textContent = '';
  }
  function waitForVideo() {
    var v = els.video, tries = 0;
    return new Promise(function (resolve) {
      (function check() { if (v.videoWidth > 0 && v.readyState >= 2) return resolve(true); if (++tries > 50) return resolve(false); setTimeout(check, 100); })();
    });
  }
  function runSequence() {
    if (state.busy) return;
    var id = ++state.runId;
    releasePhotos();
    setShooting(true);
    waitForVideo().then(function (ok) {
      if (id !== state.runId) return;
      if (!ok) { setShooting(false); stopCamera(); show('welcome'); setError('La cámara no entregó imagen. Probá de nuevo o elegí fotos de tu galería.'); return; }
      return (function next(i) {
        if (i === 3) return finishCapture(id);
        els.shotLabel.textContent = 'Foto ' + (i + 1) + ' de 3';
        els.liveRegion.textContent = 'Foto ' + (i + 1) + ' de 3';
        return countdown(id).then(function (alive) {
          if (!alive) return;
          var v = els.video;
          state.photos.push(makePhoto(v, v.videoWidth, v.videoHeight, true, 0.5));
          setThumb(i, state.photos[i]);
          els.flash.classList.remove('go'); void els.flash.offsetWidth; els.flash.classList.add('go');
          return sleep(750).then(function () { if (id !== state.runId) return; return next(i + 1); });
        });
      })(0);
    });
  }
  function countdown(id) {
    var n = 3;
    return (function step() {
      if (id !== state.runId) return Promise.resolve(false);
      if (n === 0) { els.count.textContent = ''; return Promise.resolve(true); }
      els.count.textContent = String(n);
      els.count.classList.remove('tick'); void els.count.offsetWidth; els.count.classList.add('tick');
      n--;
      return sleep(1000).then(step);
    })();
  }
  function finishCapture(id) {
    if (id !== state.runId) return;
    setShooting(false);
    stopCamera();
    showResult();
  }

  // ---------- Galería ----------
  function decodeFile(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return viaImg(file); });
    }
    return viaImg(file);
  }
  function viaImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    els.fileInput.value = '';
    if (!files.length) return;
    if (files.length !== 3) { show('welcome'); setError('Elegí exactamente 3 fotos. Seleccionaste ' + files.length + '.'); return; }
    setError(''); els.working.hidden = false;
    var out = [];
    files.reduce(function (p, file) {
      return p.then(function () {
        if (file.type && file.type.indexOf('image/') !== 0) throw new Error('«' + file.name + '» no es una imagen.');
        return decodeFile(file).then(function (img) {
          var w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
          out.push(makePhoto(img, w, h, false, 0.35));
          if (img.close) img.close();
        }, function () {
          throw new Error('No pudimos leer «' + file.name + '». Puede ser un formato no compatible (por ejemplo HEIC en algunos navegadores). Probá con una foto JPG o PNG.');
        });
      });
    }, Promise.resolve()).then(function () {
      releasePhotos(); state.photos = out; els.working.hidden = true; showResult();
    }).catch(function (e) {
      out.forEach(function (c) { c.width = 0; c.height = 0; });
      els.working.hidden = true; show('welcome'); setError(e.message || 'No pudimos procesar las imágenes.');
    });
  }

  // ---------- Resultado ----------
  function syncFrameInputs() {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="frame"],input[name="frame2"]'), function (r) { r.checked = r.value === state.frame; });
  }
  function showResult() {
    setStatus('');
    syncFrameInputs();
    show('result');
    fontsReady().then(renderStrip);
  }
  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      try { canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('blob')); }, 'image/png'); }
      catch (e) { reject(e); }
    });
  }
  function stripBlob() { return state.stripBlob ? Promise.resolve(state.stripBlob) : toBlob(els.stripCanvas); }
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 5000);
  }
  function exportError(e) {
    setStatus(location.protocol === 'file:'
      ? 'Para guardar la imagen hay que abrir la cabina desde un servidor web (no desde un archivo local).'
      : 'No pudimos generar la imagen. Probá de nuevo.');
    els.resultStatus.classList.add('error');
  }
  function onSaveStrip() {
    els.resultStatus.classList.remove('error');
    stripBlob().then(function (b) { download(b, 'she-ia-tira.png'); setStatus('Tira guardada (900 × 2400 px). Revisá tus descargas o fotos.'); }).catch(exportError);
  }
  function onSaveStory() {
    els.resultStatus.classList.remove('error');
    toBlob(buildStoryCanvas()).then(function (b) { download(b, 'she-ia-historia.png'); setStatus('Imagen para historias guardada (1080 × 1920 px).'); }).catch(exportError);
  }
  function onShare() {
    els.resultStatus.classList.remove('error');
    stripBlob().then(function (b) {
      var file = new File([b], 'she-ia-tira.png', { type: 'image/png' });
      var data = { files: [file], title: 'SHE IA', text: 'Mi momento en ' + HASHTAG };
      if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
        return navigator.share(data).then(function () { setStatus('¡Listo!'); }, function (e) {
          if (e && e.name === 'AbortError') return;
          download(b, 'she-ia-tira.png'); setStatus('No se pudo abrir «Compartir». Descargamos la tira para que la compartas desde tus fotos.');
        });
      }
      download(b, 'she-ia-tira.png');
      setStatus('Este navegador no permite compartir directamente. Descargamos la tira para que la compartas desde tus fotos.');
    }).catch(exportError);
  }

  function restart() {
    cancelSequence();
    stopCamera();
    state.renderToken++; state.stripBlob = null;
    var c = els.stripCanvas; c.getContext('2d').clearRect(0, 0, W, H);
    setStatus(''); setError('');
    show('welcome');
  }

  // ---------- Eventos ----------
  function onFrameChange(e) {
    if (!FRAMES[e.target.value]) return;
    state.frame = e.target.value; syncFrameInputs();
    if (state.screen === 'result') renderStrip();
  }
  Array.prototype.forEach.call(document.querySelectorAll('input[name="frame"],input[name="frame2"]'), function (r) { r.addEventListener('change', onFrameChange); });

  els.btnOpenCamera.addEventListener('click', function () { els.btnOpenCamera.disabled = true; startCamera().then(function () { els.btnOpenCamera.disabled = false; }); });
  els.btnGallery.addEventListener('click', function () { els.fileInput.click(); });
  els.fileInput.addEventListener('change', function () { handleFiles(els.fileInput.files); });
  els.btnShoot.addEventListener('click', runSequence);
  els.btnCancelShoot.addEventListener('click', cancelSequence);
  els.btnExitCamera.addEventListener('click', function () { if (state.busy) return; stopCamera(); show('welcome'); });
  els.btnSaveStrip.addEventListener('click', onSaveStrip);
  els.btnSaveStory.addEventListener('click', onSaveStory);
  els.btnShare.addEventListener('click', onShare);
  els.btnRestart.addEventListener('click', restart);
  els.btnCopyLink.addEventListener('click', function () {
    var done = function () { els.btnCopyLink.textContent = 'Enlace copiado'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).then(done, function () { window.prompt('Copiá este enlace:', location.href); });
    else window.prompt('Copiá este enlace:', location.href);
  });

  // Liberar cámara y fotos al salir o ocultar la pestaña
  window.addEventListener('pagehide', function () { cancelSequence(); stopCamera(); releasePhotos(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (state.screen === 'camera') { cancelSequence(); stopCamera(); }
    } else if (state.screen === 'camera' && !state.stream) {
      startCamera();
    }
  });

  // ---------- Inicio ----------
  if (isInApp()) els.inAppNotice.hidden = false;
  if (!cameraSupported()) {
    els.noCameraNotice.hidden = false;
    els.noCameraText.textContent = isInApp() ? 'Abrí el enlace en Safari o Chrome, o elegí 3 fotos de tu galería.' : 'Se necesita HTTPS y un navegador compatible. Podés elegir 3 fotos de tu galería.';
    els.btnOpenCamera.disabled = true;
  }
  loadLogo();
})();
