(function () {
'use strict';

/* ── storage fallback ── */
var _mem = {};
var _store = null;
try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); _store = localStorage; }
catch(e) { try { sessionStorage.setItem('__t', '1'); sessionStorage.removeItem('__t'); _store = sessionStorage; } catch(e2) {} }

function sGet(k) { if (_store) try { var v = _store.getItem(k); if (v !== null) return v; } catch(e) {} return _mem[k] !== undefined ? _mem[k] : null; }
function sSet(k, v) { if (_store) try { _store.setItem(k, v); } catch(e) {} _mem[k] = v; }
function sRemove(k) { if (_store) try { _store.removeItem(k); } catch(e) {} delete _mem[k]; }
function getJSON(k) { try { var v = sGet(k); return v ? JSON.parse(v) : null; } catch(e) { return null; } }
function setJSON(k, v) { try { sSet(k, JSON.stringify(v)); return true; } catch(e) { return false; } }

/* ── config ── */
var API_URL = 'https://event.glent7498.workers.dev';
var FALLBACK_AVATAR = 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg';
var API_TIMEOUT = 10000;
var MAX_RETRIES = 3;
var RETRY_DELAY = 800;

var _ratestamps = [];
var _lastToastKey = '';
var _lastToastTime = 0;

var RATE_WINDOW = 10000;
var RATE_MAX = 60;

function checkRate() {
    var now = Date.now();
    _ratestamps = _ratestamps.filter(function(t) { return now - t < RATE_WINDOW; });
    if (_ratestamps.length >= RATE_MAX) return false;
    _ratestamps.push(now);
    return true;
}

var STORAGE_KEYS = {
    session:    'ut_session',
    background: 'ut_bg',
    theme:      'ut_theme',
    visual:     'ut_visual',
    bgLoaded:   'ut_bg_loaded',
    avatars:    'ut_avatars'
};

var SENIOR_ROLES = ['Глава ивентов', 'Зам главы ивентов', 'Старший ивентер'];
var JUNIOR_ROLES = ['Ивентер'];
var EDITOR_ROLES = ['DEV', 'Глава ивентов', 'Зам главы ивентов', 'Старший ивентер'];
var HEAD_ROLES   = ['DEV', 'Глава ивентов', 'Зам главы ивентов'];

var BG_OPTIONS = [
    { id: 'bg1',  name: 'Фон 01', url: 'https://i.imgur.com/MpiTIPp.jpeg' },
    { id: 'bg2',  name: 'Фон 02', url: 'https://i.imgur.com/5251qqI.jpeg' },
    { id: 'bg3',  name: 'Фон 03', url: 'https://i.imgur.com/aO0bW5Y.jpeg' },
    { id: 'bg4',  name: 'Фон 04', url: 'https://i.imgur.com/HN4JFFC.png'  },
    { id: 'bg5',  name: 'Фон 05', url: 'https://i.imgur.com/xp9Z6zO.jpeg' },
    { id: 'bg6',  name: 'Фон 06', url: 'https://i.imgur.com/5xGFarZ.png'  },
    { id: 'bg7',  name: 'Фон 07', url: 'https://i.imgur.com/yQNtpSg.png'  },
    { id: 'bg8',  name: 'Фон 08', url: 'https://i.imgur.com/CRxWtSo.png'  },
    { id: 'bg9',  name: 'Фон 09', url: 'https://i.imgur.com/zHl4soe.jpeg' },
    { id: 'bg10', name: 'Фон 10', url: 'https://i.imgur.com/dPp05Jv.png'  },
    { id: 'bg11', name: 'Фон 11', url: 'https://i.imgur.com/l0g01tN.png'  },
    { id: 'bg12', name: 'Фон 12', url: 'https://i.imgur.com/iR8AZ8j.png'  }
];

var DEFAULT_VISUAL_SETTINGS = {
    brightness: 100,
    contrast: 100,
    saturate: 100,
    overlay: 65,
    glassBlur: 20,
    bgBlur: 2,
    animationsEnabled: true,
    compactMode: false,
    navPosition: 'top',
    backgroundEffect: 'none'
};
var _bgLoading = {};

function clamp(num, min, max) { return Math.max(min, Math.min(max, num)); }
function getVisualSettings() {
    var raw = getJSON(STORAGE_KEYS.visual) || {};
    var navPosition = raw.navPosition === 'bottom' ? 'bottom' : DEFAULT_VISUAL_SETTINGS.navPosition;
    var backgroundEffect = raw.backgroundEffect === 'particles' ? 'particles' : DEFAULT_VISUAL_SETTINGS.backgroundEffect;
    return {
        brightness: clamp(parseInt(raw.brightness, 10) || DEFAULT_VISUAL_SETTINGS.brightness, 70, 160),
        contrast: clamp(parseInt(raw.contrast, 10) || DEFAULT_VISUAL_SETTINGS.contrast, 70, 170),
        saturate: clamp(parseInt(raw.saturate, 10) || DEFAULT_VISUAL_SETTINGS.saturate, 50, 200),
        overlay: clamp(parseInt(raw.overlay, 10) || DEFAULT_VISUAL_SETTINGS.overlay, 20, 90),
        glassBlur: clamp(parseInt(raw.glassBlur, 10) || DEFAULT_VISUAL_SETTINGS.glassBlur, 0, 32),
        bgBlur: clamp(parseInt(raw.bgBlur, 10) || DEFAULT_VISUAL_SETTINGS.bgBlur, 0, 12),
        animationsEnabled: raw.animationsEnabled !== false,
        compactMode: raw.compactMode === true,
        navPosition: navPosition,
        backgroundEffect: backgroundEffect
    };
}
function saveVisualSettings(settings) { setJSON(STORAGE_KEYS.visual, settings); }
function patchVisualSettings(patch) {
    var next = Object.assign({}, getVisualSettings(), patch || {});
    saveVisualSettings(next);
    applyVisualSettings(next);
    syncVisualControls(next);
}
function getLoadedBackgrounds() {
    var loaded = getJSON(STORAGE_KEYS.bgLoaded);
    if (!Array.isArray(loaded) || !loaded.length) return [BG_OPTIONS[0].id];
    if (loaded.indexOf(BG_OPTIONS[0].id) === -1) loaded.unshift(BG_OPTIONS[0].id);
    return loaded.filter(function(id, index, arr) { return arr.indexOf(id) === index; });
}
function saveLoadedBackgrounds(list) {
    var uniq = Array.isArray(list) ? list.filter(function(id, index, arr) { return !!id && arr.indexOf(id) === index; }) : [];
    if (uniq.indexOf(BG_OPTIONS[0].id) === -1) uniq.unshift(BG_OPTIONS[0].id);
    setJSON(STORAGE_KEYS.bgLoaded, uniq);
}
function isBgLoaded(id) { return getLoadedBackgrounds().indexOf(id) > -1; }
function markBgLoaded(id) {
    var loaded = getLoadedBackgrounds();
    if (loaded.indexOf(id) === -1) { loaded.push(id); saveLoadedBackgrounds(loaded); }
}
function applyVisualSettings(settings) {
    settings = settings || getVisualSettings();
    var root = document.documentElement;
    root.style.setProperty('--bg-image-filter', 'brightness(' + (settings.brightness / 100).toFixed(2) + ') contrast(' + (settings.contrast / 100).toFixed(2) + ') saturate(' + (settings.saturate / 100).toFixed(2) + ')');
    root.style.setProperty('--bg-overlay-opacity', (settings.overlay / 100).toFixed(2));
    root.style.setProperty('--glass-blur', 'blur(' + settings.glassBlur + 'px) saturate(1.8)');
    root.style.setProperty('--bg-overlay-blur', 'blur(' + settings.bgBlur + 'px)');
    document.body.classList.toggle('compact-ui', !!settings.compactMode);
    document.body.classList.toggle('reduced-motion', !settings.animationsEnabled);
    document.body.classList.toggle('nav-bottom', settings.navPosition === 'bottom');
    document.body.classList.toggle('nav-top', settings.navPosition !== 'bottom');
    initBackgroundEffect(settings);
}
function syncVisualControls(settings) {
    settings = settings || getVisualSettings();
    var map = [
        ['visual-brightness', settings.brightness, 'visual-brightness-value', settings.brightness + '%'],
        ['visual-contrast', settings.contrast, 'visual-contrast-value', settings.contrast + '%'],
        ['visual-saturate', settings.saturate, 'visual-saturate-value', settings.saturate + '%'],
        ['visual-overlay', settings.overlay, 'visual-overlay-value', settings.overlay + '%'],
        ['visual-glass-blur', settings.glassBlur, 'visual-glass-blur-value', settings.glassBlur + 'px'],
        ['visual-bg-blur', settings.bgBlur, 'visual-bg-blur-value', settings.bgBlur + 'px']
    ];
    map.forEach(function(item) {
        var input = document.getElementById(item[0]), out = document.getElementById(item[2]);
        if (input) input.value = item[1];
        if (out) out.textContent = item[3];
    });
    var anim = document.getElementById('visual-animations-enabled'), compact = document.getElementById('visual-compact-mode');
    if (anim) anim.checked = !!settings.animationsEnabled;
    if (compact) compact.checked = !!settings.compactMode;
    var navPos = document.getElementById('visual-nav-position'), bgEffect = document.getElementById('visual-bg-effect');
    if (navPos) navPos.value = settings.navPosition;
    if (bgEffect) bgEffect.value = settings.backgroundEffect;
}
function bindVisualSettings() {
    [
        ['visual-brightness', 'brightness'],
        ['visual-contrast', 'contrast'],
        ['visual-saturate', 'saturate'],
        ['visual-overlay', 'overlay'],
        ['visual-glass-blur', 'glassBlur'],
        ['visual-bg-blur', 'bgBlur']
    ].forEach(function(item) {
        var el = document.getElementById(item[0]);
        if (!el || el.dataset.bound === '1') return;
        el.dataset.bound = '1';
        el.addEventListener('input', function() {
            var patch = {}; patch[item[1]] = parseInt(el.value, 10) || DEFAULT_VISUAL_SETTINGS[item[1]];
            patchVisualSettings(patch);
        });
    });
    [['visual-animations-enabled', 'animationsEnabled'], ['visual-compact-mode', 'compactMode']].forEach(function(item) {
        var el = document.getElementById(item[0]);
        if (!el || el.dataset.bound === '1') return;
        el.dataset.bound = '1';
        el.addEventListener('change', function() {
            var patch = {}; patch[item[1]] = !!el.checked; patchVisualSettings(patch);
        });
    });
    [['visual-nav-position', 'navPosition'], ['visual-bg-effect', 'backgroundEffect']].forEach(function(item) {
        var el = document.getElementById(item[0]);
        if (!el || el.dataset.bound === '1') return;
        el.dataset.bound = '1';
        el.addEventListener('change', function() {
            var patch = {}; patch[item[1]] = el.value || DEFAULT_VISUAL_SETTINGS[item[1]]; patchVisualSettings(patch);
        });
    });
    var btnColor = document.getElementById('visual-reset-color');
    if (btnColor && btnColor.dataset.bound !== '1') {
        btnColor.dataset.bound = '1';
        btnColor.addEventListener('click', function() {
            patchVisualSettings({ brightness: DEFAULT_VISUAL_SETTINGS.brightness, contrast: DEFAULT_VISUAL_SETTINGS.contrast, saturate: DEFAULT_VISUAL_SETTINGS.saturate, overlay: DEFAULT_VISUAL_SETTINGS.overlay });
            showToast('Цветокоррекция сброшена', 'success');
        });
    }
    var btnEffects = document.getElementById('visual-reset-effects');
    if (btnEffects && btnEffects.dataset.bound !== '1') {
        btnEffects.dataset.bound = '1';
        btnEffects.addEventListener('click', function() {
            patchVisualSettings({ glassBlur: DEFAULT_VISUAL_SETTINGS.glassBlur, bgBlur: DEFAULT_VISUAL_SETTINGS.bgBlur });
            showToast('Эффекты сброшены', 'success');
        });
    }
    var btnAll = document.getElementById('visual-reset-all');
    if (btnAll && btnAll.dataset.bound !== '1') {
        btnAll.dataset.bound = '1';
        btnAll.addEventListener('click', function() {
            saveVisualSettings(DEFAULT_VISUAL_SETTINGS);
            applyVisualSettings(DEFAULT_VISUAL_SETTINGS);
            syncVisualControls(DEFAULT_VISUAL_SETTINGS);
            renderBgGrid();
            showToast('Визуальные настройки сброшены', 'success');
        });
    }
}

var _bgEffectState = { mode: 'none', raf: 0, resizeBound: false, dots: [] };

function initBackgroundEffect(settings) {
    settings = settings || getVisualSettings();
    var canvas = document.getElementById('app-bg-effect');
    if (!canvas) return;
    var useParticles = settings.backgroundEffect === 'particles' && settings.animationsEnabled;
    document.body.classList.toggle('bg-effect-particles', useParticles);
    if (!useParticles) {
        stopBackgroundEffect();
        return;
    }
    startParticleBackground(canvas);
}

function stopBackgroundEffect() {
    if (_bgEffectState.raf) cancelAnimationFrame(_bgEffectState.raf);
    _bgEffectState.raf = 0;
    _bgEffectState.mode = 'none';
    var canvas = document.getElementById('app-bg-effect');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function startParticleBackground(canvas) {
    if (_bgEffectState.mode === 'particles') return;
    _bgEffectState.mode = 'particles';
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
        var dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        seedDots();
    }

    function seedDots() {
        var area = window.innerWidth * window.innerHeight;
        var count = Math.max(18, Math.min(48, Math.round(area / 42000)));
        _bgEffectState.dots = [];
        for (var i = 0; i < count; i++) {
            _bgEffectState.dots.push(makeDot());
        }
    }

    function makeDot() {
        var speed = 0.25 + Math.random() * 0.7;
        return {
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * speed,
            vy: (Math.random() - 0.5) * speed,
            r: 1.4 + Math.random() * 2.8,
            life: 80 + Math.random() * 140,
            burst: 0
        };
    }

    function rgb() {
        var raw = getComputedStyle(document.documentElement).getPropertyValue('--particle-rgb').trim() || '255,74,74';
        var parts = raw.split(',').map(function(v) { return Math.max(0, Math.min(255, parseInt(v, 10) || 0)); });
        while (parts.length < 3) parts.push(74);
        return parts;
    }

    function frame() {
        if (_bgEffectState.mode !== 'particles') return;
        if (!getVisualSettings().animationsEnabled || getVisualSettings().backgroundEffect !== 'particles') {
            stopBackgroundEffect();
            document.body.classList.remove('bg-effect-particles');
            return;
        }
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        var color = rgb();
        var dots = _bgEffectState.dots;
        for (var i = 0; i < dots.length; i++) {
            var d = dots[i];
            d.x += d.vx;
            d.y += d.vy;
            d.life -= 1;
            if (d.x < -10 || d.x > window.innerWidth + 10) d.vx *= -1;
            if (d.y < -10 || d.y > window.innerHeight + 10) d.vy *= -1;
            if (d.life <= 0) dots[i] = d = makeDot();
            for (var j = i + 1; j < dots.length; j++) {
                var o = dots[j];
                var dx = o.x - d.x, dy = o.y - d.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 130) {
                    var alpha = 0.18 * (1 - dist / 130);
                    ctx.strokeStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + alpha.toFixed(3) + ')';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(d.x, d.y);
                    ctx.lineTo(o.x, o.y);
                    ctx.stroke();
                }
                if (dist < d.r + o.r + 2) {
                    d.vx *= -1; d.vy *= -1; o.vx *= -1; o.vy *= -1;
                    d.burst = 8; o.burst = 8;
                }
            }
        }
        dots.forEach(function(d) {
            var burstAdd = d.burst > 0 ? d.burst * 0.35 : 0;
            if (d.burst > 0) d.burst -= 1;
            ctx.fillStyle = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + (0.45 + Math.min(0.35, d.r / 10)).toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r + burstAdd, 0, Math.PI * 2);
            ctx.fill();
        });
        _bgEffectState.raf = requestAnimationFrame(frame);
    }

    if (!_bgEffectState.resizeBound) {
        window.addEventListener('resize', resize);
        _bgEffectState.resizeBound = true;
    }
    resize();
    frame();
}

/* ══════════════════════════════════════════════
   THEME SYSTEM
   ══════════════════════════════════════════════ */

var THEME_PRESETS = [
    {
        id: 'odrp1', name: 'ОДРП 1',
        icon: 'https://cdn.discordapp.com/emojis/1302688142628753505.webp?size=48&name=drp_1%7E1&lossless=true',
        colors: {
            background:[15,29,46], primary:[31,52,77], secondary:[28,39,53], tertiary:[27,45,68],
            accent:[33,151,255], lightAccent:[121,196,255], negative:[227,119,119],
            gradStart:[33,151,255], gradEnd:[18,67,102],
            textPrimary:[230,238,248], textSecondary:[160,185,210], textMuted:[100,125,155]
        }
    },
    {
        id: 'odrp2', name: 'ОДРП 2',
        icon: 'https://cdn.discordapp.com/emojis/1302688514084966514.webp?size=48&name=drp_2%7E1&lossless=true',
        colors: {
            background:[15,29,46], primary:[31,52,77], secondary:[28,39,53], tertiary:[27,45,68],
            accent:[33,151,255], lightAccent:[121,196,255], negative:[227,119,119],
            gradStart:[33,151,255], gradEnd:[18,67,102],
            textPrimary:[230,238,248], textSecondary:[160,185,210], textMuted:[100,125,155]
        }
    },
    {
        id: 'odrp3', name: 'ОДРП 3',
        icon: 'https://cdn.discordapp.com/emojis/1302688567608479744.webp?size=48&name=drp_3%7E1&lossless=true',
        colors: {
            background:[37,12,12], primary:[77,31,31], secondary:[53,28,28], tertiary:[68,27,27],
            accent:[255,74,74], lightAccent:[255,107,107], negative:[102,102,102],
            gradStart:[158,53,53], gradEnd:[115,36,36],
            textPrimary:[245,234,234], textSecondary:[194,168,168], textMuted:[138,111,111]
        }
    },
    {
        id: 'odrp4', name: 'ОДРП 4',
        icon: 'https://cdn.discordapp.com/emojis/1267817669823041660.webp?size=48&name=drp4&lossless=true',
        colors: {
            background:[22,22,22], primary:[40,40,40], secondary:[48,48,48], tertiary:[56,56,56],
            accent:[117,117,117], lightAccent:[160,160,160], negative:[207,62,62],
            gradStart:[124,124,124], gradEnd:[90,90,90],
            textPrimary:[240,235,235], textSecondary:[180,170,170], textMuted:[120,115,115]
        }
    },
    {
        id: 'odrp5', name: 'ОДРП 5',
        icon: 'https://cdn.discordapp.com/emojis/1304180297008680990.webp?size=48&name=drp_5&lossless=true',
        colors: {
            background:[15,29,46], primary:[31,52,77], secondary:[28,39,53], tertiary:[27,45,68],
            accent:[227,158,34], lightAccent:[255,208,121], negative:[227,119,119],
            gradStart:[18,67,102], gradEnd:[20,35,58],
            textPrimary:[235,230,215], textSecondary:[180,168,140], textMuted:[120,112,90]
        }
    },
    {
        id: 'odrp6', name: 'ОДРП 6',
        icon: 'https://cdn.discordapp.com/emojis/1385202254855798928.webp?size=48&name=drp_6&lossless=true',
        colors: {
            background:[21,23,29], primary:[29,32,40], secondary:[23,25,31], tertiary:[37,40,49],
            accent:[234,83,76], lightAccent:[255,130,124], negative:[227,119,119],
            gradStart:[53,99,158], gradEnd:[36,71,115],
            textPrimary:[230,232,238], textSecondary:[170,175,190], textMuted:[110,115,130]
        }
    }
];

function tRgb(arr) { return 'rgb(' + arr[0] + ',' + arr[1] + ',' + arr[2] + ')'; }
function tRgba(arr, a) { return 'rgba(' + arr[0] + ',' + arr[1] + ',' + arr[2] + ',' + a + ')'; }
function tHex(arr) {
    return '#' + arr.map(function(v) {
        var h = Math.max(0, Math.min(255, Math.round(v))).toString(16);
        return h.length === 1 ? '0' + h : h;
    }).join('');
}

function getSavedTheme() {
    var id = sGet(STORAGE_KEYS.theme);
    for (var i = 0; i < THEME_PRESETS.length; i++) { if (THEME_PRESETS[i].id === id) return id; }
    return 'odrp3';
}

function applyTheme(id, doSave) {
    var preset = null;
    for (var i = 0; i < THEME_PRESETS.length; i++) { if (THEME_PRESETS[i].id === id) { preset = THEME_PRESETS[i]; break; } }
    if (!preset) preset = THEME_PRESETS[0];
    var c = preset.colors, r = document.documentElement;
    if (doSave) sSet(STORAGE_KEYS.theme, preset.id);

    r.style.setProperty('--bg-primary',         tHex(c.background));
    r.style.setProperty('--bg-card',            tRgba(c.primary,   0.65));
    r.style.setProperty('--bg-glass',           tRgba(c.tertiary,  0.40));
    r.style.setProperty('--border-glass',       tRgba(c.accent,    0.15));
    r.style.setProperty('--border-glass-hover', tRgba(c.accent,    0.35));
    r.style.setProperty('--red-300', tRgb(c.lightAccent));
    r.style.setProperty('--red-400', tRgb(c.accent));
    r.style.setProperty('--red-500', tRgb(c.accent));
    r.style.setProperty('--red-600', tRgb(c.gradStart));
    r.style.setProperty('--red-700', tRgb(c.gradEnd));
    r.style.setProperty('--red-800', tRgb(c.secondary));
    r.style.setProperty('--red-900', tRgb(c.background));
    r.style.setProperty('--accent',       tRgb(c.accent));
    r.style.setProperty('--accent-hover', tRgb(c.lightAccent));
    r.style.setProperty('--danger',       tRgb(c.accent));
    r.style.setProperty('--info',         tRgb(c.gradStart));
    r.style.setProperty('--text-primary',   tRgb(c.textPrimary));
    r.style.setProperty('--text-secondary', tRgb(c.textSecondary));
    r.style.setProperty('--text-muted',     tRgb(c.textMuted));
    r.style.setProperty('--shadow-glow', '0 0 30px ' + tRgba(c.accent, 0.25));
    r.style.setProperty('--gradient-primary', 'linear-gradient(135deg,' + tRgb(c.gradStart) + ' 0%,' + tRgb(c.gradEnd) + ' 100%)');
    r.style.setProperty('--surface-soft', tRgba(c.secondary, 0.22));
    r.style.setProperty('--surface-soft-2', tRgba(c.primary, 0.35));
    r.style.setProperty('--surface-strong', tRgba(c.tertiary, 0.62));
    r.style.setProperty('--line-soft', tRgba(c.textPrimary, 0.06));
    r.style.setProperty('--line-mid', tRgba(c.textPrimary, 0.1));
    r.style.setProperty('--accent-soft', tRgba(c.accent, 0.14));
    r.style.setProperty('--accent-strong', tRgba(c.accent, 0.3));
    r.style.setProperty('--overlay-scene-top', tRgba(c.background, 0.55));
    r.style.setProperty('--overlay-scene-mid', tRgba(c.secondary, 0.6));
    r.style.setProperty('--overlay-scene-bottom', tRgba(c.tertiary, 0.76));
    r.style.setProperty('--overlay-scene-glow', tRgba(c.accent, 0.18));
    r.style.setProperty('--particle-rgb', c.accent.join(','));
    r.style.setProperty('--brand-filter', 'drop-shadow(0 0 10px ' + tRgba(c.accent, 0.45) + ')');
    r.style.setProperty('--brand-filter-hover', 'drop-shadow(0 0 14px ' + tRgba(c.lightAccent, 0.6) + ')');
    r.style.setProperty('--top-bar-bg', tRgba(c.secondary, 0.72));

    $$('.theme-option').forEach(function(el) {
        var isActive = el.dataset.themeId === preset.id;
        el.classList.toggle('active', isActive);
        var badge = el.querySelector('.theme-badge');
        if (badge) badge.textContent = isActive ? 'ON' : 'SET';
    });
}

var _themeGridCleanup = null;
function renderThemeGrid() {
    var grid = $('#theme-grid');
    if (!grid) return;
    var selected = getSavedTheme();
    grid.innerHTML = THEME_PRESETS.map(function(theme) {
        var c = theme.colors;
        var isActive = selected === theme.id;
        var iconUrl = theme.icon || 'https://i.imgur.com/Mh98NZ5.png';
        var previewStyle = 'background:radial-gradient(circle at 18% 22%,' + tRgba(c.lightAccent, 0.18) + ' 0%,transparent 30%),radial-gradient(circle at 82% 78%,' + tRgba(c.accent, 0.14) + ' 0%,transparent 28%),linear-gradient(135deg,' + tRgb(c.gradStart) + ' 0%,' + tRgb(c.gradEnd) + ' 60%,' + tRgb(c.background) + ' 100%);';
        var circleStyle = 'background:' + tRgba(c.accent, 0.20) + ';border:2px solid ' + tRgba(c.accent, 0.70) + ';box-shadow:0 0 16px ' + tRgba(c.accent, 0.35) + ',inset 0 1px 0 rgba(255,255,255,0.08);';
        return '<button type="button" class="theme-option' + (isActive ? ' active' : '') + '" data-theme-id="' + theme.id + '">' +
            '<div class="theme-preview" style="' + previewStyle + '"><div class="theme-preview-center"><div class="theme-preview-circle" style="' + circleStyle + '"><img src="' + esc(iconUrl) + '" alt="' + esc(theme.name) + '" class="theme-preview-icon" /></div></div></div>' +
            '<div class="theme-swatches"><span class="theme-swatch" style="background:' + tRgb(c.background) + '"></span><span class="theme-swatch" style="background:' + tRgb(c.primary) + '"></span><span class="theme-swatch" style="background:' + tRgb(c.tertiary) + '"></span><span class="theme-swatch" style="background:' + tRgb(c.accent) + '"></span><span class="theme-swatch" style="background:' + tRgb(c.lightAccent) + '"></span></div>' +
            '<div class="theme-meta"><span class="theme-name">' + esc(theme.name) + '</span><span class="theme-badge">' + (isActive ? 'ON' : 'SET') + '</span></div></button>';
    }).join('');
    if (_themeGridCleanup) { _themeGridCleanup(); _themeGridCleanup = null; }
    _themeGridCleanup = delegateClick(grid, '.theme-option', function(e, btn) {
        applyTheme(btn.dataset.themeId, true);
        showToast('Цветокоррекция обновлена', 'success');
    });
}

/* ── event system ── */
var _handlers = {};
function on(evt, fn) { if (!_handlers[evt]) _handlers[evt] = []; _handlers[evt].push(fn); return function() { off(evt, fn); }; }
function off(evt, fn) { var l = _handlers[evt]; if (!l) return; var i = l.indexOf(fn); if (i > -1) l.splice(i, 1); }
function emit(evt, data) { var l = _handlers[evt]; if (!l) return; for (var i = 0; i < l.length; i++) { try { l[i](data); } catch(e) { console.error('event handler error [' + evt + ']:', e); } } }

/* ── html helpers ── */
var _escDiv = null;
function esc(s) {
    if (s == null) return '';
    if (!_escDiv) _escDiv = document.createElement('div');
    _escDiv.textContent = String(s);
    return _escDiv.innerHTML;
}
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function formatDate(d) {
    if (!d) return '—';
    try { var dt = new Date(d); if (isNaN(dt.getTime())) return String(d); function p(n) { return n < 10 ? '0' + n : '' + n; } return p(dt.getDate()) + '.' + p(dt.getMonth()+1) + '.' + dt.getFullYear(); } catch(e) { return String(d); }
}
function formatDateTime(d) {
    if (!d) return '—';
    try { var dt = new Date(d); if (isNaN(dt.getTime())) return String(d); function p(n) { return n < 10 ? '0' + n : '' + n; } return p(dt.getDate()) + '.' + p(dt.getMonth()+1) + '.' + dt.getFullYear() + ' ' + p(dt.getHours()) + ':' + p(dt.getMinutes()); } catch(e) { return String(d); }
}
function getInitials(name) {
    name = (name || '?').trim();
    var parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return (parts[0][0] || '?').toUpperCase();
    return '?';
}
function isNew(dateStr) {
    if (!dateStr) return false;
    try { return (Date.now() - new Date(dateStr).getTime()) < 300000; } catch(e) { return false; }
}
function delegateClick(parent, childSel, handler) {
    if (!parent) return function(){};
    function listener(e) { var t = e.target.closest(childSel); if (t && parent.contains(t)) handler(e, t); }
    parent.addEventListener('click', listener);
    return function() { parent.removeEventListener('click', listener); };
}
function copyToClipboard(text, label) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() { showToast((label || 'Текст') + ' скопирован', 'success'); }).catch(function() { _fallbackCopy(text, label); });
    } else { _fallbackCopy(text, label); }
}
function _fallbackCopy(text, label) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast((label || 'Текст') + ' скопирован', 'success'); } catch(e) { showToast('Не удалось скопировать', 'error'); }
    document.body.removeChild(ta);
}

/* ── SVG Icons ── */
var IC = {
    edit:    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    del:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    eye:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    check:   '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    clock:   '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    x:       '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    login:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>',
    checkLg: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    xLg:     '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    info:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    copy:    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    search:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    filter:  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    dashboard:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    thumbsUp:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
    heart:   '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
};

/* ── app state ── */
var state = {
    user: null,
    events: [],
    staff: [],
    importStaffSource: [],
    canEdit: false,
    currentTab: 'dashboard'
};

/* ── session ── */
function getSession() { return getJSON(STORAGE_KEYS.session); }
function saveSession(data) { setJSON(STORAGE_KEYS.session, data); }
function clearSession() { sRemove(STORAGE_KEYS.session); }

/* ── cache ── */
var _cache = {};
function cacheGet(k) { var e = _cache[k]; if (!e) return null; if (Date.now() - e.t > e.ttl) { delete _cache[k]; return null; } return e.data; }
function cacheSet(k, data, ttl) { _cache[k] = { data: data, t: Date.now(), ttl: ttl }; }
function cacheClear(k) { if (k) delete _cache[k]; else _cache = {}; }

/* ── http ── */
async function _fetch(path, opts, timeout) {
    if (!checkRate()) throw new Error('Rate limit exceeded');
    timeout = timeout || API_TIMEOUT;
    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, timeout);
    try {
        var session = getSession();
        var hdrs = { 'Content-Type': 'application/json' };
        if (session && session.token) hdrs['Authorization'] = 'Bearer ' + session.token;
        var fetchOpts = { method: opts.method || 'GET', headers: hdrs, signal: ctrl.signal };
        if (opts.body) fetchOpts.body = opts.body;
        var res = await fetch(API_URL + path, fetchOpts);
        if (res.status === 401) { emit('auth:expired'); throw new Error('Unauthorized'); }
        var text = await res.text();
        var data;
        try { data = text ? JSON.parse(text) : null; } catch(e) { data = null; }
        if (!res.ok) { throw new Error((data && data.error) ? data.error : 'Server error ' + res.status); }
        return data;
    } catch(err) {
        if (err.name === 'AbortError') throw new Error('Таймаут запроса');
        throw err;
    } finally { clearTimeout(timer); }
}

async function fetchRetry(path, opts, timeout) {
    var lastErr;
    for (var i = 0; i <= MAX_RETRIES; i++) {
        try {
            if (i > 0) console.warn('[RETRY]', path, 'attempt', i + 1);
            return await _fetch(path, opts || {}, timeout);
        } catch(err) {
            lastErr = err;
            if (err.message === 'Unauthorized' || err.message === 'Rate limit exceeded' || err.message === 'Таймаут запроса') throw err;
            if (i < MAX_RETRIES) await new Promise(function(r) { setTimeout(r, RETRY_DELAY * Math.pow(1.5, i)); });
        }
    }
    throw lastErr;
}

var http = {
    get:   function(p)       { return fetchRetry(p, { method: 'GET' }, 20000); },
    post:  function(p, body) { return fetchRetry(p, { method: 'POST',  body: JSON.stringify(body) }, 20000); },
    put:   function(p, body) { return fetchRetry(p, { method: 'PUT',   body: JSON.stringify(body) }, 20000); },
    patch: function(p, body) { return fetchRetry(p, { method: 'PATCH', body: JSON.stringify(body) }, 20000); },
    del:   function(p)       { return fetchRetry(p, { method: 'DELETE' }, 20000); }
};

/* ── toast ── */
function showToast(msg, type, dur) {
    var key = (type || 'info') + ':' + msg;
    var now = Date.now();
    if (key === _lastToastKey && now - _lastToastTime < 4000) return;
    _lastToastKey = key; _lastToastTime = now;
    var container = $('#toast-container');
    if (!container) return;
    dur = dur || 3500; type = type || 'info';
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    var icons = { success: IC.checkLg, error: IC.xLg, info: IC.info };
    el.innerHTML = (icons[type] || icons.info) + '<span>' + esc(msg) + '</span>' + '<div class="toast-progress" style="animation-duration:' + dur + 'ms;"></div>';
    container.appendChild(el);
    setTimeout(function() { el.classList.add('toast-out'); setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 300); }, dur);
}

/* ── preloader ── */
function hidePreloader() { var el = $('#preloader'); if (!el) return; el.classList.add('fade-out'); setTimeout(function() { el.style.display = 'none'; }, 500); }
function setPreloaderStatus(txt) { var el = $('#preloader .preloader-text'); if (el) el.textContent = txt; }

function preloadImages(urls, timeoutMs) {
    timeoutMs = timeoutMs || 4000;
    return Promise.all((urls || []).map(function(url) {
        return new Promise(function(resolve) {
            var done = false;
            var img = new Image();
            var timer = setTimeout(finish, timeoutMs);
            function finish() {
                if (done) return;
                done = true;
                clearTimeout(timer);
                img.onload = null;
                img.onerror = null;
                resolve();
            }
            img.onload = finish;
            img.onerror = finish;
            img.src = url;
        });
    }));
}

/* ── background ── */
function getSavedBg() {
    var id = sGet(STORAGE_KEYS.background);
    var exists = BG_OPTIONS.some(function(b) { return b.id === id; });
    if (!exists) return BG_OPTIONS[0].id;
    return isBgLoaded(id) ? id : BG_OPTIONS[0].id;
}
function applyBg(id, doSave) {
    var bg = BG_OPTIONS.find(function(b) { return b.id === id; }) || BG_OPTIONS[0];
    if (!isBgLoaded(bg.id)) bg = BG_OPTIONS[0];
    markBgLoaded(bg.id);
    if (doSave) sSet(STORAGE_KEYS.background, bg.id);
    var el = $('#app-bg'); if (el) el.style.backgroundImage = 'url("' + bg.url + '")';
    var loginImg = document.getElementById('login-bg-img'); if (loginImg) loginImg.style.backgroundImage = 'url("' + bg.url + '")';
    $$('.bg-option').forEach(function(o) { o.classList.toggle('active', o.dataset.bgId === bg.id); });
    return bg;
}
async function downloadBackground(id) {
    var bg = BG_OPTIONS.find(function(item) { return item.id === id; });
    if (!bg || _bgLoading[id]) return;
    _bgLoading[id] = true;
    renderBgGrid();
    try {
        await preloadImages([bg.url], 5000);
        markBgLoaded(id);
        showToast(bg.name + ' загружен', 'success');
    } catch(e) {
        showToast('Не удалось загрузить фон', 'error');
    }
    delete _bgLoading[id];
    renderBgGrid();
}
function renderBgGrid() {
    var grid = $('#bg-grid'); if (!grid) return;
    var selected = getSavedBg();
    grid.innerHTML = BG_OPTIONS.map(function(bg) {
        var loaded = isBgLoaded(bg.id);
        var loading = !!_bgLoading[bg.id];
        var action = loaded ? '<button type="button" class="bg-option-btn" data-action="select">' + (bg.id === selected ? 'Выбран' : 'Выбрать') + '</button>' : '<button type="button" class="bg-option-btn" data-action="download">' + (loading ? 'Загрузка...' : 'Скачать') + '</button>';
        var status = loaded ? (bg.id === selected ? 'Активен' : 'Загружен') : (loading ? 'Загрузка' : 'Не загружен');
        var media = loaded ? '<img src="' + bg.url + '" alt="' + esc(bg.name) + '" loading="lazy" />' : '<div class="bg-option-placeholder"><span>Превью появится после загрузки</span></div>';
        return '<div class="bg-option ' + (bg.id === selected ? 'active ' : '') + (loaded ? '' : 'bg-locked ') + (loading ? 'bg-loading' : '') + '" data-bg-id="' + bg.id + '">' + media + '<span class="bg-option-status">' + status + '</span><span class="bg-label">' + esc(bg.name) + '</span><div class="bg-option-actions">' + action + '</div><div class="bg-check">' + IC.check + '</div></div>';
    }).join('');
    delegateClick(grid, '.bg-option-btn', function(e, btn) {
        e.preventDefault();
        var card = btn.closest('.bg-option');
        if (!card) return;
        var id = card.dataset.bgId;
        if (btn.dataset.action === 'download') downloadBackground(id);
        if (btn.dataset.action === 'select') { applyBg(id, true); renderBgGrid(); showToast('Фон обновлён', 'success'); }
    });
}

/* ── status helpers ── */
function statusClass(s) { if (s === 'Одобрено') return 'status-approved'; if (s === 'Отказано') return 'status-rejected'; return 'status-pending'; }
function statusIcon(s) { if (s === 'Одобрено') return IC.check; if (s === 'Отказано') return IC.x; return IC.clock; }
function isEditor() { return state.canEdit; }
function isHead() { return state.user && HEAD_ROLES.indexOf(state.user.role) > -1; }

/* ── auth ── */
async function doLogin(username, password) { return await http.post('/api/login', { username: username, password: password }); }
async function verifySession(session) {
    try { var data = await _fetch('/api/session', { method: 'POST', body: JSON.stringify({ token: session.token }) }, 5000); return { ok: true, data: data }; }
    catch(e) { if (e.message === 'Таймаут запроса') return { ok: true, offline: true, data: null }; return { ok: false, error: e.message }; }
}
function applyAuth(user, token) {
    state.user = user;
    state.canEdit = EDITOR_ROLES.indexOf(user.role) > -1;
    document.body.classList.toggle('can-edit', state.canEdit);
    saveSession({ token: token, user: user });
    updateProfile(user);
    updateFab();
}
function updateProfile(user) {
    if (!user) return;
    var n = $('#user-display-name'), r = $('#user-display-rank'), s = $('#user-display-steam'), a = $('#user-avatar');
    if (n) n.textContent = user.display_name || user.username || '';
    if (r) r.textContent = user.rank || user.role || '';
    if (s) s.textContent = 'Steam ID: ' + (user.steam_id || '—');
    if (a) {
        if (user.steam_id) {
            var sid = steamTo64(user.steam_id);
            var safeSid = sid ? String(sid).replace(/[^\d]/g, '') : '';
            if (safeSid && _avatarCache[safeSid]) {
                a.src = _avatarCache[safeSid];
            } else if (safeSid) {
                a.setAttribute('data-sid64', safeSid);
                a.src = FALLBACK_AVATAR;
                /* Загружаем аватар профиля немедленно, без очереди */
                (function(sid64, imgEl) {
                    if (_avatarPending[sid64]) return;
                    _avatarPending[sid64] = true;
                    fetch(API_URL + '/api/steam-avatar/' + sid64, {
                        cache: 'default', mode: 'cors', credentials: 'omit',
                        signal: AbortSignal.timeout(6000)
                    }).then(function(res) {
                        if (!res.ok) throw 0;
                        return res.json();
                    }).then(function(data) {
                        if (data && data.avatar) {
                            _avatarCache[sid64] = data.avatar;
                            saveAvatarCache(_avatarCache);
                            imgEl.src = data.avatar;
                        }
                    }).catch(function() {}).finally(function() {
                        delete _avatarPending[sid64];
                    });
                })(safeSid, a);
            } else {
                a.src = user.avatar_url || FALLBACK_AVATAR;
            }
        } else {
            a.src = user.avatar_url || FALLBACK_AVATAR;
        }
    }
}
function logout() {
    state.user = null; state.canEdit = false;
    clearSession(); cacheClear();
    document.body.classList.remove('can-edit');
    var ls = $('#login-screen'), app = $('#app'), fab = $('#fab-container');
    if (ls) ls.classList.remove('hidden');
    if (app) app.classList.add('hidden');
    if (fab) fab.classList.add('hidden');
    var form = $('#login-form'); if (form) form.reset();
    var err = $('#login-error'); if (err) err.classList.add('hidden');
    showToast('Вы вышли из аккаунта', 'info');
}

/* ── FAB ── */
function updateFab() {
    var fab = $('#fab-container'); if (fab) fab.classList.add('hidden');
    var btnEvent = $('#btn-add-event'), btnStaff = $('#btn-add-staff'), btnImportStaff = $('#btn-import-staff');
    if (btnEvent) { btnEvent.classList.toggle('hidden', !state.user); btnEvent.disabled = !state.user; }
    if (btnStaff) {
        var canManage = !!state.user && isEditor();
        btnStaff.classList.toggle('hidden', !state.user);
        btnStaff.disabled = !canManage;
        btnStaff.classList.toggle('btn-add-mini-disabled', !canManage);
        btnStaff.title = canManage ? '' : 'Недостаточно прав';
    }
    if (btnImportStaff) {
        var canImport = !!state.user && isEditor();
        btnImportStaff.classList.toggle('hidden', !state.user);
        btnImportStaff.disabled = !canImport;
        btnImportStaff.classList.toggle('btn-add-mini-disabled', !canImport);
        btnImportStaff.title = canImport ? '' : 'Недостаточно прав';
    }
}

function openCreateEventModal() {
    var title = $('#modal-event-title'), form = $('#event-form'), eid = $('#event-id'), org = $('#event-organizer');
    if (title) title.textContent = 'Создать ивент';
    if (form) form.reset();
    if (eid) eid.value = '';
    if (org && state.user) org.value = state.user.display_name || state.user.username || '';
    var counter = $('#event-desc-counter'); if (counter) counter.textContent = '0 / 500';
    showModal('modal-event');
}

function openEditEventModal(ev) {
    var title = $('#modal-event-title'), eid = $('#event-id');
    if (title) title.textContent = 'Редактировать ивент';
    if (eid) eid.value = ev.id;
    var fields = {
        '#event-name': ev.name || '',
        '#event-description': ev.description || '',
        '#event-organizer': ev.organizer || '',
        '#event-time-start': ev.time_start || '',
        '#event-time-end': ev.time_end || '',
        '#event-participants': ev.participants_count || '',
        '#event-prizes': ev.prizes || '',
        '#event-helpers': ev.helpers || ''
    };
    Object.keys(fields).forEach(function(sel) { var el = $(sel); if (el) el.value = fields[sel]; });
    updateCharCounter();
    showModal('modal-event');
}

function openCreateStaffModal() {
    var title = $('#modal-staff-title'), form = $('#staff-form'), sid = $('#staff-id');
    if (title) title.textContent = 'Добавить сотрудника';
    if (form) form.reset();
    if (sid) sid.value = '';
    showModal('modal-staff');
}

async function openImportStaffModal(force) {
    if (!isEditor()) { showToast('Недостаточно прав', 'error'); return; }
    var search = $('#staff-import-search');
    if (search) search.value = '';
    showModal('modal-import-staff');
    await renderImportStaffList(!!force);
}

/* ── char counter ── */
function updateCharCounter() {
    var desc = $('#event-description'), counter = $('#event-desc-counter');
    if (!desc || !counter) return;
    var len = desc.value.length, max = 500;
    counter.textContent = len + ' / ' + max;
    counter.className = 'char-counter';
    if (len > max * 0.9) counter.classList.add('char-counter-danger');
    else if (len > max * 0.7) counter.classList.add('char-counter-warning');
}

/* ── API: Events ── */
async function loadEvents(force) {
    if (!force) { var cached = cacheGet('events'); if (cached) { state.events = cached; return cached; } }
    try {
        var data = await http.get('/api/events');
        var items = Array.isArray(data) ? data : (data && data.events ? data.events : []);
        state.events = items;
        cacheSet('events', items, 30000);
        return items;
    } catch(e) { console.error('events load err:', e); showToast('Ошибка загрузки ивентов: ' + e.message, 'error'); return state.events || []; }
}

async function createEvent(data) {
    try { var result = await http.post('/api/events', data); cacheClear('events'); showToast('Ивент создан', 'success'); await renderEvents(true); return result; }
    catch(e) { showToast('Ошибка создания: ' + e.message, 'error'); throw e; }
}

async function updateEvent(id, data) {
    try {
        data.edited_by = state.user ? (state.user.display_name || state.user.username) : null;
        data.edited_at = new Date().toISOString();
        await http.patch('/api/events/' + id, data);
        cacheClear('events');
        showToast('Ивент обновлён', 'success');
        await renderEvents(true);
    } catch(e) { showToast('Ошибка обновления: ' + e.message, 'error'); throw e; }
}

async function deleteEvent(id) {
    try { await http.del('/api/events/' + id); cacheClear('events'); showToast('Ивент удалён', 'success'); await renderEvents(true); }
    catch(e) { showToast('Ошибка удаления: ' + e.message, 'error'); throw e; }
}

async function updateEventStatus(id, status, rejectReason) {
    try {
        var body = { status: status };
        if (status === 'Отказано' && rejectReason) {
            body.reject_reason = rejectReason;
            body.rejected_by = state.user ? (state.user.display_name || state.user.username) : null;
            body.rejected_at = new Date().toISOString();
        }
        await http.patch('/api/events/' + id, body);
        cacheClear('events');
        showToast('Статус обновлён', 'success');
        await renderEvents(true);
    } catch(e) { showToast('Ошибка обновления: ' + e.message, 'error'); throw e; }
}

/* ── API: Comments ── */
async function loadComments(eventId) {
    try { var data = await http.get('/api/events/' + eventId + '/comments'); return Array.isArray(data) ? data : (data && data.comments ? data.comments : []); }
    catch(e) { return []; }
}
async function addComment(eventId, text) {
    var user = state.user;
    await http.post('/api/events/' + eventId + '/comments', { text: text, author: user ? (user.display_name || user.username) : 'Аноним' });
    showToast('Комментарий добавлен', 'success');
}
async function deleteComment(eventId, commentId) {
    try { await http.del('/api/events/' + eventId + '/comments/' + commentId); showToast('Комментарий удалён', 'success'); }
    catch(e) { showToast('Ошибка: ' + e.message, 'error'); }
}
async function addReaction(eventId, commentId, emoji) {
    try {
        await http.post('/api/events/' + eventId + '/comments/' + commentId + '/reactions', {
            emoji: emoji,
            user: state.user ? (state.user.display_name || state.user.username) : 'Аноним'
        });
    } catch(e) { /* silent */ }
}

/* ── API: Staff ── */
async function loadStaff(force) {
    if (!state.user) return state.staff || [];
    if (!force) { var cached = cacheGet('staff'); if (cached) { state.staff = cached; return cached; } }
    try {
        var data = await http.get('/api/staff');
        var items = Array.isArray(data) ? data : (data && data.staff ? data.staff : (data && Array.isArray(data.data) ? data.data : []));
        state.staff = items;
        cacheSet('staff', items, 60000);
        return items;
    } catch(e) { console.error('staff load err:', e); showToast('Ошибка загрузки состава: ' + e.message, 'error'); return state.staff || []; }
}

function steamTo64(steam32) {
    try {
        var clean = steam32.trim().replace(/\s+/g, '').replace('STEAM_', '');
        var parts = clean.split(':');
        if (parts.length !== 3) return null;
        var y = parseInt(parts[1]), z = parseInt(parts[2]);
        if (isNaN(y) || isNaN(z)) return null;
        return String(76561197960265728n + BigInt(z) * 2n + BigInt(y));
    } catch(e) { return null; }
}
function getAvatarCache() {
    var saved = getJSON(STORAGE_KEYS.avatars);
    return saved && typeof saved === 'object' ? saved : {};
}
function saveAvatarCache(cache) {
    setJSON(STORAGE_KEYS.avatars, cache || {});
}
var _avatarCache = getAvatarCache(), _avatarQueue = [], _avatarLoading = 0, _avatarPending = {};
function loadStaffAvatar(steam32, imgEl) {
    var sid = steamTo64(steam32);
    if (!sid) { if (imgEl) imgEl.src = FALLBACK_AVATAR; return; }
    var safeSid = String(sid).replace(/[^\d]/g, '');
    if (imgEl) {
        imgEl.setAttribute('data-sid64', safeSid);
        imgEl.src = _avatarCache[safeSid] || FALLBACK_AVATAR;
        imgEl.loading = 'lazy';
        imgEl.decoding = 'async';
        try { imgEl.fetchPriority = 'low'; } catch(e) {}
    }
    if (_avatarCache[safeSid]) return;
    if (_avatarPending[safeSid]) return;
    _avatarQueue.push({ sid: safeSid, steam32: steam32 });
    if (window.requestIdleCallback) requestIdleCallback(_processAvatars, { timeout: 1200 });
    else setTimeout(_processAvatars, 80);
}
function loadAvatarsIn(container) {
    if (!container) return;
    var nodes = Array.prototype.slice.call(container.querySelectorAll('[data-steam][data-sid64]'));
    if (!nodes.length) return;
    function warmBatch() {
        var visible = nodes.splice(0, 12);
        visible.forEach(function(img) {
            var sid = (img.dataset.sid64 || '').replace(/[^\d]/g, '');
            img.loading = 'lazy';
            img.decoding = 'async';
            try { img.fetchPriority = 'low'; } catch(e) {}
            if (sid && _avatarCache[sid]) img.src = _avatarCache[sid];
            else if (img.dataset.steam) loadStaffAvatar(img.dataset.steam, img);
        });
        if (nodes.length) setTimeout(warmBatch, 60);
    }
    warmBatch();
}
function _processAvatars() {
    while (_avatarLoading < 6 && _avatarQueue.length) {
        var job = _avatarQueue.shift();
        if (_avatarPending[job.sid]) continue;
        _avatarPending[job.sid] = true;
        _avatarLoading++;
        _fetchStaffAvatar(job).finally(function() {
            _avatarLoading--;
            _processAvatars();
        });
    }
}
async function _fetchStaffAvatar(job) {
    try {
        var res = await fetch(API_URL + '/api/steam-avatar/' + job.sid, {
            cache: 'default',
            mode: 'cors',
            credentials: 'omit',
            signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) throw 0;
        var data = await res.json();
        if (!data.avatar) throw 0;
        _avatarCache[job.sid] = data.avatar;
        saveAvatarCache(_avatarCache);
        document.querySelectorAll('[data-sid64="' + job.sid + '"]').forEach(function(img) { img.src = data.avatar; });
    } catch(e) {
    } finally {
        delete _avatarPending[job.sid];
    }
}
async function createStaff(data) {
    try { var result = await http.post('/api/staff', data); cacheClear('staff'); showToast('Сотрудник добавлен', 'success'); await renderStaff(true); return result; }
    catch(e) { showToast('Ошибка добавления: ' + e.message, 'error'); throw e; }
}
async function updateStaff(id, data) {
    try { await http.patch('/api/staff/' + id, data); cacheClear('staff'); showToast('Сотрудник обновлён', 'success'); await renderStaff(true); }
    catch(e) { showToast('Ошибка обновления: ' + e.message, 'error'); throw e; }
}
async function deleteStaff(id) {
    try { await http.del('/api/staff/' + id); cacheClear('staff'); showToast('Сотрудник удалён', 'success'); await renderStaff(true); }
    catch(e) { showToast('Ошибка удаления: ' + e.message, 'error'); throw e; }
}
async function loadImportStaffSource(force) {
    if (!state.user) return [];
    if (!force) {
        var cached = cacheGet('staff-import-source');
        if (cached) {
            state.importStaffSource = cached;
            return cached;
        }
    }
    try {
        var data = await http.get('/api/staff/import/source');
        var items = Array.isArray(data) ? data : (data && Array.isArray(data.items) ? data.items : []);
        state.importStaffSource = items;
        cacheSet('staff-import-source', items, 60000);
        return items;
    } catch(e) {
        console.error('staff import source err:', e);
        showToast('Ошибка загрузки импорта: ' + e.message, 'error');
        return state.importStaffSource || [];
    }
}
async function importStaffFromSource(item, role, rank) {
    try {
        var result = await http.post('/api/staff/import', { item: item, role: role || 'Ивентер', rank: rank || 'intern' });
        cacheClear('staff');
        var mode = result && result.mode === 'updated' ? 'обновлён' : 'добавлен';
        showToast('Сотрудник ' + mode, 'success');
        await renderStaff(true);
        return result;
    } catch(e) {
        showToast('Ошибка импорта: ' + e.message, 'error');
        throw e;
    }
}

/* ── API: Users ── */
async function createUser(userData) {
    try { var result = await http.post('/api/users', userData); showToast('Аккаунт создан', 'success'); return result; }
    catch(e) { showToast('Ошибка создания аккаунта: ' + e.message, 'error'); throw e; }
}
async function loadUsers() {
    try { var data = await http.get('/api/users'); return Array.isArray(data) ? data : (data && data.users ? data.users : []); }
    catch(e) { return []; }
}
async function deleteUser(id) {
    try { await http.del('/api/users/' + id); showToast('Аккаунт удалён', 'success'); }
    catch(e) { showToast('Ошибка удаления: ' + e.message, 'error'); throw e; }
}

/* ══════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════ */
function renderDashboard() {
    var container = $('#dashboard-content');
    if (!container) return;

    var events = state.events || [];
    var staff = state.staff || [];
    var now = Date.now();
    var weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    var monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    var eventsThisWeek = events.filter(function(e) { try { return new Date(e.created_at || e.date || e.time_start).getTime() > weekAgo; } catch(x) { return false; } });
    var eventsThisMonth = events.filter(function(e) { try { return new Date(e.created_at || e.date || e.time_start).getTime() > monthAgo; } catch(x) { return false; } });
    var pending = events.filter(function(e) { return e.status === 'В рассмотрении'; });
    var approved = events.filter(function(e) { return e.status === 'Одобрено'; });
    var rejected = events.filter(function(e) { return e.status === 'Отказано'; });

    var seniorCount = staff.filter(function(s) { return SENIOR_ROLES.indexOf(s.role) > -1; }).length;
    var juniorCount = staff.filter(function(s) { return JUNIOR_ROLES.indexOf(s.role) > -1; }).length;

    // Recent events (last 5)
    var recentEvents = events.slice().sort(function(a, b) {
        return new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime();
    }).slice(0, 5);

    container.innerHTML =
        '<div class="dash-stats-grid">' +
            '<div class="dash-stat-card glass-panel"><div class="dash-stat-icon" style="color:var(--accent);">' + IC.dashboard + '</div><div class="dash-stat-info"><span class="dash-stat-value">' + events.length + '</span><span class="dash-stat-label">Всего ивентов</span></div></div>' +
            '<div class="dash-stat-card glass-panel"><div class="dash-stat-icon" style="color:var(--warning);">' + IC.clock + '</div><div class="dash-stat-info"><span class="dash-stat-value">' + pending.length + '</span><span class="dash-stat-label">Ожидают одобрения</span></div></div>' +
            '<div class="dash-stat-card glass-panel"><div class="dash-stat-icon" style="color:var(--success);">' + IC.checkLg + '</div><div class="dash-stat-info"><span class="dash-stat-value">' + approved.length + '</span><span class="dash-stat-label">Одобрено</span></div></div>' +
            '<div class="dash-stat-card glass-panel"><div class="dash-stat-icon" style="color:var(--danger);">' + IC.xLg + '</div><div class="dash-stat-info"><span class="dash-stat-value">' + rejected.length + '</span><span class="dash-stat-label">Отказано</span></div></div>' +
            '<div class="dash-stat-card glass-panel"><div class="dash-stat-icon" style="color:var(--accent);">' + IC.info + '</div><div class="dash-stat-info"><span class="dash-stat-value">' + eventsThisWeek.length + '</span><span class="dash-stat-label">За неделю</span></div></div>' +
            '<div class="dash-stat-card glass-panel"><div class="dash-stat-icon" style="color:var(--text-secondary);">' + IC.info + '</div><div class="dash-stat-info"><span class="dash-stat-value">' + eventsThisMonth.length + '</span><span class="dash-stat-label">За месяц</span></div></div>' +
            '<div class="dash-stat-card glass-panel"><div class="dash-stat-icon" style="color:var(--accent);">' + IC.info + '</div><div class="dash-stat-info"><span class="dash-stat-value">' + staff.length + '</span><span class="dash-stat-label">Всего сотрудников</span></div></div>' +
            '<div class="dash-stat-card glass-panel"><div class="dash-stat-icon" style="color:var(--text-muted);">' + IC.info + '</div><div class="dash-stat-info"><span class="dash-stat-value">' + seniorCount + ' / ' + juniorCount + '</span><span class="dash-stat-label">Старший / Младший</span></div></div>' +
        '</div>' +
        '<div class="dash-recent glass-panel">' +
            '<h3 class="dash-recent-title">Последние ивенты</h3>' +
            (recentEvents.length ? recentEvents.map(function(ev) {
                return '<div class="dash-recent-item">' +
                    '<div class="dash-recent-name">' + esc(ev.name) + (isNew(ev.created_at) ? ' <span class="badge-new">NEW</span>' : '') + '</div>' +
                    '<div class="dash-recent-meta">' +
                        '<span>' + esc(ev.organizer || '—') + '</span>' +
                        '<span class="status-badge ' + statusClass(ev.status) + '" style="font-size:0.72rem;padding:3px 8px;">' + statusIcon(ev.status) + ' ' + esc(ev.status || 'В рассмотрении') + '</span>' +
                    '</div>' +
                '</div>';
            }).join('') : '<div class="comments-empty">Ивентов пока нет</div>') +
        '</div>';
}

/* ══════════════════════════════════════════════
   EVENTS — search, filter, sort
   ══════════════════════════════════════════════ */
var _eventsCleanup = null;

function getFilteredEvents() {
    var events = state.events || [];
    var search = (($('#ev-search') || {}).value || '').toLowerCase().trim();
    var statusFilter = ($('#ev-filter-status') || {}).value || 'all';
    var orgFilter = ($('#ev-filter-organizer') || {}).value || 'all';
    var onlyMine = ($('#ev-filter-mine') || {}).checked || false;
    var sortBy = ($('#ev-sort') || {}).value || 'newest';

    var filtered = events.filter(function(ev) {
        if (search && !(ev.name || '').toLowerCase().includes(search) && !(ev.organizer || '').toLowerCase().includes(search)) return false;
        if (statusFilter !== 'all' && ev.status !== statusFilter) return false;
        if (orgFilter !== 'all' && ev.organizer !== orgFilter) return false;
        if (onlyMine && state.user) {
            var myName = (state.user.display_name || state.user.username || '').toLowerCase();
            if ((ev.organizer || '').toLowerCase() !== myName) return false;
        }
        return true;
    });

    filtered.sort(function(a, b) {
        if (sortBy === 'newest') return new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime();
        if (sortBy === 'oldest') return new Date(a.created_at || a.date || 0).getTime() - new Date(b.created_at || b.date || 0).getTime();
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
        return 0;
    });

    return filtered;
}

function populateOrganizerFilter() {
    var sel = $('#ev-filter-organizer');
    if (!sel) return;
    var orgs = {};
    (state.events || []).forEach(function(ev) { if (ev.organizer) orgs[ev.organizer] = true; });
    var current = sel.value;
    sel.innerHTML = '<option value="all">Все организаторы</option>' +
        Object.keys(orgs).sort().map(function(o) {
            return '<option value="' + esc(o) + '">' + esc(o) + '</option>';
        }).join('');
    sel.value = current || 'all';
}

async function renderEvents(force) {
    var tbody = $('#events-tbody'), emptyEl = $('#events-empty');
    if (!tbody) return;
    var events = await loadEvents(force);
    populateOrganizerFilter();
    if (_eventsCleanup) { _eventsCleanup(); _eventsCleanup = null; }
    var filtered = getFilteredEvents();
    if (!filtered.length) {
        tbody.innerHTML = '';
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
    }
    if (emptyEl) emptyEl.classList.add('hidden');
    var editor = isEditor();
    var fragment = document.createDocumentFragment();
    filtered.forEach(function(ev) {
        var tr = document.createElement('tr');
        var editorBtns = editor ?
            '<button class="btn-icon" title="Редактировать" data-action="edit-event" data-id="' + esc(ev.id) + '">' + IC.edit + '</button>' +
            '<button class="btn-icon" title="Изменить статус" data-action="status" data-id="' + esc(ev.id) + '">' + IC.filter + '</button>' +
            '<button class="btn-icon" title="Удалить" data-action="delete-event" data-id="' + esc(ev.id) + '" style="color:var(--danger);">' + IC.del + '</button>'
            : '';
        var timeDisplay = ev.time_start || ev.date || '—';
        if (ev.time_start && ev.time_end) timeDisplay = ev.time_start + ' — ' + ev.time_end;
        var newBadge = isNew(ev.created_at) ? '<span class="badge-new">NEW</span>' : '';
        var editedInfo = ev.edited_by ? '<br><span style="font-size:0.72rem;color:var(--text-muted);">✏️ ' + esc(ev.edited_by) + ' ' + formatDateTime(ev.edited_at) + '</span>' : '';
        tr.innerHTML =
            '<td><strong>' + esc(ev.name) + '</strong> ' + newBadge +
                (ev.description ? '<br><span style="font-size:0.8rem;color:var(--text-muted);">' + esc(ev.description.substring(0, 50)) + (ev.description.length > 50 ? '...' : '') + '</span>' : '') +
                editedInfo + '</td>' +
            '<td><span class="copy-target" data-copy="' + esc(ev.organizer || '') + '" title="Копировать">' + esc(ev.organizer || '—') + ' <span class="copy-icon">' + IC.copy + '</span></span></td>' +
            '<td style="white-space:nowrap;">' + esc(timeDisplay) + '</td>' +
            '<td>' + esc(ev.participants_count || '—') + '</td>' +
            '<td><span class="status-badge ' + statusClass(ev.status) + '">' + statusIcon(ev.status) + ' ' + esc(ev.status || 'В рассмотрении') + '</span>' +
                (ev.status === 'Отказано' && ev.reject_reason ? '<br><span style="font-size:0.72rem;color:var(--danger);" title="' + esc(ev.reject_reason) + '">❌ ' + esc(ev.reject_reason.substring(0, 30)) + (ev.reject_reason.length > 30 ? '...' : '') + '</span>' : '') +
            '</td>' +
            '<td><div class="event-actions">' +
                '<button class="btn-icon" title="Подробнее" data-action="detail" data-id="' + esc(ev.id) + '">' + IC.eye + '</button>' +
                editorBtns +
            '</div></td>';
        fragment.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(fragment);

    _eventsCleanup = delegateClick(tbody, '[data-action], .copy-target', async function(e, btn) {
        if (btn.classList.contains('copy-target')) {
            e.preventDefault();
            copyToClipboard(btn.dataset.copy, 'Организатор');
            return;
        }
        var action = btn.dataset.action, id = btn.dataset.id;
        if (action === 'detail') { await openEventDetail(id); }
        else if (action === 'edit-event') {
            var ev = state.events.find(function(x) { return String(x.id) === String(id); });
            if (ev) openEditEventModal(ev);
        }
        else if (action === 'status') {
            var sel = $('#status-select'), eid = $('#status-event-id'), reasonWrap = $('#reject-reason-wrap'), reasonInput = $('#reject-reason');
            if (sel && eid) {
                eid.value = id;
                var ev2 = state.events.find(function(x) { return String(x.id) === String(id); });
                if (ev2) sel.value = ev2.status || 'В рассмотрении';
                if (reasonWrap) reasonWrap.classList.toggle('hidden', sel.value !== 'Отказано');
                if (reasonInput) reasonInput.value = '';
                showModal('modal-status');
            }
        }
        else if (action === 'delete-event') {
            if (confirm('Удалить ивент?')) { try { await deleteEvent(id); } catch(err) {} }
        }
    });
}

/* ── event detail ── */
async function openEventDetail(eventId) {
    var ev = state.events.find(function(e) { return String(e.id) === String(eventId); });
    if (!ev) return;
    var fields = {
        '#detail-event-name':  ev.name,
        '#detail-description': ev.description || '—',
        '#detail-organizer':   ev.organizer || '—',
        '#detail-time-start':  ev.time_start || '—',
        '#detail-time-end':    ev.time_end || '—',
        '#detail-participants':ev.participants_count || '—',
        '#detail-prizes':      ev.prizes || 'Нет',
        '#detail-helpers':     ev.helpers || '—'
    };
    Object.keys(fields).forEach(function(sel) { var el = $(sel); if (el) el.textContent = fields[sel]; });

    var statusEl = $('#detail-status');
    if (statusEl) {
        statusEl.className = 'status-badge ' + statusClass(ev.status);
        statusEl.innerHTML = statusIcon(ev.status) + ' ' + esc(ev.status || 'В рассмотрении');
    }

    // Reject reason
    var rejectEl = $('#detail-reject-info');
    if (rejectEl) {
        if (ev.status === 'Отказано' && ev.reject_reason) {
            rejectEl.classList.remove('hidden');
            rejectEl.innerHTML = '<strong>Причина отказа:</strong> ' + esc(ev.reject_reason) +
                (ev.rejected_by ? '<br><span style="color:var(--text-muted);font-size:0.8rem;">Кто отказал: ' + esc(ev.rejected_by) + (ev.rejected_at ? ' • ' + formatDateTime(ev.rejected_at) : '') + '</span>' : '');
        } else {
            rejectEl.classList.add('hidden');
            rejectEl.innerHTML = '';
        }
    }

    // Edited info
    var editedEl = $('#detail-edited-info');
    if (editedEl) {
        if (ev.edited_by) {
            editedEl.classList.remove('hidden');
            editedEl.innerHTML = '✏️ Последнее редактирование: ' + esc(ev.edited_by) + (ev.edited_at ? ' • ' + formatDateTime(ev.edited_at) : '');
        } else {
            editedEl.classList.add('hidden');
        }
    }

    var commentEventId = $('#comment-event-id'), commentsList = $('#comments-list');
    if (commentEventId) commentEventId.value = eventId;
    if (commentsList) commentsList.innerHTML = '<div class="comments-empty">Загрузка...</div>';
    showModal('modal-event-detail');
    var comments = await loadComments(eventId);
    renderComments(comments, eventId);
}

function renderComments(comments, eventId) {
    var list = $('#comments-list');
    if (!list) return;
    if (!comments || !comments.length) { list.innerHTML = '<div class="comments-empty">Комментариев пока нет</div>'; return; }
    var myName = state.user ? (state.user.display_name || state.user.username || '') : '';
    var fragment = document.createDocumentFragment();
    comments.forEach(function(c) {
        var div = document.createElement('div');
        div.className = 'comment-item';
        var isMine = c.author === myName;
        var actions = isMine ?
            '<span class="comment-actions">' +
                '<button class="btn-icon-tiny" title="Удалить" data-action="delete-comment" data-comment-id="' + esc(c.id) + '" data-event-id="' + esc(eventId) + '">' + IC.del + '</button>' +
            '</span>' : '';
        var reactions = (c.reactions || []);
        var reactionsHtml = '<div class="comment-reactions">' +
            '<button class="btn-reaction" data-action="react" data-emoji="👍" data-comment-id="' + esc(c.id) + '" data-event-id="' + esc(eventId) + '">👍 ' + (reactions.filter(function(r){ return r.emoji === '👍'; }).length || '') + '</button>' +
            '<button class="btn-reaction" data-action="react" data-emoji="❤️" data-comment-id="' + esc(c.id) + '" data-event-id="' + esc(eventId) + '">❤️ ' + (reactions.filter(function(r){ return r.emoji === '❤️'; }).length || '') + '</button>' +
            '</div>';
        div.innerHTML =
            '<div class="comment-author">' + esc(c.author) + actions +
                '<span class="comment-date">' + formatDateTime(c.created_at) + '</span></div>' +
            '<div class="comment-text">' + esc(c.text) + '</div>' + reactionsHtml;
        fragment.appendChild(div);
    });
    list.innerHTML = '';
    list.appendChild(fragment);
    list.scrollTop = list.scrollHeight;

    delegateClick(list, '[data-action]', async function(e, btn) {
        var action = btn.dataset.action;
        if (action === 'delete-comment') {
            if (confirm('Удалить комментарий?')) {
                await deleteComment(btn.dataset.eventId, btn.dataset.commentId);
                renderComments(await loadComments(btn.dataset.eventId), btn.dataset.eventId);
            }
        } else if (action === 'react') {
            await addReaction(btn.dataset.eventId, btn.dataset.commentId, btn.dataset.emoji);
            renderComments(await loadComments(btn.dataset.eventId), btn.dataset.eventId);
        }
    });
}

/* ══════════════════════════════════════════════
   STAFF — search, filter, sort
   ══════════════════════════════════════════════ */
var _staffSeniorCleanup = null, _staffJuniorCleanup = null;

function getFilteredStaff(list) {
    var search = (($('#staff-search') || {}).value || '').toLowerCase().trim();
    var roleFilter = ($('#staff-filter-role') || {}).value || 'all';
    var sortBy = ($('#staff-sort') || {}).value || 'name';

    var filtered = list.filter(function(s) {
        if (search) {
            var match = (s.name || '').toLowerCase().includes(search) ||
                        (s.steam_id || '').toLowerCase().includes(search) ||
                        (s.discord_id || '').toLowerCase().includes(search);
            if (!match) return false;
        }
        if (roleFilter !== 'all' && s.role !== roleFilter) return false;
        return true;
    });

    filtered.sort(function(a, b) {
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'date-new') return new Date(b.join_date || 0).getTime() - new Date(a.join_date || 0).getTime();
        if (sortBy === 'date-old') return new Date(a.join_date || 0).getTime() - new Date(b.join_date || 0).getTime();
        if (sortBy === 'role') return (a.role || '').localeCompare(b.role || '');
        return 0;
    });

    return filtered;
}

async function renderStaff(force) {
    var staff = await loadStaff(force);

    var search = (($('#staff-search') || {}).value || '').toLowerCase().trim();
    var roleFilter = ($('#staff-filter-role') || {}).value || 'all';

    var allFiltered = staff.filter(function(s) {
        if (search) {
            var match = (s.name || '').toLowerCase().includes(search) || (s.steam_id || '').toLowerCase().includes(search) || (s.discord_id || '').toLowerCase().includes(search);
            if (!match) return false;
        }
        if (roleFilter !== 'all' && s.role !== roleFilter) return false;
        return true;
    });

    var senior = allFiltered.filter(function(s) { return SENIOR_ROLES.indexOf(s.role) > -1; });
    var junior = allFiltered.filter(function(s) { return JUNIOR_ROLES.indexOf(s.role) > -1; });

    _staffSeniorCleanup = renderStaffTable(senior, '#staff-senior-tbody', '#staff-senior-empty', _staffSeniorCleanup);
    _staffJuniorCleanup = renderStaffTable(junior, '#staff-junior-tbody', '#staff-junior-empty', _staffJuniorCleanup);
}

function renderStaffTable(list, tbodySel, emptySel, oldCleanup) {
    var tbody = $(tbodySel), emptyEl = $(emptySel);
    if (!tbody) return null;
    if (oldCleanup) oldCleanup();
    if (!list || !list.length) { tbody.innerHTML = ''; if (emptyEl) emptyEl.classList.remove('hidden'); return null; }
    if (emptyEl) emptyEl.classList.add('hidden');
    var editor = isEditor();
    var fragment = document.createDocumentFragment();
    list.forEach(function(s) {
        var tr = document.createElement('tr');
        var actions = editor ?
            '<div class="event-actions">' +
                '<button class="btn-icon" title="Редактировать" data-action="edit-staff" data-id="' + esc(s.id) + '">' + IC.edit + '</button>' +
                '<button class="btn-icon" title="Удалить" data-action="delete-staff" data-id="' + esc(s.id) + '" style="color:var(--danger);">' + IC.del + '</button>' +
            '</div>' : '<span style="color:var(--text-muted);">—</span>';
        var playerName = s.name || '—';
        var sid64 = s.steam_id ? steamTo64(s.steam_id) : '';
        var newBadge = isNew(s.created_at) ? ' <span class="badge-new">NEW</span>' : '';
        var externalMeta = [];
        if (s.external_rank) externalMeta.push('Внешний ранг: ' + esc(s.external_rank));
        if (s.external_status) externalMeta.push('Статус: ' + esc(s.external_status));
        if (s.external_department) externalMeta.push('Отдел: ' + esc(s.external_department));
        if (s.external_vacation) externalMeta.push('Отпуск: ' + esc(s.external_vacation));
        tr.innerHTML =
            '<td><div class="staff-player-cell">' +
                '<img class="staff-player-avatar" data-steam="' + esc(s.steam_id || '') + '" data-sid64="' + (sid64 || '') + '" src="' + FALLBACK_AVATAR + '" alt="' + esc(playerName) + '">' +
                '<span class="staff-player-name">' + esc(playerName) + newBadge +
                    (externalMeta.length ? '<br><span class="user-list-login">' + externalMeta.join(' • ') + '</span>' : '') +
                '</span>' +
            '</div></td>' +
            '<td>' + esc(s.role) + '</td>' +
            '<td>' + esc(s.rank || 'intern') + '</td>' +
            '<td><span class="copy-target" data-copy="' + esc(s.steam_id || '') + '" title="Копировать"><code style="font-size:0.82rem;">' + esc(s.steam_id || '—') + '</code> <span class="copy-icon">' + IC.copy + '</span></span></td>' +
            '<td>' + formatDate(s.join_date) + '</td>' +
            '<td><span class="copy-target" data-copy="' + esc(s.discord_id || '') + '" title="Копировать"><code style="color:var(--accent);font-size:0.82rem;">' + esc(s.discord_id || '—') + '</code> <span class="copy-icon">' + IC.copy + '</span></span></td>' +
            '<td>' + actions + '</td>';
        fragment.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
    loadAvatarsIn(tbody);
    return delegateClick(tbody, '[data-action], .copy-target', async function(e, btn) {
        if (btn.classList.contains('copy-target')) {
            e.preventDefault();
            copyToClipboard(btn.dataset.copy, 'ID');
            return;
        }
        var action = btn.dataset.action, id = btn.dataset.id;
        if (action === 'edit-staff') {
            var s = state.staff.find(function(x) { return String(x.id) === String(id); });
            if (!s) return;
            var fId = $('#staff-id'); if (fId) fId.value = s.id;
            var fName = $('#staff-name'); if (fName) fName.value = s.name || '';
            var fRole = $('#staff-role'); if (fRole) fRole.value = s.role || 'Ивентер';
            var fRank = $('#staff-rank'); if (fRank) fRank.value = s.rank || 'intern';
            var fSteam = $('#staff-steam'); if (fSteam) fSteam.value = s.steam_id || '';
            var fDate = $('#staff-join-date'); if (fDate) fDate.value = s.join_date || '';
            var fDiscord = $('#staff-discord'); if (fDiscord) fDiscord.value = s.discord_id || '';
            var title = $('#modal-staff-title'); if (title) title.textContent = 'Редактировать сотрудника';
            showModal('modal-staff');
        } else if (action === 'delete-staff') {
            if (confirm('Удалить сотрудника?')) { try { await deleteStaff(id); } catch(err) {} }
        }
    });
}

function getFilteredImportStaff() {
    var items = state.importStaffSource || [];
    var search = (($('#staff-import-search') || {}).value || '').toLowerCase().trim();
    if (!search) return items;
    return items.filter(function(item) {
        return (item.name || '').toLowerCase().includes(search) ||
            (item.steam_id || '').toLowerCase().includes(search) ||
            (item.discord_id || '').toLowerCase().includes(search) ||
            (item.external_rank || '').toLowerCase().includes(search);
    });
}

async function renderImportStaffList(force) {
    var container = $('#staff-import-list');
    if (!container) return;
    if (force) container.innerHTML = '<div class="comments-empty">Загрузка...</div>';
    await loadImportStaffSource(force);
    var items = getFilteredImportStaff();
    if (!items.length) {
        container.innerHTML = '<div class="comments-empty">Ничего не найдено</div>';
        return;
    }
    container._importItems = items;
        var fragment = document.createDocumentFragment();
        items.forEach(function(item, index) {
        var div = document.createElement('div');
        div.className = 'user-list-item staff-import-item';
        var importReady = !!(item && item.name && (item.steam_id || item.steam64_id));
        div.innerHTML = '<div class="user-list-info">' +
            '<span class="user-list-name">' + esc(item.name || 'Без имени') + '</span>' +
            '<span class="user-list-role">' + esc(item.external_rank || 'Ранг не указан') + '</span>' +
            '<span class="user-list-login">Steam: ' + esc(item.steam_id || '—') + ' • Steam64: ' + esc(item.steam64_id || '—') + ' • Discord: ' + esc(item.discord_id || '—') + '</span>' +
            '<span class="user-list-login">Дата входа: ' + esc(formatDate(item.join_date)) + (item.external_status ? ' • Статус: ' + esc(item.external_status) : '') + (item.external_department ? ' • Отдел: ' + esc(item.external_department) : '') + '</span>' +
            (importReady ? '' : '<span class="user-list-login" style="color:var(--warning);">Недостаточно данных для импорта</span>') +
            '</div>' +
            '<button class="btn btn-accent btn-import-inline" data-action="import-staff" data-index="' + index + '"' + (importReady ? '' : ' disabled') + '>Импорт</button>';
        fragment.appendChild(div);
    });
    container.innerHTML = '';
    container.appendChild(fragment);
    delegateClick(container, '[data-action="import-staff"]', async function(e, btn) {
        var idx = Number(btn.dataset.index);
        var sourceItems = container._importItems || [];
        var item = sourceItems[idx];
        if (!item) return;
        var role = ($('#staff-import-role') || {}).value || 'Ивентер';
        var rank = ($('#staff-import-rank') || {}).value || 'intern';
        btn.disabled = true;
        try {
            await importStaffFromSource(item, role, rank);
        } finally {
            btn.disabled = false;
        }
    });
}

/* ── users list ── */
async function renderUsersList() {
    var container = $('#users-list');
    if (!container) return;
    container.innerHTML = '<div class="comments-empty">Загрузка...</div>';
    var users = await loadUsers();
    if (!users || !users.length) { container.innerHTML = '<div class="comments-empty">Нет аккаунтов</div>'; return; }
    var fragment = document.createDocumentFragment();
    users.forEach(function(u) {
        var div = document.createElement('div');
        div.className = 'user-list-item';
        div.innerHTML = '<div class="user-list-info"><span class="user-list-name">' + esc(u.display_name || u.username) + '</span><span class="user-list-role">' + esc(u.role) + '</span><span class="user-list-login">login: ' + esc(u.username) + '</span></div>' +
            '<button class="btn-icon" title="Удалить" data-action="delete-user" data-id="' + esc(u.id) + '" style="color:var(--danger);">' + IC.del + '</button>';
        fragment.appendChild(div);
    });
    container.innerHTML = '';
    container.appendChild(fragment);
    delegateClick(container, '[data-action="delete-user"]', async function(e, btn) {
        if (confirm('Удалить аккаунт?')) { try { await deleteUser(btn.dataset.id); await renderUsersList(); } catch(err) {} }
    });
}

/* ── modals ── */
function showModal(id) {
    var el = document.getElementById(id);
    if (el) { el.classList.remove('hidden'); requestAnimationFrame(function() { var input = el.querySelector('input:not([type="hidden"])'); if (input) input.focus(); }); }
}
function hideModal(id) { var el = document.getElementById(id); if (el) el.classList.add('hidden'); }

/* ── tabs ── */
function switchTab(tabName) {
    state.currentTab = tabName;
    $$('.nav-item').forEach(function(n) { n.classList.toggle('active', n.dataset.tab === tabName); });
    $$('.tab-content').forEach(function(t) {
        var isTarget = t.id === 'tab-' + tabName;
        t.classList.toggle('hidden', !isTarget);
        if (isTarget) t.classList.add('active'); else t.classList.remove('active');
    });
    updateFab();
    if (tabName === 'dashboard') renderDashboard();
    if (tabName === 'events') renderEvents(true);
    if (tabName === 'staff') renderStaff(true);
    if (tabName === 'manual') emit('manual:load');
    if (tabName === 'norm') emit('norm:load');
}

/* ── wire up all events ── */
function wireUpEvents() {
    $$('.nav-item').forEach(function(btn) { btn.addEventListener('click', function() { switchTab(btn.dataset.tab); }); });

    var btnLogout = $('#btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', logout);

    var addEventBtn = $('#btn-add-event');
    if (addEventBtn) addEventBtn.addEventListener('click', function() { if (!state.user) return; openCreateEventModal(); });

    var addStaffBtn = $('#btn-add-staff');
    if (addStaffBtn) addStaffBtn.addEventListener('click', function() {
        if (!state.user) return;
        if (!isEditor()) { showToast('Недостаточно прав', 'error'); return; }
        openCreateStaffModal();
    });

    var importStaffBtn = $('#btn-import-staff');
    if (importStaffBtn) importStaffBtn.addEventListener('click', function() {
        if (!state.user) return;
        openImportStaffModal(true);
    });

    // Event filters
    ['ev-search', 'ev-filter-status', 'ev-filter-organizer', 'ev-sort'].forEach(function(id) {
        var el = $('#' + id);
        if (el) el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', function() { renderEvents(false); });
    });
    var evMine = $('#ev-filter-mine');
    if (evMine) evMine.addEventListener('change', function() { renderEvents(false); });

    // Staff filters
    ['staff-search'].forEach(function(id) {
        var el = $('#' + id); if (el) el.addEventListener('input', function() { renderStaff(false); });
    });
    ['staff-filter-role', 'staff-sort'].forEach(function(id) {
        var el = $('#' + id); if (el) el.addEventListener('change', function() { renderStaff(false); });
    });
    var importSearch = $('#staff-import-search');
    if (importSearch) importSearch.addEventListener('input', function() { renderImportStaffList(false); });
    var refreshImportBtn = $('#btn-refresh-import-staff');
    if (refreshImportBtn) refreshImportBtn.addEventListener('click', function() { renderImportStaffList(true); });

    // Char counter
    var descEl = $('#event-description');
    if (descEl) descEl.addEventListener('input', updateCharCounter);

    // Login form
    var loginForm = $('#login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var errEl = $('#login-error');
            if (errEl) errEl.classList.add('hidden');
            var uEl = $('#login-username'), pEl = $('#login-password');
            var username = uEl ? uEl.value.trim() : '', password = pEl ? pEl.value.trim() : '';
            if (!username || !password) return;
            var btn = loginForm.querySelector('.btn-login');
            if (btn) { btn.disabled = true; btn.innerHTML = IC.clock + ' <span>Вход...</span>'; }
            try {
                var data = await doLogin(username, password);
                if (data && data.token) {
                    var user = data.user || { username: username, role: 'Ивентер', rank: 'intern', display_name: username };
                    applyAuth(user, data.token);
                    var ls = $('#login-screen'), app = $('#app');
                    if (ls) ls.classList.add('hidden');
                    if (app) app.classList.remove('hidden');
                    await initApp();
                    showToast('Добро пожаловать, ' + (user.display_name || username) + '!', 'success');
                } else { throw new Error('Неверный ответ сервера'); }
            } catch(err) {
                if (errEl) { errEl.textContent = err.message || 'Неверный логин или пароль'; errEl.classList.remove('hidden'); }
            }
            if (btn) { btn.disabled = false; btn.innerHTML = IC.login + ' <span>Войти</span>'; }
        });
    }

    // Event form (create + edit)
    var eventForm = $('#event-form');
    if (eventForm) {
        eventForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var id = (($('#event-id') || {}).value || '').trim();
            var eventData = {
                name:               (($('#event-name') || {}).value || '').trim(),
                description:        (($('#event-description') || {}).value || '').trim(),
                organizer:          (($('#event-organizer') || {}).value || '').trim(),
                time_start:         (($('#event-time-start') || {}).value || '').trim() || null,
                time_end:           (($('#event-time-end') || {}).value || '').trim() || null,
                participants_count: (($('#event-participants') || {}).value || '').trim() || null,
                prizes:             (($('#event-prizes') || {}).value || '').trim() || null,
                helpers:            (($('#event-helpers') || {}).value || '').trim() || null
            };
            if (!eventData.name || !eventData.description || !eventData.organizer) { showToast('Заполните обязательные поля (*)', 'error'); return; }
            if (eventData.description.length > 500) { showToast('Описание слишком длинное (макс 500 символов)', 'error'); return; }

            var submitBtn = eventForm.querySelector('.btn-accent');
            if (submitBtn) submitBtn.disabled = true;
            try {
                if (id) {
                    await updateEvent(id, eventData);
                } else {
                    eventData.date = eventData.time_start;
                    eventData.status = 'В рассмотрении';
                    await createEvent(eventData);
                }
                hideModal('modal-event');
                eventForm.reset();
            } catch(err) {}
            if (submitBtn) submitBtn.disabled = false;
        });
    }

    // Status form with reject reason
    var statusForm = $('#status-form');
    if (statusForm) {
        var statusSelect = $('#status-select');
        if (statusSelect) {
            statusSelect.addEventListener('change', function() {
                var reasonWrap = $('#reject-reason-wrap');
                if (reasonWrap) reasonWrap.classList.toggle('hidden', statusSelect.value !== 'Отказано');
            });
        }
        statusForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var id = ($('#status-event-id') || {}).value;
            var status = ($('#status-select') || {}).value;
            var reason = (($('#reject-reason') || {}).value || '').trim();
            if (!id || !status) return;
            if (status === 'Отказано' && !reason) { showToast('Укажите причину отказа', 'error'); return; }
            try { await updateEventStatus(id, status, reason); hideModal('modal-status'); } catch(err) {}
        });
    }

    // Comment form
    var commentForm = $('#comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var eventId = ($('#comment-event-id') || {}).value;
            var textEl = $('#comment-text'), text = textEl ? textEl.value.trim() : '';
            if (!eventId || !text) return;
            var submitBtn = commentForm.querySelector('.btn-accent');
            if (submitBtn) submitBtn.disabled = true;
            try { await addComment(eventId, text); if (textEl) textEl.value = ''; renderComments(await loadComments(eventId), eventId); }
            catch(err) { showToast('Ошибка: ' + err.message, 'error'); }
            if (submitBtn) submitBtn.disabled = false;
        });
    }

    // Staff form
    var staffForm = $('#staff-form');
    if (staffForm) {
        staffForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!isEditor()) { showToast('Недостаточно прав', 'error'); return; }
            var id = ($('#staff-id') || {}).value;
            var data = {
                name:       (($('#staff-name') || {}).value || '').trim(),
                role:        ($('#staff-role') || {}).value,
                rank:        (($('#staff-rank') || {}).value || '').trim() || 'intern',
                steam_id:   (($('#staff-steam') || {}).value || '').trim(),
                join_date:   ($('#staff-join-date') || {}).value,
                discord_id: (($('#staff-discord') || {}).value || '').trim()
            };
            if (!data.name || !data.role) { showToast('Заполните обязательные поля', 'error'); return; }
            var submitBtn = staffForm.querySelector('.btn-accent');
            if (submitBtn) submitBtn.disabled = true;
            try { if (id) await updateStaff(id, data); else await createStaff(data); hideModal('modal-staff'); staffForm.reset(); } catch(err) {}
            if (submitBtn) submitBtn.disabled = false;
        });
    }

    // Create user form
    var createUserForm = $('#create-user-form');
    if (createUserForm) {
        createUserForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var userData = {
                username:     (($('#new-user-username') || {}).value || '').trim(),
                password:     (($('#new-user-password') || {}).value || '').trim(),
                display_name: (($('#new-user-display') || {}).value || '').trim(),
                role:          ($('#new-user-role') || {}).value,
                rank:         (($('#new-user-rank') || {}).value || '').trim(),
                steam_id:     (($('#new-user-steam') || {}).value || '').trim(),
                avatar_url:   (($('#new-user-avatar') || {}).value || '').trim()
            };
            if (!userData.username || !userData.password || !userData.display_name) { showToast('Заполните обязательные поля', 'error'); return; }
            if (!userData.rank) userData.rank = userData.role;
            var submitBtn = createUserForm.querySelector('.btn-accent');
            if (submitBtn) submitBtn.disabled = true;
            try { await createUser(userData); createUserForm.reset(); await renderUsersList(); } catch(err) {}
            if (submitBtn) submitBtn.disabled = false;
        });
    }

    // Modal close
    $$('.modal-close').forEach(function(btn) { btn.addEventListener('click', function() { if (btn.dataset.modal) hideModal(btn.dataset.modal); }); });
    $$('.modal-backdrop').forEach(function(backdrop) { backdrop.addEventListener('click', function() { var modal = backdrop.closest('.modal'); if (modal) modal.classList.add('hidden'); }); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') $$('.modal:not(.hidden)').forEach(function(m) { m.classList.add('hidden'); }); });
    on('auth:expired', function() { showToast('Сессия истекла', 'error'); logout(); });
}

/* ── init app ── */
async function initApp() {
    var app = $('#app');
    if (app) app.classList.remove('hidden');
    updateProfile(state.user);
    applyTheme(getSavedTheme(), false);
    applyVisualSettings(getVisualSettings());
    applyBg(getSavedBg(), false);
    renderBgGrid();
    renderThemeGrid();
    bindVisualSettings();
    syncVisualControls(getVisualSettings());
    updateFab();
    await Promise.all([renderEvents(true), renderStaff(true)]);
    renderDashboard();
}

function initMainAppParallax() {
    var bg = document.getElementById('app-bg');
    if (!bg || !getVisualSettings().animationsEnabled) return;
    var mx = 0, my = 0, cx = 0, cy = 0;
    document.addEventListener('mousemove', function(e) {
        var app = document.getElementById('app');
        if (!app || app.classList.contains('hidden') || !getVisualSettings().animationsEnabled) return;
        mx = (e.clientX / window.innerWidth - 0.5) * 24;
        my = (e.clientY / window.innerHeight - 0.5) * 24;
    });
    (function tick() {
        if (!getVisualSettings().animationsEnabled) { bg.style.transform = 'scale(1.06)'; return; }
        cx += (mx - cx) * 0.06; cy += (my - cy) * 0.06; bg.style.transform = 'scale(1.12) translate(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px)'; requestAnimationFrame(tick);
    })();
}

/* ── startup ── */
async function startApp() {
    var t0 = Date.now();
    wireUpEvents();
    applyTheme(getSavedTheme(), false);
    applyVisualSettings(getVisualSettings());
    applyBg(getSavedBg(), false);
    initMainAppParallax();

    (function ensureLoginBg() {
        var bg = BG_OPTIONS.find(function(b) { return b.id === getSavedBg(); }) || BG_OPTIONS[0];
        var loginImg = document.getElementById('login-bg-img');
        if (loginImg) loginImg.style.backgroundImage = 'url("' + bg.url + '")';
    })();

    var criticalImages = ['https://i.imgur.com/Mh98NZ5.png', 'https://i.imgur.com/IAIJe65.png'];
    var bgObj = BG_OPTIONS.find(function(b) { return b.id === getSavedBg(); });
    if (bgObj) criticalImages.push(bgObj.url);
    await preloadImages(criticalImages, 3500);

    var session = getSession();
    if (session && session.token) {
        var ls = $('#login-screen'), appEl = $('#app');
        if (ls) ls.classList.add('hidden');
        if (appEl) appEl.classList.remove('hidden');
        if (session.user) {
            state.user = session.user;
            state.canEdit = EDITOR_ROLES.indexOf(session.user.role) > -1;
            document.body.classList.toggle('can-edit', state.canEdit);
            updateProfile(session.user);
            updateFab();
        }
        setPreloaderStatus('Загрузка данных...');
        var renderPromise = Promise.all([renderEvents(true), renderStaff(true)]);
        var verifyPromise = verifySession(session);
        await renderPromise;
        hidePreloader();
        renderDashboard();
        try {
            var result = await verifyPromise;
            if (result.ok && !result.offline && result.data && result.data.user) {
                applyAuth(result.data.user, session.token);
                renderEvents(true); renderStaff(true);
            } else if (!result.ok && result.error !== 'Таймаут запроса') { logout(); showToast('Сессия истекла', 'error'); return; }
        } catch(err) { console.warn('[APP] Verify failed:', err); }
        renderBgGrid(); renderThemeGrid(); bindVisualSettings(); syncVisualControls(getVisualSettings());
    } else {
        hidePreloader();
        bindVisualSettings();
        syncVisualControls(getVisualSettings());
        var ls2 = $('#login-screen'); if (ls2) ls2.classList.remove('hidden');
    }
    console.log('[APP READY]', (Date.now() - t0) + 'ms total');
}

/* ══════════════════════════════════════════════
   LOGIN SCREEN — Eagles + Lightning
   ══════════════════════════════════════════════ */
(function initLoginEffects() {
    var _mouseX = window.innerWidth / 2, _mouseY = window.innerHeight / 2;
    var _eyesVisible = false, _lightningTimer = null, _eyeGlowTimer = null, _rafId = null;
    var EYE_BASE_L = { cx: 14.85, cy: 19.05 }, EYE_BASE_R = { cx: 29.0, cy: 19.05 };
    var PUPIL_RANGE = 0.4;
    function isLoginVisible() { var el = document.getElementById('login-screen'); return el && !el.classList.contains('hidden'); }
    document.addEventListener('mousemove', function(e) { _mouseX = e.clientX; _mouseY = e.clientY; });

    function updatePupils() {
        if (!isLoginVisible() || !getVisualSettings().animationsEnabled) return;
        [{ id: 'eagle-left', flipped: false }, { id: 'eagle-right', flipped: true }].forEach(function(cfg) {
            var container = document.getElementById(cfg.id); if (!container) return;
            var svg = container.querySelector('.eagle-svg'); if (!svg) return;
            var rect = svg.getBoundingClientRect();
            var eyeScreenY = rect.top + rect.height * 0.34;
            var eyeLeftScreenX = rect.left + rect.width * 0.34, eyeRightScreenX = rect.left + rect.width * 0.66;
            if (cfg.flipped) { eyeLeftScreenX = rect.right - rect.width * 0.34; eyeRightScreenX = rect.right - rect.width * 0.66; }
            container.querySelectorAll('.eagle-pupil').forEach(function(pupil) {
                var isLeft = pupil.classList.contains('eagle-pupil-left');
                var base = isLeft ? EYE_BASE_L : EYE_BASE_R;
                var screenX = isLeft ? eyeLeftScreenX : eyeRightScreenX;
                var dx = _mouseX - screenX, dy = _mouseY - eyeScreenY;
                var dist = Math.sqrt(dx * dx + dy * dy) || 1;
                var factor = Math.min(1, dist / 300);
                var nx = (dx / dist) * PUPIL_RANGE * factor, ny = (dy / dist) * PUPIL_RANGE * 0.7 * factor;
                if (cfg.flipped) nx = -nx;
                pupil.setAttribute('cx', String(base.cx + nx));
                pupil.setAttribute('cy', String(base.cy + ny));
            });
        });
        _rafId = requestAnimationFrame(updatePupils);
    }
    function startEyeGlow() {
        if (_eyesVisible || !getVisualSettings().animationsEnabled) return; _eyesVisible = true;
        document.querySelectorAll('.eagle-eye, .eagle-pupil').forEach(function(el) { el.classList.add('eye-visible'); });
        _rafId = requestAnimationFrame(updatePupils);
    }
    function scheduleEyeGlow() { _eyeGlowTimer = setTimeout(function() { if (isLoginVisible() && getVisualSettings().animationsEnabled) startEyeGlow(); }, 1500); }

    function createLightningBolt() {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'lightning-bolt-svg'); svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none'); svg.style.width = '100%'; svg.style.height = '100%';
        var startX = 30 + Math.random() * 40, points = [{ x: startX, y: 0 }], y = 0;
        while (y < 100) { y += 5 + Math.random() * 15; var x = points[points.length - 1].x + (Math.random() - 0.5) * 20; x = Math.max(10, Math.min(90, x)); points.push({ x: x, y: Math.min(y, 100) }); }
        var d = 'M' + points.map(function(p) { return p.x + ',' + p.y; }).join(' L');
        var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        var filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'lightning-glow'); filter.setAttribute('x', '-50%'); filter.setAttribute('y', '-50%');
        filter.setAttribute('width', '200%'); filter.setAttribute('height', '200%');
        var blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
        blur.setAttribute('stdDeviation', '1'); blur.setAttribute('result', 'glow');
        var merge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
        var mn1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode'); mn1.setAttribute('in', 'glow');
        var mn2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode'); mn2.setAttribute('in', 'SourceGraphic');
        merge.appendChild(mn1); merge.appendChild(mn2); filter.appendChild(blur); filter.appendChild(merge); defs.appendChild(filter);
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d); path.setAttribute('stroke', 'rgba(200,180,255,0.8)');
        path.setAttribute('stroke-width', '0.3'); path.setAttribute('fill', 'none');
        path.setAttribute('filter', 'url(#lightning-glow)');
        for (var i = 0; i < 2; i++) {
            var bi = Math.floor(1 + Math.random() * (points.length - 3));
            var bp = points[bi], bpts = [bp], by2 = bp.y;
            for (var j = 0; j < 3; j++) { by2 += 3 + Math.random() * 8; bpts.push({ x: bpts[bpts.length-1].x + (Math.random()-0.5)*15, y: by2 }); }
            var bpath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            bpath.setAttribute('d', 'M' + bpts.map(function(p) { return p.x+','+p.y; }).join(' L'));
            bpath.setAttribute('stroke', 'rgba(180,160,240,0.5)'); bpath.setAttribute('stroke-width', '0.15'); bpath.setAttribute('fill', 'none');
            svg.appendChild(bpath);
        }
        svg.appendChild(defs); svg.appendChild(path);
        return svg;
    }

    function triggerLightning() {
        if (!isLoginVisible()) return;
        var loginScreen = document.getElementById('login-screen'), flash = document.getElementById('lightning-flash');
        var eagleLeft = document.getElementById('eagle-left'), eagleRight = document.getElementById('eagle-right');
        if (!loginScreen || !flash) return;
        var isDouble = Math.random() > 0.6;
        var bolt = createLightningBolt(); loginScreen.appendChild(bolt);
        if (eagleLeft) eagleLeft.classList.add('lightning-reveal');
        if (eagleRight) eagleRight.classList.add('lightning-reveal');
        var bgImg = document.getElementById('login-bg-img'); if (bgImg) bgImg.classList.add('lightning-lit');
        var flashStart = performance.now();
        var flashPeaks = isDouble ? [
            { time: 0, opacity: 0.85 }, { time: 80, opacity: 0.25 }, { time: 150, opacity: 0.9 },
            { time: 350, opacity: 0.3 }, { time: 600, opacity: 0.1 }, { time: 900, opacity: 0.03 }, { time: 1300, opacity: 0 }
        ] : [
            { time: 0, opacity: 0.85 }, { time: 100, opacity: 0.5 }, { time: 250, opacity: 0.2 },
            { time: 450, opacity: 0.07 }, { time: 700, opacity: 0.02 }, { time: 1000, opacity: 0 }
        ];
        var totalDuration = isDouble ? 1300 : 1000;
        function interpolate(elapsed) {
            if (elapsed <= 0) return flashPeaks[0].opacity;
            if (elapsed >= flashPeaks[flashPeaks.length-1].time) return 0;
            for (var i2 = 0; i2 < flashPeaks.length-1; i2++) {
                var a = flashPeaks[i2], b = flashPeaks[i2+1];
                if (elapsed >= a.time && elapsed < b.time) { var t = (elapsed - a.time) / (b.time - a.time); t = t * t * (3 - 2 * t); return a.opacity + (b.opacity - a.opacity) * t; }
            }
            return 0;
        }
        var eagleFading = false, boltRemoved = false;
        function animateFlash(now) {
            if (!getVisualSettings().animationsEnabled) { flash.style.opacity = '0'; if (bolt.parentNode) bolt.parentNode.removeChild(bolt); return; }
            var elapsed = now - flashStart;
            flash.style.opacity = String(interpolate(elapsed));
            var boltOp = interpolate(elapsed * 1.3);
            bolt.style.opacity = String(Math.max(0, boltOp));
            if (!eagleFading && elapsed > (isDouble ? 300 : 150)) {
                eagleFading = true;
                if (eagleLeft) { eagleLeft.classList.remove('lightning-reveal'); eagleLeft.classList.add('lightning-fade'); }
                if (eagleRight) { eagleRight.classList.remove('lightning-reveal'); eagleRight.classList.add('lightning-fade'); }
                var bi2 = document.getElementById('login-bg-img'); if (bi2) bi2.classList.remove('lightning-lit');
            }
            if (!boltRemoved && boltOp <= 0.005) { boltRemoved = true; if (bolt.parentNode) bolt.parentNode.removeChild(bolt); }
            if (elapsed < totalDuration) { requestAnimationFrame(animateFlash); }
            else {
                flash.style.opacity = '0';
                if (!boltRemoved && bolt.parentNode) bolt.parentNode.removeChild(bolt);
                setTimeout(function() { if (eagleLeft) eagleLeft.classList.remove('lightning-fade'); if (eagleRight) eagleRight.classList.remove('lightning-fade'); }, 3000);
            }
        }
        requestAnimationFrame(animateFlash);
    }
    function scheduleLightning() {
        if (!getVisualSettings().animationsEnabled) return;
        if (!isLoginVisible()) { _lightningTimer = setTimeout(scheduleLightning, 2000); return; }
        var delay = 10000 + Math.random() * 15000;
        _lightningTimer = setTimeout(function() { if (getVisualSettings().animationsEnabled) { triggerLightning(); scheduleLightning(); } }, delay);
    }
    function initEffects() { if (!getVisualSettings().animationsEnabled) return; scheduleEyeGlow(); scheduleLightning(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initEffects, { once: true }); else initEffects();
})();

/* ══════════════════════════════════════════════
   MANUAL (enhanced)
   ══════════════════════════════════════════════ */
(function initManual() {
    var MANUAL_EDIT_ROLES = ['Глава ивент-отдела', 'DEV'];
    function canEditManual() { return state.user && MANUAL_EDIT_ROLES.indexOf(state.user.role) > -1; }
    var manualBlocks = [];
    var manualVersions = [];
    var dragIdx = -1;

    async function loadManual() {
        try { var data = await http.get('/api/manual'); if (Array.isArray(data)) return data; if (data && Array.isArray(data.blocks)) return data.blocks; return []; }
        catch(e) { return []; }
    }
    async function saveManual(blocks) {
        try {
            await http.put('/api/manual', {
                blocks: blocks,
                edited_by: state.user ? (state.user.display_name || state.user.username) : 'Unknown',
                edited_at: new Date().toISOString()
            });
            showToast('Методичка сохранена', 'success');
        } catch(e) { showToast('Ошибка сохранения: ' + e.message, 'error'); }
    }
    async function loadManualVersions() {
        try { var data = await http.get('/api/manual/versions'); return Array.isArray(data) ? data : []; } catch(e) { return []; }
    }

    function buildBlockStyle(block) {
        var s = '';
        if (block.fontSize) s += 'font-size:' + block.fontSize + ';';
        if (block.color && block.effect !== 'gradient' && block.effect !== 'animated-gradient') s += 'color:' + block.color + ';';
        if (block.effect === 'gradient' || block.effect === 'animated-gradient') s += 'background:linear-gradient(135deg,' + (block.grad1||'#ff4a4a') + ',' + (block.grad2||'#fbbf24') + ');';
        if (block.effect === 'stroke') { s += '-webkit-text-stroke:' + (block.strokeWidth||'1px') + ' ' + (block.strokeColor||'#ff4a4a') + ';'; if (block.color) s += 'color:' + block.color + ';'; }
        if (block.effect === 'neon') s += '--fx-color:' + (block.color||'#ff4a4a') + ';';
        return s;
    }
    function buildBlockClass(block) {
        var map = { gradient:'fx-gradient', stroke:'fx-stroke', neon:'fx-neon', '3d':'fx-3d', glitch:'fx-glitch', 'animated-gradient':'fx-animated-gradient' };
        return (!block.effect || block.effect === 'none') ? '' : (map[block.effect] || '');
    }

    function renderManual() {
        var container = $('#manual-content'), toolbar = $('#manual-toolbar');
        if (!container) return;
        var editor = canEditManual();
        if (toolbar) toolbar.classList.toggle('hidden', !editor);
        if (!manualBlocks.length) {
            container.innerHTML = '<div class="manual-empty"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><p>' + (editor ? 'Методичка пуста. Добавьте первый блок.' : 'Методичка пока пуста') + '</p></div>';
            return;
        }

        // Build TOC
        var tocItems = [];
        manualBlocks.forEach(function(block, idx) {
            if (block.type === 'heading') tocItems.push({ idx: idx, text: block.text || 'Без названия', level: block.headingLevel || 1 });
        });

        var tocHtml = tocItems.length ?
            '<div class="manual-toc glass-panel"><h4 class="manual-toc-title">📑 Содержание</h4>' +
            tocItems.map(function(item) {
                return '<a href="#manual-block-' + item.idx + '" class="manual-toc-link manual-toc-h' + item.level + '">' + esc(item.text) + '</a>';
            }).join('') + '</div>' : '';

        // Build search
        var searchHtml = '<div class="manual-search-wrap"><input type="text" id="manual-search" class="manual-search-input" placeholder="Поиск по методичке..." />' + IC.search + '</div>';

        var html = searchHtml + tocHtml;
        manualBlocks.forEach(function(block, idx) {
            var actions = editor ?
                '<div class="manual-block-actions">' +
                    '<button class="btn-icon" data-action="edit-block" data-idx="' + idx + '">' + IC.edit + '</button>' +
                    '<button class="btn-icon" data-action="move-up" data-idx="' + idx + '"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>' +
                    '<button class="btn-icon" data-action="move-down" data-idx="' + idx + '"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>' +
                    '<button class="btn-icon" data-action="delete-block" data-idx="' + idx + '" style="color:var(--danger);">' + IC.del + '</button>' +
                '</div>' : '';

            if (block.type === 'divider') {
                html += '<div class="manual-divider" data-idx="' + idx + '">' + actions + '</div>';
            } else if (block.type === 'heading') {
                var tag = 'h' + (block.headingLevel || 1);
                var style = buildBlockStyle(block);
                var cls = buildBlockClass(block);
                html += '<div class="manual-block" id="manual-block-' + idx + '" data-idx="' + idx + '" ' + (editor ? 'draggable="true"' : '') + '>' + actions +
                    '<' + tag + ' class="manual-heading ' + cls + '" style="' + style + '">' + esc(block.text || '') + '</' + tag + '></div>';
            } else if (block.type === 'quote') {
                html += '<div class="manual-block" data-idx="' + idx + '" ' + (editor ? 'draggable="true"' : '') + '>' + actions +
                    '<blockquote class="manual-quote">' + esc(block.text || '') + '</blockquote></div>';
            } else if (block.type === 'spoiler') {
                html += '<div class="manual-block" data-idx="' + idx + '" ' + (editor ? 'draggable="true"' : '') + '>' + actions +
                    '<details class="manual-spoiler"><summary>' + esc(block.title || 'Спойлер') + '</summary><div class="manual-spoiler-content">' + esc(block.text || '') + '</div></details></div>';
            } else if (block.type === 'list') {
                var items = (block.text || '').split('\n').filter(Boolean);
                html += '<div class="manual-block" data-idx="' + idx + '" ' + (editor ? 'draggable="true"' : '') + '>' + actions +
                    '<ul class="manual-list">' + items.map(function(item) { return '<li>' + esc(item) + '</li>'; }).join('') + '</ul></div>';
            } else if (block.type === 'important') {
                html += '<div class="manual-block" data-idx="' + idx + '" ' + (editor ? 'draggable="true"' : '') + '>' + actions +
                    '<div class="manual-important"><span class="manual-important-badge">' + esc(block.badge || '📌 Важно') + '</span><div>' + esc(block.text || '') + '</div></div></div>';
            } else {
                var style2 = buildBlockStyle(block);
                var cls2 = buildBlockClass(block);
                var textContent = esc(block.text || '');
                var dataText = block.effect === 'glitch' ? ' data-text="' + textContent + '"' : '';
                html += '<div class="manual-block" id="manual-block-' + idx + '" data-idx="' + idx + '" ' + (editor ? 'draggable="true"' : '') + '>' + actions +
                    '<div class="manual-block-text ' + cls2 + '" style="' + style2 + '"' + dataText + '>' + textContent + '</div></div>';
            }
        });
        container.innerHTML = html;

        // Search functionality
        var searchInput = $('#manual-search');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                var query = searchInput.value.toLowerCase().trim();
                container.querySelectorAll('.manual-block').forEach(function(block) {
                    var text = (block.textContent || '').toLowerCase();
                    block.style.display = !query || text.includes(query) ? '' : 'none';
                });
            });
        }

        if (editor) {
            // Drag & drop
            container.querySelectorAll('.manual-block[draggable]').forEach(function(block) {
                block.addEventListener('dragstart', function(e) {
                    dragIdx = parseInt(block.dataset.idx);
                    block.classList.add('manual-block-dragging');
                    e.dataTransfer.effectAllowed = 'move';
                });
                block.addEventListener('dragend', function() { block.classList.remove('manual-block-dragging'); dragIdx = -1; });
                block.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; block.classList.add('manual-block-dragover'); });
                block.addEventListener('dragleave', function() { block.classList.remove('manual-block-dragover'); });
                block.addEventListener('drop', function(e) {
                    e.preventDefault();
                    block.classList.remove('manual-block-dragover');
                    var dropIdx = parseInt(block.dataset.idx);
                    if (dragIdx >= 0 && dragIdx !== dropIdx) {
                        var item = manualBlocks.splice(dragIdx, 1)[0];
                        manualBlocks.splice(dropIdx, 0, item);
                        renderManual();
                    }
                });
            });

            delegateClick(container, '[data-action]', function(e, btn) {
                var action = btn.dataset.action, idx = parseInt(btn.dataset.idx);
                if (isNaN(idx)) return;
                if (action === 'edit-block') {
                    var block = manualBlocks[idx];
                    if (!block || block.type === 'divider') return;
                    var text = prompt('Редактировать текст:', block.text || '');
                    if (text === null) return;
                    block.text = text.trim();
                    var vals = getToolbarValues();
                    Object.assign(block, vals);
                    renderManual();
                } else if (action === 'delete-block' && confirm('Удалить блок?')) {
                    manualBlocks.splice(idx, 1); renderManual();
                } else if (action === 'move-up' && idx > 0) {
                    var tmp = manualBlocks[idx]; manualBlocks[idx] = manualBlocks[idx-1]; manualBlocks[idx-1] = tmp; renderManual();
                } else if (action === 'move-down' && idx < manualBlocks.length - 1) {
                    var tmp2 = manualBlocks[idx]; manualBlocks[idx] = manualBlocks[idx+1]; manualBlocks[idx+1] = tmp2; renderManual();
                }
            });
        }
    }

    function getToolbarValues() {
        return {
            fontSize:    ($('#manual-font-size') || {}).value || '1rem',
            color:       ($('#manual-color') || {}).value || '#f5eaea',
            effect:      ($('#manual-effect') || {}).value || 'none',
            grad1:       ($('#manual-grad1') || {}).value || '#ff4a4a',
            grad2:       ($('#manual-grad2') || {}).value || '#fbbf24',
            strokeColor: ($('#manual-stroke-color') || {}).value || '#ff4a4a',
            strokeWidth: ($('#manual-stroke-width') || {}).value || '1px'
        };
    }

    function addBlock(type) {
        type = type || 'text';
        var text = '', title = '', badge = '', headingLevel = 1;
        if (type === 'heading') {
            var levelStr = prompt('Уровень заголовка (1, 2, 3):', '1');
            if (levelStr === null) return;
            headingLevel = parseInt(levelStr) || 1;
            text = prompt('Текст заголовка:');
        } else if (type === 'quote') {
            text = prompt('Текст цитаты:');
        } else if (type === 'spoiler') {
            title = prompt('Заголовок спойлера:');
            if (title === null) return;
            text = prompt('Содержимое спойлера:');
        } else if (type === 'list') {
            text = prompt('Элементы списка (каждый с новой строки):');
        } else if (type === 'important') {
            badge = prompt('Бейдж (например: 📌 Важно, ⚠️ Внимание):') || '📌 Важно';
            text = prompt('Текст:');
        } else {
            text = prompt('Введите текст блока:');
        }
        if (text === null || (!text && type !== 'spoiler')) return;

        var vals = getToolbarValues();
        var block = Object.assign({ type: type, text: (text || '').trim() }, vals);
        if (type === 'heading') block.headingLevel = headingLevel;
        if (type === 'spoiler') block.title = title || 'Спойлер';
        if (type === 'important') block.badge = badge;
        manualBlocks.push(block);
        renderManual();
    }

    function wireManual() {
        var addBtn = $('#manual-add-block');
        var divBtn = $('#manual-add-divider');
        var saveBtn = $('#manual-save');
        var addHeading = $('#manual-add-heading');
        var addQuote = $('#manual-add-quote');
        var addSpoiler = $('#manual-add-spoiler');
        var addList = $('#manual-add-list');
        var addImportant = $('#manual-add-important');
        var versionsBtn = $('#manual-versions');

        if (addBtn) addBtn.addEventListener('click', function() { if (canEditManual()) addBlock('text'); });
        if (divBtn) divBtn.addEventListener('click', function() { if (canEditManual()) { manualBlocks.push({ type: 'divider' }); renderManual(); } });
        if (addHeading) addHeading.addEventListener('click', function() { if (canEditManual()) addBlock('heading'); });
        if (addQuote) addQuote.addEventListener('click', function() { if (canEditManual()) addBlock('quote'); });
        if (addSpoiler) addSpoiler.addEventListener('click', function() { if (canEditManual()) addBlock('spoiler'); });
        if (addList) addList.addEventListener('click', function() { if (canEditManual()) addBlock('list'); });
        if (addImportant) addImportant.addEventListener('click', function() { if (canEditManual()) addBlock('important'); });
        if (saveBtn) saveBtn.addEventListener('click', async function() {
            if (!canEditManual()) return;
            saveBtn.disabled = true;
            await saveManual(manualBlocks);
            saveBtn.disabled = false;
        });
        if (versionsBtn) versionsBtn.addEventListener('click', async function() {
            manualVersions = await loadManualVersions();
            renderVersionsModal();
        });
    }

    function renderVersionsModal() {
        var container = $('#manual-versions-list');
        if (!container) return;
        if (!manualVersions.length) { container.innerHTML = '<div class="comments-empty">История версий пуста</div>'; }
        else {
            container.innerHTML = manualVersions.map(function(v, i) {
                return '<div class="manual-version-item">' +
                    '<div class="manual-version-info"><strong>Версия ' + (manualVersions.length - i) + '</strong><br><span style="color:var(--text-muted);font-size:0.8rem;">' + esc(v.edited_by || '—') + ' • ' + formatDateTime(v.edited_at) + '</span></div>' +
                    '<button class="btn btn-secondary btn-sm" data-action="rollback" data-idx="' + i + '">Откатить</button></div>';
            }).join('');
            delegateClick(container, '[data-action="rollback"]', async function(e, btn) {
                var idx = parseInt(btn.dataset.idx);
                if (isNaN(idx) || !manualVersions[idx]) return;
                if (confirm('Откатить к этой версии?')) {
                    manualBlocks = JSON.parse(JSON.stringify(manualVersions[idx].blocks || []));
                    renderManual();
                    await saveManual(manualBlocks);
                    hideModal('modal-manual-versions');
                }
            });
        }
        showModal('modal-manual-versions');
    }

    on('manual:load', async function() { manualBlocks = await loadManual(); renderManual(); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireManual, { once: true }); else wireManual();
})();

/* ══════════════════════════════════════════════
   NORM (enhanced with auto-count)
   ══════════════════════════════════════════════ */
(function initNorm() {
    var normData = [];

    function getNormSettings() {
        return {
            reportType:      ($('#norm-report-type') || {}).value || 'weekly',
            eventsEnabled:  (($('#norm-events-enabled') || {}).checked) !== false,
            ticketsEnabled: (($('#norm-tickets-enabled') || {}).checked) !== false,
            eventsRequired:  parseInt(($('#norm-events-required') || {}).value) || 0,
            ticketsRequired: parseInt(($('#norm-tickets-required') || {}).value) || 0
        };
    }

    function buildNormData() {
        var staff = state.staff || [];
        if (!staff.length) { normData = []; return; }
        var existingMap = {};
        normData.forEach(function(nd) { existingMap[nd.staffId] = nd; });
        normData = staff.map(function(s) {
            var ex = existingMap[String(s.id)];
            return {
                staffId: String(s.id), name: s.name || '—', role: s.role || '',
                discord_id: s.discord_id || '', enabled: ex ? ex.enabled : true,
                eventsDone: ex ? ex.eventsDone : 0, ticketsDone: ex ? ex.ticketsDone : 0
            };
        });
    }

    function autoCountEvents() {
        var events = state.events || [];
        var approvedEvents = events.filter(function(e) { return e.status === 'Одобрено'; });
        normData.forEach(function(nd) {
            var count = approvedEvents.filter(function(ev) {
                return (ev.organizer || '').toLowerCase() === nd.name.toLowerCase() ||
                       (ev.helpers || '').toLowerCase().includes(nd.name.toLowerCase());
            }).length;
            nd.eventsDone = count;
        });
    }

    function getFilteredNorm() {
        var filterType = ($('#norm-filter-type') || {}).value || 'all';
        var filterStatus = ($('#norm-filter-status') || {}).value || 'all';
        var settings = getNormSettings();

        return normData.filter(function(nd) {
            if (filterType === 'enabled' && !nd.enabled) return false;
            if (filterType === 'senior' && SENIOR_ROLES.indexOf(nd.role) === -1) return false;
            if (filterType === 'junior' && JUNIOR_ROLES.indexOf(nd.role) === -1) return false;

            if (filterStatus !== 'all') {
                var evOk = !settings.eventsEnabled || nd.eventsDone >= settings.eventsRequired;
                var tkOk = !settings.ticketsEnabled || nd.ticketsDone >= settings.ticketsRequired;
                var allOk = evOk && tkOk;
                if (filterStatus === 'done' && !allOk) return false;
                if (filterStatus === 'notdone' && allOk) return false;
            }
            return true;
        });
    }

    function renderNorm() {
        var tbody = $('#norm-tbody'), emptyEl = $('#norm-empty');
        if (!tbody) return;
        buildNormData();
        var settings = getNormSettings();
        var evTh = $('#norm-th-events'), tkTh = $('#norm-th-tickets');
        if (evTh) evTh.classList.toggle('norm-col-hidden', !settings.eventsEnabled);
        if (tkTh) tkTh.classList.toggle('norm-col-hidden', !settings.ticketsEnabled);
        if (!normData.length) { tbody.innerHTML = ''; if (emptyEl) emptyEl.classList.remove('hidden'); return; }
        if (emptyEl) emptyEl.classList.add('hidden');

        var filtered = getFilteredNorm();
        var html = '';
        filtered.forEach(function(nd) {
            var realIdx = normData.indexOf(nd);
            var evOk = !settings.eventsEnabled || nd.eventsDone >= settings.eventsRequired;
            var tkOk = !settings.ticketsEnabled || nd.ticketsDone >= settings.ticketsRequired;
            var allOk = evOk && tkOk;
            var statusHtml = !nd.enabled ? '<span class="norm-status-off">Выключен</span>' :
                (!settings.eventsEnabled && !settings.ticketsEnabled) ? '<span class="norm-status-off">—</span>' :
                allOk ? '<span class="norm-status-done">✅ Выполнено</span>' :
                (evOk || tkOk) ? '<span class="norm-status-partial">⚠️ Частично</span>' :
                '<span class="norm-status-fail">❌ Не выполнено</span>';
            html +=
                '<tr class="' + (nd.enabled ? '' : 'norm-row-disabled') + '" data-norm-idx="' + realIdx + '">' +
                    '<td><button class="norm-toggle-btn ' + (nd.enabled ? 'active' : 'inactive') + '" data-action="toggle-norm" data-idx="' + realIdx + '">' + (nd.enabled ? IC.check : '') + '</button></td>' +
                    '<td>' + esc(nd.name) + '<span style="font-size:0.72rem;color:var(--text-muted);margin-left:6px;">' + esc(nd.role) + '</span></td>' +
                    '<td><span class="norm-discord-id copy-target" data-copy="' + esc(nd.discord_id) + '">' + esc(nd.discord_id || '—') + ' <span class="copy-icon">' + IC.copy + '</span></span></td>' +
                    '<td class="norm-input-cell ' + (settings.eventsEnabled ? '' : 'norm-col-hidden') + '"><input type="number" class="norm-done-input" value="' + nd.eventsDone + '" min="0" max="99" data-action="set-events" data-idx="' + realIdx + '" ' + (nd.enabled ? '' : 'disabled') + ' /></td>' +
                    '<td class="norm-input-cell ' + (settings.ticketsEnabled ? '' : 'norm-col-hidden') + '"><input type="number" class="norm-done-input" value="' + nd.ticketsDone + '" min="0" max="999" data-action="set-tickets" data-idx="' + realIdx + '" ' + (nd.enabled ? '' : 'disabled') + ' /></td>' +
                    '<td>' + statusHtml + '</td></tr>';
        });
        tbody.innerHTML = html;

        tbody.querySelectorAll('[data-action="set-events"]').forEach(function(inp) {
            inp.addEventListener('change', function() { var i = parseInt(inp.dataset.idx); if (!isNaN(i) && normData[i]) { normData[i].eventsDone = parseInt(inp.value)||0; updateNormStatuses(); updatePreview(); } });
        });
        tbody.querySelectorAll('[data-action="set-tickets"]').forEach(function(inp) {
            inp.addEventListener('change', function() { var i = parseInt(inp.dataset.idx); if (!isNaN(i) && normData[i]) { normData[i].ticketsDone = parseInt(inp.value)||0; updateNormStatuses(); updatePreview(); } });
        });
        delegateClick(tbody, '[data-action="toggle-norm"], .copy-target', function(e, btn) {
            if (btn.classList.contains('copy-target')) { copyToClipboard(btn.dataset.copy, 'Discord ID'); return; }
            var i = parseInt(btn.dataset.idx);
            if (!isNaN(i) && normData[i]) { normData[i].enabled = !normData[i].enabled; renderNorm(); updatePreview(); }
        });
        updatePreview();
    }

    function updateNormStatuses() {
        var settings = getNormSettings(), tbody = $('#norm-tbody');
        if (!tbody) return;
        normData.forEach(function(nd, idx) {
            var row = tbody.querySelector('[data-norm-idx="' + idx + '"]');
            if (!row) return;
            var statusTd = row.querySelector('td:last-child');
            if (!statusTd) return;
            var evOk = !settings.eventsEnabled || nd.eventsDone >= settings.eventsRequired;
            var tkOk = !settings.ticketsEnabled || nd.ticketsDone >= settings.ticketsRequired;
            var allOk = evOk && tkOk;
            statusTd.innerHTML = !nd.enabled ? '<span class="norm-status-off">Выключен</span>' :
                (!settings.eventsEnabled && !settings.ticketsEnabled) ? '<span class="norm-status-off">—</span>' :
                allOk ? '<span class="norm-status-done">✅ Выполнено</span>' :
                (evOk || tkOk) ? '<span class="norm-status-partial">⚠️ Частично</span>' :
                '<span class="norm-status-fail">❌ Не выполнено</span>';
        });
    }

    function generateReport() {
        var settings = getNormSettings();
        var enabled = normData.filter(function(nd) { return nd.enabled; });
        if (!enabled.length) return 'Нет активных участников.';
        var title = (settings.reportType === 'interim' ? 'Промежуточная' : 'Еженедельная') + ' статистика ивент состава';
        var sep = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
        var done = [], notDone = [];
        enabled.forEach(function(nd) {
            var evOk = !settings.eventsEnabled || nd.eventsDone >= settings.eventsRequired;
            var tkOk = !settings.ticketsEnabled || nd.ticketsDone >= settings.ticketsRequired;
            var allOk = evOk && tkOk;
            var mention = nd.discord_id ? '<@' + nd.discord_id.replace(/[^0-9]/g, '') + '>' : nd.name;
            var parts = [];
            if (settings.eventsEnabled) parts.push('Ивенты: **' + nd.eventsDone + '/' + settings.eventsRequired + '** ' + (evOk ? '✅' : '❌'));
            if (settings.ticketsEnabled) parts.push('Тикеты: **' + nd.ticketsDone + '/' + settings.ticketsRequired + '** ' + (tkOk ? '✅' : '❌'));
            var line = mention + ' - ' + parts.join(' | ');
            if (allOk) done.push(line); else notDone.push(line);
        });
        var lines = ['# ' + title, sep];
        if (done.length) { lines.push('###  ВЫПОЛНИЛИ НОРМУ:'); done.forEach(function(l) { lines.push(l); }); }
        if (notDone.length) { if (done.length) lines.push(''); lines.push('###  ЕЩЕ НЕ ДОДЕЛАЛИ:'); notDone.forEach(function(l) { lines.push(l); }); }
        lines.push(sep);
        if (notDone.length) { lines.push('-# У тех, кто не сделал норму, есть время до 00:00 (МСК):'); lines.push('-# Доделать норму и отправить мне в лс.'); lines.push('-# Написать мне в ЛС причину, почему норма не выполнена.'); }
        return lines.join('\n');
    }

    function updatePreview() {
        var preview = $('#norm-preview'), previewText = $('#norm-preview-text');
        if (!preview || !previewText) return;
        var hasEnabled = normData.some(function(nd) { return nd.enabled; });
        preview.classList.toggle('hidden', !hasEnabled);
        if (hasEnabled) previewText.textContent = generateReport();
    }

    function copyReport() {
        var report = generateReport();
        if (!report || report === 'Нет активных участников.') { showToast('Нет данных для копирования', 'error'); return; }
        copyToClipboard(report, 'Отчёт');
    }

    function toggleAll() {
        var allEnabled = normData.every(function(nd) { return nd.enabled; });
        normData.forEach(function(nd) { nd.enabled = !allEnabled; });
        renderNorm();
    }

    function handleCSVUpload(e) {
        var file = e.target.files[0]; if (!file) return;
        var reader = new FileReader();
        reader.onload = function(evt) { processCSV(evt.target.result); e.target.value = ''; };
        reader.readAsText(file);
    }

    function processCSV(text) {
        var lines = text.split('\n');
        var csvData = {};
        for (var i = 1; i < lines.length; i++) {
            var line = lines[i].trim(); if (!line) continue;
            var parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (parts.length >= 5) { var s64 = parts[0].trim(); var weekAmount = parseInt(parts[4].trim(), 10) || 0; if (s64) csvData[s64] = weekAmount; }
        }
        var updatedCount = 0;
        var staff = state.staff || [];
        normData.forEach(function(nd) {
            var member = staff.find(function(s) { return String(s.id) === nd.staffId; });
            if (member && member.steam_id) { var sid = steamTo64(member.steam_id); if (sid && csvData[sid] !== undefined) { nd.ticketsDone = csvData[sid]; updatedCount++; } }
        });
        if (updatedCount > 0) { showToast('Обновлено тикетов у ' + updatedCount + ' сотрудников', 'success'); renderNorm(); updatePreview(); }
        else showToast('Совпадений по SteamID не найдено', 'error');
    }

    function wireNorm() {
        var copyBtn = $('#norm-copy-btn'), toggleBtn = $('#norm-toggle-all');
        var csvBtn = $('#norm-csv-btn'), csvInput = $('#norm-csv-upload');
        var evCheck = $('#norm-events-enabled'), tkCheck = $('#norm-tickets-enabled');
        var evReq = $('#norm-events-required'), tkReq = $('#norm-tickets-required');
        var reportType = $('#norm-report-type');
        var autoCountBtn = $('#norm-auto-count');
        var normFilterType = $('#norm-filter-type'), normFilterStatus = $('#norm-filter-status');

        if (copyBtn) copyBtn.addEventListener('click', copyReport);
        if (toggleBtn) toggleBtn.addEventListener('click', toggleAll);
        if (csvBtn && csvInput) { csvBtn.addEventListener('click', function() { csvInput.click(); }); csvInput.addEventListener('change', handleCSVUpload); }
        if (evCheck) evCheck.addEventListener('change', function() { renderNorm(); });
        if (tkCheck) tkCheck.addEventListener('change', function() { renderNorm(); });
        if (evReq) evReq.addEventListener('change', function() { updateNormStatuses(); updatePreview(); });
        if (tkReq) tkReq.addEventListener('change', function() { updateNormStatuses(); updatePreview(); });
        if (reportType) reportType.addEventListener('change', function() { updatePreview(); });
        if (autoCountBtn) autoCountBtn.addEventListener('click', function() { autoCountEvents(); renderNorm(); showToast('Ивенты пересчитаны автоматически', 'success'); });
        if (normFilterType) normFilterType.addEventListener('change', function() { renderNorm(); });
        if (normFilterStatus) normFilterStatus.addEventListener('change', function() { renderNorm(); });
    }

    on('norm:load', function() { renderNorm(); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireNorm, { once: true }); else wireNorm();
})();

/* ── GO ── */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { startApp().catch(function(err) { console.error('init failed:', err); hidePreloader(); }); }, { once: true });
} else {
    startApp().catch(function(err) { console.error('init failed:', err); hidePreloader(); });
}

})();