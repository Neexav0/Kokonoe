// "Ink in water": a full-screen WebGL layer behind the dark sections.
// The pointer leaves a glowing trail in the current heroine's colour; the
// trail drifts through a slow curl-noise flow field and fades. Under it, a
// soft aurora and film grain. Falls back to the CSS night colour without WebGL.
import { RM } from "./data.js";

const canvas = document.createElement("canvas");
canvas.className = "bg-gl";
canvas.setAttribute("aria-hidden", "true");
document.body.prepend(canvas);
const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" });

if (!gl) {
  canvas.remove();
  document.documentElement.classList.add("no-gl");
} else {
  document.documentElement.classList.add("has-gl");
  start();
}

function start() {
  const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
  const NOISE = `
    vec2 hash2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1. + 2. * fract(sin(p) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
      return mix(mix(dot(hash2(i), f), dot(hash2(i + vec2(1., 0.)), f - vec2(1., 0.)), u.x),
                 mix(dot(hash2(i + vec2(0., 1.)), f - vec2(0., 1.)), dot(hash2(i + vec2(1., 1.)), f - vec2(1., 1.)), u.x), u.y); }
    float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= .5; } return v; }`;

  // pass 1: advect + fade the previous trail, then add a capsule-shaped splat
  // along the pointer's path this frame (no gaps when the mouse moves fast)
  const TRAIL = `precision highp float; varying vec2 vUv;
    uniform sampler2D uPrev; uniform vec2 uA; uniform vec2 uB; uniform float uAspect; uniform float uTime;
    uniform vec3 uColor; uniform float uRadius; uniform float uDecay; uniform float uFlow;
    ${NOISE}
    float segDist(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0., 1.); return length(pa - ba * h); }
    void main(){
      vec2 q = vUv * vec2(uAspect, 1.) * 2.2 + vec2(uTime * .04, -uTime * .03);
      float e = .02;
      vec2 curl = vec2(noise(q + vec2(0., e)) - noise(q - vec2(0., e)), -(noise(q + vec2(e, 0.)) - noise(q - vec2(e, 0.)))) / (2. * e);
      vec2 uv = vUv - curl * uFlow + vec2(0., .0006); // ink rises a little, like smoke in water
      vec3 prev = texture2D(uPrev, uv).rgb;
      prev = max(prev * uDecay - .0022, 0.);
      vec2 p = vUv * vec2(uAspect, 1.);
      float d = segDist(p, uA * vec2(uAspect, 1.), uB * vec2(uAspect, 1.));
      float s = exp(-(d * d) / uRadius);
      gl_FragColor = vec4(min(prev + uColor * s, vec3(1.)), 1.);
    }`;

  // pass 2: night sky, aurora, the ink with a little chromatic split, grain
  const COMP = `precision highp float; varying vec2 vUv;
    uniform sampler2D uTrail; uniform float uTime; uniform float uAspect; uniform vec3 uAccent; uniform float uScroll; uniform vec2 uRes;
    ${NOISE}
    float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      vec3 deep = vec3(.067, .047, .173), night = vec3(.118, .090, .278);
      vec3 col = mix(deep, night, smoothstep(-.2, 1.1, uv.y));
      vec2 p = uv * vec2(uAspect, 1.);
      float a = fbm(p * 1.3 + vec2(uTime * .025, uScroll * .00012));
      float b = fbm(p * 2.4 - vec2(uTime * .02, 0.) + a);
      col += uAccent * smoothstep(.05, .75, b) * .22;
      col += vec3(.24, .42, .9) * smoothstep(.35, .9, a) * .08;
      vec2 off = vec2(.0035, 0.);
      vec3 t = vec3(texture2D(uTrail, uv + off).r, texture2D(uTrail, uv).g, texture2D(uTrail, uv - off).b);
      col += t * .62 + pow(t, vec3(2.)) * .22;
      float st = step(.9975, rand(floor(uv * uRes / 3.))) * (.4 + .6 * sin(uTime * 2. + rand(floor(uv * uRes / 3.)) * 40.));
      col += st * .35;
      col += (rand(uv * uRes + fract(uTime)) - .5) * .035;
      float v = smoothstep(1.25, .35, length((uv - .5) * vec2(uAspect, 1.)));
      gl_FragColor = vec4(col * mix(.7, 1., v), 1.);
    }`;

  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const program = (fs) => { const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p); return p; };
  let trailProg, compProg;
  try { trailProg = program(TRAIL); compProg = program(COMP); }
  catch (err) { console.warn("Kokonoe background disabled:", err.message); canvas.remove(); document.documentElement.classList.replace("has-gl", "no-gl"); return; }
  const U = (p, names) => Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));
  const tu = U(trailProg, ["uPrev", "uA", "uB", "uAspect", "uTime", "uColor", "uRadius", "uDecay", "uFlow"]);
  const cu = U(compProg, ["uTrail", "uTime", "uAspect", "uAccent", "uScroll", "uRes"]);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // two trail targets to ping-pong between
  let W = 0, H = 0, TW = 0, TH = 0;
  const targets = [0, 1].map(() => ({ tex: gl.createTexture(), fb: gl.createFramebuffer() }));
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.25);
    W = Math.max(1, Math.round(innerWidth * dpr)); H = Math.max(1, Math.round(innerHeight * dpr));
    canvas.width = W; canvas.height = H;
    TW = Math.max(1, Math.round(innerWidth / 3)); TH = Math.max(1, Math.round(innerHeight / 3));
    targets.forEach((t) => {
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TW, TH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  resize();
  addEventListener("resize", resize);

  /* -------------------------------------------------------------- input */
  const hexToRgb = (h) => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  let accent = hexToRgb("#ff3b5f"), accentTarget = accent.slice();
  addEventListener("koko:accent", (e) => { accentTarget = hexToRgb(e.detail); });

  let mx = 0.5, my = 0.5, pmx = 0.5, pmy = 0.5, speed = 0, lastMove = 0;
  addEventListener("pointermove", (e) => {
    mx = e.clientX / innerWidth; my = 1 - e.clientY / innerHeight;
    lastMove = performance.now();
  }, { passive: true });

  let scrollY0 = scrollY, scrollVel = 0;

  /* --------------------------------------------------------------- loop */
  let src = 0, last = performance.now(), t0 = last;
  const paperSections = () => [...document.querySelectorAll(".pencil, .pick, .tiers")];
  let papers = paperSections();
  function covered() {
    // a light section fills the screen: nothing of the background shows
    for (const el of papers) { const r = el.getBoundingClientRect(); if (r.top <= 0 && r.bottom >= innerHeight) return true; }
    return document.documentElement.classList.contains("locked"); // a sheet or dialog covers it
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const time = RM ? 0 : (now - t0) / 1000;
    for (let i = 0; i < 3; i++) accent[i] += (accentTarget[i] - accent[i]) * Math.min(1, dt * 3);
    scrollVel += ((scrollY - scrollY0) - scrollVel) * 0.2; scrollY0 = scrollY;

    if (!covered()) {
      // idle "ghost brush": keeps the water alive when nobody is moving the mouse
      const idle = now - lastMove > 1800;
      let ax = pmx, ay = pmy, bx = mx, by = my;
      if (idle) {
        bx = 0.5 + Math.sin(time * 0.31) * 0.34 + Math.sin(time * 0.77) * 0.08;
        by = 0.5 + Math.cos(time * 0.23) * 0.3 + Math.sin(time * 0.51) * 0.07;
      }
      const move = Math.hypot((bx - ax) * innerWidth, (by - ay) * innerHeight);
      speed += (move - speed) * 0.3;
      const strength = RM ? 0 : Math.min(0.4, (idle ? 0.011 : 0.012) + speed * 0.009) + Math.min(0.25, Math.abs(scrollVel) * 0.004);

      // trail pass
      const dst = 1 - src;
      gl.viewport(0, 0, TW, TH);
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets[dst].fb);
      gl.useProgram(trailProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[src].tex);
      gl.uniform1i(tu.uPrev, 0);
      gl.uniform2f(tu.uA, ax, ay);
      gl.uniform2f(tu.uB, bx, by);
      gl.uniform1f(tu.uAspect, innerWidth / innerHeight);
      gl.uniform1f(tu.uTime, time);
      const c = accent.map((v) => (v * 0.85 + 0.15) * strength);
      gl.uniform3f(tu.uColor, c[0], c[1], c[2]);
      gl.uniform1f(tu.uRadius, 0.0009 + Math.min(0.004, speed * 0.00004));
      gl.uniform1f(tu.uDecay, RM ? 0.9 : 0.962);
      gl.uniform1f(tu.uFlow, RM ? 0 : 0.0016);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = dst;
      pmx = bx; pmy = by;

      // composite
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(compProg);
      gl.bindTexture(gl.TEXTURE_2D, targets[src].tex);
      gl.uniform1i(cu.uTrail, 0);
      gl.uniform1f(cu.uTime, time);
      gl.uniform1f(cu.uAspect, innerWidth / innerHeight);
      gl.uniform3f(cu.uAccent, accent[0], accent[1], accent[2]);
      gl.uniform1f(cu.uScroll, scrollY);
      gl.uniform2f(cu.uRes, W, H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  addEventListener("load", () => { papers = paperSections(); });
}

/* Any module can tint the water: dispatchEvent(new CustomEvent("koko:accent", { detail: "#ff3b5f" })) */
export function tint(hex) { dispatchEvent(new CustomEvent("koko:accent", { detail: hex })); }
