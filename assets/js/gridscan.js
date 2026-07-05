'use strict';

/* ─── GridScan — vanilla JS port ───────────────────────────────────────────
   Requires Three.js loaded globally (see index.html script tag).
   Call: initGridScan(containerElement, props)
   Props mirror the React component (subset — no webcam/gyro needed here).
─────────────────────────────────────────────────────────────────────────── */

const GRIDSCAN_VERT = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const GRIDSCAN_FRAG = `
precision highp float;
uniform vec3  iResolution;
uniform float iTime;
uniform vec2  uSkew;
uniform float uLineThickness;
uniform vec3  uLinesColor;
uniform vec3  uScanColor;
uniform float uGridScale;
uniform float uScanOpacity;
uniform float uNoise;
uniform float uScanGlow;
uniform float uScanSoftness;
uniform float uPhaseTaper;
uniform float uScanDuration;
uniform float uScanDelay;
uniform float uScanDirection;
uniform float uLineJitter;
varying vec2 vUv;

float smoother01(float a, float b, float x){
  float t = clamp((x-a)/max(1e-5,(b-a)),0.,1.);
  return t*t*t*(t*(t*6.-15.)+10.);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 p = (2.*fragCoord - iResolution.xy) / iResolution.y;
  vec3 ro = vec3(0.);
  vec3 rd = normalize(vec3(p, 2.));
  rd.xy += uSkew * rd.z;

  float minT  = 1e20;
  float hitIsY = 1.;
  vec2  gridUV = vec2(0.);

  for(int i=0;i<4;i++){
    float isY = float(i<2);
    float pos  = mix(-0.2,0.2,float(i))*isY + mix(-0.5,0.5,float(i-2))*(1.-isY);
    float den  = isY*rd.y + (1.-isY)*rd.x;
    float t    = (pos - (isY*ro.y+(1.-isY)*ro.x)) / den;
    vec3  h    = ro + rd*t;
    bool  use  = t>0. && t<minT;
    gridUV  = use ? mix(h.zy, h.xz, isY)/max(1e-5,uGridScale) : gridUV;
    minT    = use ? t    : minT;
    hitIsY  = use ? isY  : hitIsY;
  }

  vec3 hit  = ro + rd*minT;
  float dist = length(hit - ro);
  float fade = exp(-dist*2.);

  float jAmt = clamp(uLineJitter,0.,1.);
  if(jAmt>0.){
    gridUV += vec2(
      sin(gridUV.y*2.7+iTime*1.8),
      cos(gridUV.x*2.3-iTime*1.6)
    )*(0.15*jAmt);
  }

  float fx=fract(gridUV.x), fy=fract(gridUV.y);
  float ax=min(fx,1.-fx), ay=min(fy,1.-fy);
  float wx=fwidth(gridUV.x), wy=fwidth(gridUV.y);
  float hp=max(0.,uLineThickness)*0.5;
  float lineX=1.-smoothstep(hp*wx,hp*wx+wx,ax);
  float lineY=1.-smoothstep(hp*wy,hp*wy+wy,ay);
  float lineMask=max(lineX,lineY);

  /* scan beam */
  float dur   = max(0.05, uScanDuration);
  float del   = max(0.,   uScanDelay);
  float cycle = dur+del;
  float tC    = mod(iTime,cycle);
  float sp    = clamp((tC-del)/dur,0.,1.);
  float phase = sp;
  if(uScanDirection>0.5 && uScanDirection<1.5) phase=1.-phase;
  else if(uScanDirection>1.5){
    float t2=mod(max(0.,iTime-del),2.*dur);
    phase=(t2<dur)?(t2/dur):(1.-(t2-dur)/dur);
  }
  float scanZ = phase*2.;
  float sigma = max(.001,.18*max(.1,uScanGlow)*uScanSoftness);
  float dz    = abs(hit.z-scanZ);
  float band  = exp(-.5*(dz*dz)/(sigma*sigma));
  float taper = clamp(uPhaseTaper,0.,.49);
  float hFade = smoother01(0.,taper,phase);
  float tFade = 1.-smoother01(1.-taper,1.,phase);
  float pulse = band*hFade*tFade*clamp(uScanOpacity,0.,1.);
  float aura  = exp(-.5*(dz*dz)/(sigma*sigma*4.))*0.25*hFade*tFade*clamp(uScanOpacity,0.,1.);

  vec3 color = uLinesColor*lineMask*fade
             + uScanColor*pulse
             + uScanColor*aura;

  float n = fract(sin(dot(gl_FragCoord.xy+vec2(iTime*123.4),vec2(12.9898,78.233)))*43758.5453);
  color  += (n-.5)*uNoise;
  color   = clamp(color,0.,1.);

  float alpha = clamp(max(lineMask*fade, pulse),0.,1.);
  fragColor   = vec4(color, alpha);
}

void main(){
  vec4 c;
  mainImage(c, vUv*iResolution.xy);
  gl_FragColor = c;
}
`;

function hexToLinear(hex) {
  const c = new THREE.Color(hex);
  // manual sRGB→linear
  c.r = Math.pow(c.r, 2.2);
  c.g = Math.pow(c.g, 2.2);
  c.b = Math.pow(c.b, 2.2);
  return c;
}

function smoothDampV2(cur, tgt, vel, st, dt) {
  st = Math.max(0.0001, st);
  const omega = 2 / st;
  const x = omega * dt;
  const e = 1 / (1 + x + 0.48*x*x + 0.235*x*x*x);
  let chX = cur.x - tgt.x, chY = cur.y - tgt.y;
  const tX = tgt.x, tY = tgt.y;
  const tpX = (vel.x + omega*chX)*dt, tpY = (vel.y + omega*chY)*dt;
  vel.x = (vel.x - omega*tpX)*e;
  vel.y = (vel.y - omega*tpY)*e;
  const oX = tX + (chX+tpX)*e, oY = tY + (chY+tpY)*e;
  return { x: oX, y: oY };
}

function smoothDampF(cur, tgt, vel, st, dt) {
  st = Math.max(0.0001, st);
  const omega = 2/st, x = omega*dt;
  const e = 1/(1+x+0.48*x*x+0.235*x*x*x);
  let ch = cur - tgt;
  const origTo = tgt;
  const tp = (vel.v + omega*ch)*dt;
  vel.v = (vel.v - omega*tp)*e;
  let out = tgt + (ch+tp)*e;
  if ((origTo-cur)*(out-origTo) > 0) { out = origTo; vel.v = 0; }
  return out;
}

window.initGridScan = function(container, props = {}) {
  const {
    sensitivity          = 0.55,
    lineThickness        = 1,
    linesColor           = '#2F293A',
    scanColor            = '#FFD870',   // gold to match portfolio theme
    scanOpacity          = 0.5,
    gridScale            = 0.1,
    lineJitter           = 0.1,
    scanDirection        = 'pingpong',
    noiseIntensity       = 0.01,
    scanGlow             = 0.5,
    scanSoftness         = 2,
    scanPhaseTaper       = 0.9,
    scanDuration         = 2.0,
    scanDelay            = 2.0,
    snapBackDelay        = 250,
  } = props;

  const s          = Math.min(1, Math.max(0, sensitivity));
  const skewScale  = 0.06 + (0.2  - 0.06)  * s;
  const smoothTime = 0.45 + (0.12 - 0.45)  * s;
  const yBoost     = 1.2  + (1.6  - 1.2)   * s;

  // ── renderer ────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // ── shader ──────────────────────────────────────────────────────────────
  const uniforms = {
    iResolution:   { value: new THREE.Vector3(container.clientWidth, container.clientHeight, renderer.getPixelRatio()) },
    iTime:         { value: 0 },
    uSkew:         { value: new THREE.Vector2(0, 0) },
    uLineThickness:{ value: lineThickness },
    uLinesColor:   { value: hexToLinear(linesColor) },
    uScanColor:    { value: hexToLinear(scanColor) },
    uGridScale:    { value: Math.max(1e-5, gridScale) },
    uScanOpacity:  { value: scanOpacity },
    uNoise:        { value: noiseIntensity },
    uScanGlow:     { value: scanGlow },
    uScanSoftness: { value: scanSoftness },
    uPhaseTaper:   { value: scanPhaseTaper },
    uScanDuration: { value: scanDuration },
    uScanDelay:    { value: scanDelay },
    uScanDirection:{ value: scanDirection === 'backward' ? 1 : scanDirection === 'pingpong' ? 2 : 0 },
    uLineJitter:   { value: Math.min(1, Math.max(0, lineJitter)) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader:   GRIDSCAN_VERT,
    fragmentShader: GRIDSCAN_FRAG,
    transparent:    true,
    depthWrite:     false,
    depthTest:      false,
  });

  const scene  = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad   = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  // ── input ────────────────────────────────────────────────────────────────
  const lookTgt = { x: 0, y: 0 };
  const lookCur = { x: 0, y: 0 };
  const lookVel = { x: 0, y: 0 };

  let leaveTimer = null;

  const onMove = e => {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    const rect = container.getBoundingClientRect();
    lookTgt.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
    lookTgt.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const onLeave = () => {
    if (leaveTimer) clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => { lookTgt.x = 0; lookTgt.y = 0; }, snapBackDelay);
  };
  container.addEventListener('mousemove', onMove);
  container.addEventListener('mouseleave', onLeave);

  // ── resize ───────────────────────────────────────────────────────────────
  const onResize = () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
    uniforms.iResolution.value.set(container.clientWidth, container.clientHeight, renderer.getPixelRatio());
  };
  window.addEventListener('resize', onResize);

  // ── loop ─────────────────────────────────────────────────────────────────
  let last = performance.now();
  let rafId;

  const tick = () => {
    const now = performance.now();
    const dt  = Math.min(0.1, (now - last) / 1000);
    last = now;

    const next = smoothDampV2(lookCur, lookTgt, lookVel, smoothTime, dt);
    lookCur.x = next.x; lookCur.y = next.y;

    uniforms.uSkew.value.set(lookCur.x * skewScale, -lookCur.y * yBoost * skewScale);
    uniforms.iTime.value = now / 1000;

    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  // ── cleanup (call gridscan.destroy() to remove) ──────────────────────────
  return {
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('mouseleave', onLeave);
      if (leaveTimer) clearTimeout(leaveTimer);
      material.dispose();
      quad.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };
};
