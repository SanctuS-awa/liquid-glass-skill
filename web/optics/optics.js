"use strict";

window.Tideline = (() => {
  const PI = Math.PI;
  const clamp = (value, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value));
  const mod = (value, period) => (value % period + period) % period;
  const mix = (a, b, weight) => a + (b - a) * weight;
  const smooth = value => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  };
  const tuning = {
    normalGain: .38,
    faceDepth: .46,
    faceGain: .37,
    rimWidth: .054,
    rimTravel: 1.92,
    wideBlurMix: .43,
    wideBlurRatio: 2.5,
    bloomStrength: 1.03,
    tintReach: .23,
    tintStrength: .93,
  };

  // Arclength starts at top centre and runs clockwise in CSS coordinates.
  function profile(width, height, radius) {
    const hx = width / 2;
    const hy = height / 2;
    const a = hx - radius;
    const b = hy - radius;
    const arc = PI * radius / 2;
    const q = a + b + arc;
    const perimeter = 4 * q;
    const short = Math.min(width, height);
    const right = a + arc;
    const bottomArc = right + 2 * b;
    const bottom = bottomArc + arc;
    const leftArc = bottom + 2 * a;
    const left = leftArc + arc;
    const topArc = left + 2 * b;
    const top = topArc + arc;
    const straightDepth = Math.min(short * .26, short * .137 + radius * .19, 58);
    const curveDepth = Math.min(short * .28, radius * .81, 65);
    const rimWidth = Math.max(2.2, Math.min(8.4, short * tuning.rimWidth / 2));
    const travel = Math.min(perimeter * .309, short * tuning.rimTravel / 2);
    const runX = Math.min(a * .43, straightDepth * .52);
    const runY = Math.min(b * .43, straightDepth * .52);
    const circular = a < .01 && b < .01;
    const cornerStart = [a, bottomArc, leftArc, topArc];
    const geometry = { x: 0, y: 0, nx: 0, ny: 0, depth: 0, run: 0 };

    function point(s, out = geometry) {
      s = mod(s, perimeter);
      let x, y, nx, ny, depth = straightDepth, run = 0;
      if (circular) {
        const theta = s / radius - PI / 2;
        nx = Math.cos(theta);
        ny = Math.sin(theta);
        x = radius * nx;
        y = radius * ny;
        depth = curveDepth;
      } else if (s < a || s >= top) {
        x = s < a ? s : s - perimeter;
        y = -hy;
        nx = 0;
        ny = -1;
        run = runX * Math.sin(x / a * PI / 2);
      } else if (s >= right && s < bottomArc) {
        x = hx;
        y = s - q;
        nx = 1;
        ny = 0;
        run = runY * Math.sin(y / b * PI / 2);
      } else if (s >= bottom && s < leftArc) {
        x = 2 * q - s;
        y = hy;
        nx = 0;
        ny = 1;
        run = runX * Math.sin(-x / a * PI / 2);
      } else if (s >= left && s < topArc) {
        x = -hx;
        y = 3 * q - s;
        nx = -1;
        ny = 0;
        run = runY * Math.sin(-y / b * PI / 2);
      } else {
        const corner = s < right ? 0 : s < bottom ? 1 : s < left ? 2 : 3;
        const u = (s - cornerStart[corner]) / arc;
        const theta = (u + corner - 1) * PI / 2;
        nx = Math.cos(theta);
        ny = Math.sin(theta);
        x = (corner < 2 ? a : -a) + radius * nx;
        y = (corner === 1 || corner === 2 ? b : -b) + radius * ny;
        const from = corner % 2 === 0 ? runX : runY;
        const to = corner % 2 === 0 ? runY : runX;
        run = mix(from, -to, smooth(u));
        const curvature = from && to ? Math.sin(PI * u) ** 2
          : (from ? Math.sin(PI * u / 2) : Math.cos(PI * u / 2)) ** 2;
        depth = mix(straightDepth, curveDepth, curvature);
      }
      Object.assign(out, { x: hx + x, y: hy + y, nx, ny, depth, run });
      return out;
    }

    function locate(x, y, out) {
      x -= hx;
      y -= hy;
      const ax = Math.abs(x) - a;
      const ay = Math.abs(y) - b;
      if (ax > 0 && ay > 0) {
        const theta = Math.atan2(ay, ax);
        out.d = radius - Math.hypot(ax, ay);
        if (x >= 0) out.s = y < 0 ? a + radius * (PI / 2 - theta) : bottomArc + radius * theta;
        else out.s = y >= 0 ? leftArc + radius * (PI / 2 - theta) : topArc + radius * theta;
      } else if (ax > ay) {
        out.d = radius - ax;
        out.s = x >= 0 ? q + y : 3 * q - y;
      } else {
        out.d = radius - ay;
        out.s = y < 0 ? x : 2 * q - x;
      }
      out.s = mod(out.s, perimeter);
      return out;
    }

    function coordinate(s, d, stage, out = new Float32Array(2), offset = 0) {
      point(s);
      if (stage > 1) {
        const faceWidth = geometry.depth * tuning.faceDepth;
        const falloff = 1 - clamp(d / faceWidth);
        s -= geometry.run * smooth(falloff);
        d += faceWidth * tuning.faceGain * falloff ** 2;
        point(s);
      }
      if (stage > 0) d += geometry.depth * tuning.normalGain * (1 - clamp(d / geometry.depth)) ** 2;
      out[offset] = geometry.x - geometry.nx * d;
      out[offset + 1] = geometry.y - geometry.ny * d;
      return out;
    }

    function rightSide(s) {
      const t = mod(s, perimeter);
      const cut = t <= 2 * q ? Math.min(t, 2 * q - t) : Math.max(2 * q - t, t - perimeter);
      const width = Math.max(1.6, rimWidth * .27);
      return smooth(.5 + cut / (2 * width));
    }

    function rim(s, d, coordinates, offset, weights, woffset) {
      if (d >= rimWidth) return;
      const u = clamp(d / rimWidth);
      // Inverting travel gives tail edges that narrow with arclength.
      const distance = travel * (1 - u) ** 1.82;
      const rightSource = s - distance;
      const leftSource = s + distance;
      const fromRight = rightSide(rightSource);
      const fromLeft = 1 - rightSide(leftSource);
      // Opposite sources use two depths in the shared region.
      const lane = smooth((u - .30) / .44);
      const rightWeight = fromRight * (1 - fromLeft * lane);
      const leftWeight = fromLeft * (1 - fromRight * (1 - lane));
      const join = smooth((1 - u) / .18);
      weights[woffset] = rightWeight * join;
      weights[woffset + 1] = leftWeight * join;
      coordinate(rightSource, d, 2, coordinates, offset);
      coordinate(leftSource, d, 2, coordinates, offset + 2);
    }

    function highlight(s, d, smoothPixel = false) {
      point(s);
      const x = (geometry.x - hx) / hx, y = (geometry.y - hy) / hy;
      const f = depth => window.RimLight.gain(x,y,geometry.nx,geometry.ny,depth);
      if (!smoothPixel) return f(d);
      return (f(Math.max(0,d-.31))+f(d)+f(d+.31))/3;
    }

    return { width, height, radius, hx, hy, q, perimeter, rimWidth, travel, straightDepth, curveDepth,
      point, locate, coordinate, rim, highlight };
  }

  const vertex = '#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(2.0*p-1.0,0,1);}';
  const prefix = '#version 300 es\nprecision highp float;\nprecision highp int;\nout vec4 dst;\n';
  const refract = String.raw`
uniform sampler2D uBack, uShape, uMap, uRim, uWeights;
uniform vec2 uBackSize, uOrigin;
uniform float uScale;
uniform int uStage;
vec3 wallpaper(vec2 p) {
  return texture(uBack,(uOrigin+p*uScale)/uBackSize).rgb;
}
void main() {
  ivec2 pixel=ivec2(gl_FragCoord.xy);
  vec4 shape=texelFetch(uShape,pixel,0);
  if (shape.a<=0.0) {dst=vec4(0);return;}
  vec2 p=gl_FragCoord.xy/uScale;
  vec4 mapping=texelFetch(uMap,pixel,0);
  if(uStage==1) p=mapping.xy;
  if(uStage>=2) p=mapping.zw;
  vec3 rgb=wallpaper(p);
  if(uStage>=3) {
    vec2 w=texelFetch(uWeights,pixel,0).rg;
    if(w.x+w.y>0.0){
      vec4 rim=texelFetch(uRim,pixel,0);
      rgb=rgb*(1.0-w.x-w.y)+wallpaper(rim.xy)*w.x+wallpaper(rim.zw)*w.y;
    }
  }
  dst=vec4(rgb*shape.a,shape.a);
}
`;
  const blur = String.raw`
uniform sampler2D uInput;
uniform vec2 uStep, uSize;
uniform int uEnergy, uLegacy;
vec4 readPixel(vec2 uv) {
  vec4 src=texture(uInput,uv);
  if(uEnergy==0) return src;
  vec3 rgb=src.rgb/max(src.a,.0001);
  float peak=max(rgb.r,max(rgb.g,rgb.b));
  float energy=uLegacy!=0 ? pow(peak,1.40) : peak*smoothstep(.055,.58,peak);
  return vec4(src.rgb*energy,src.a);
}
void main() {
  vec2 uv=gl_FragCoord.xy/uSize;
  vec4 c=readPixel(uv)*.227027;
  c+=(readPixel(uv+uStep*1.384615)+readPixel(uv-uStep*1.384615))*.316216;
  c+=(readPixel(uv+uStep*3.230769)+readPixel(uv-uStep*3.230769))*.070270;
  dst=c;
}
`;
  // Reduce consistently before blurring. Sparse taps directly against the
  // full-size image left transparent holes and detached bands beside narrow lights.
  const reduce = String.raw`
uniform sampler2D uInput;
uniform vec2 uSize, uFoot;
uniform int uEnergy;
vec4 sampleMasked(vec2 uv) {
  vec4 src=texture(uInput,uv);
  if(uEnergy==0) return src;
  vec3 rgb=src.rgb/max(src.a,.0001);
  float peak=max(rgb.r,max(rgb.g,rgb.b));
  return vec4(src.rgb*peak*smoothstep(.035,.287,peak),src.a);
}
void main() {
  vec2 p=gl_FragCoord.xy/uSize, q=uFoot*.25;
  dst=.25*(sampleMasked(p+q)+sampleMasked(p-q)+
             sampleMasked(p+vec2(q.x,-q.y))+sampleMasked(p+vec2(-q.x,q.y)));
}
`;
  const gauss = String.raw`
uniform sampler2D uInput;
uniform vec2 uSize, uDirection;
uniform float uCenter;
uniform vec2 uPairs[12];
uniform int uCount;
void main() {
  vec2 p=gl_FragCoord.xy/uSize;
  vec4 sum=texture(uInput,p)*uCenter;
  for(int i=0;i<12;i++){
    if(i>=uCount) break;
    vec2 q=uDirection*uPairs[i].x;
    sum+=(texture(uInput,p+q)+texture(uInput,p-q))*uPairs[i].y;
  }
  dst=sum;
}
`;
  const detectContact = String.raw`
uniform sampler2D uRaw, uEdge, uBack;
uniform vec2 uSize, uBackSize, uOrigin;
uniform float uScale;
uniform int uCount;
uniform vec2 uContactWindow;
void main(){
  int x=int(gl_FragCoord.x);
  float s=(float(x)+.5)/float(uCount);
  vec3 color=vec3(0);
  float amount=0.0;
  bool masked=uContactWindow.y>0.0 && abs(fract(s-uContactWindow.x+.5)-.5)>uContactWindow.y;
  for(int i=0;i<3;i++){
    vec4 g=texelFetch(uEdge,ivec2(x,i),0);
    vec4 raw=texture(uRaw,g.xy*uScale/uSize);
    vec3 incoming=raw.rgb/max(.0001,raw.a);
    vec3 original=texture(uBack,(uOrigin+uScale*g.xy)/uBackSize).rgb;
    vec3 delta=incoming-original;
    float newLight=max(delta.r,max(delta.g,delta.b));
    float intensity=max(incoming.r,max(incoming.g,incoming.b));
    float chroma=intensity-min(incoming.r,min(incoming.g,incoming.b));
    float a=smoothstep(.013,.145,newLight)*smoothstep(.035,.19,chroma);
    a*=smoothstep(.013,.25,g.z)*smoothstep(.38,.88,raw.a);
    if(a>amount) {color=incoming;amount=a;}
  }
  float peak=max(.0001,max(color.r,max(color.g,color.b)));
  dst=vec4(color/peak,masked?0.0:amount);
}
`;
  const extendContact = String.raw`
uniform sampler2D uDirect;
uniform int uCount, uReach;
void main() {
  int pos=int(gl_FragCoord.x);
  vec4 own=texelFetch(uDirect,ivec2(pos,0),0);
  vec3 sum=vec3(0.0);
  float weight=0.0, strongest=0.0;
  for(int j=-112;j<=112;j++){
    if(abs(j)>uReach)continue;
    int lookup=(pos+j+uCount)%uCount;
    vec4 other=texelFetch(uDirect,ivec2(lookup,0),0);
    float v=other.a*(1.0-smoothstep(0.0,1.0,float(abs(j))/float(uReach+1)));
    float w=v*v*v*v*v*v;
    sum+=other.rgb*w;
    weight+=w;
    strongest=max(strongest,v);
  }
  vec3 rgb=mix(sum/max(weight,.0000001),own.rgb,smoothstep(.32,.92,own.a)*.62);
  dst=vec4(rgb,strongest);
}
`;
  const resolveAmbient = String.raw`
uniform sampler2D uBack, uBoundary;
uniform vec2 uBackSize, uOrigin;
uniform float uScale, uRadius;
${window.RimLight.glsl}
vec3 backdrop(vec2 p) { return texture(uBack,(uOrigin+uScale*p)/uBackSize).rgb; }
void main() {
  vec4 g=texelFetch(uBoundary,ivec2(int(gl_FragCoord.x),0),0);
  vec2 n=g.zw*uRadius, t=vec2(-n.y,n.x);
  vec3 sum=vec3(0);
  ${window.RimLight.kernel.map(([x,y,w]) =>
    `sum+=backdrop(g.xy+t*${x.toFixed(1)}+n*${y.toFixed(1)})*${w.toFixed(1)};`).join("\n")}
  dst=vec4(ambientLight(sum/${window.RimLight.total.toFixed(1)}),1.0);
}
`;
  const finish = String.raw`
uniform sampler2D uBack, uRaw, uShape, uSoft, uWide, uHalo, uTint, uAmbient;
uniform vec2 uBackSize, uSize, uOrigin;
uniform float uMix, uBloomStrength, uTintStrength, uRimWidth;
uniform vec3 uOrdinary;
uniform int uStage, uBloom, uCount, uLegacy, uPrevious;
vec3 srgb(vec3 x) {
  x=clamp(x,0.0,1.0);
  return mix(12.92*x, 1.055*pow(x,vec3(1.0/2.4))-.055,step(.0031308,x));
}
vec3 unmask(vec4 color) {return color.rgb/max(color.a,.0001);}
void main() {
  vec2 pixel=vec2(gl_FragCoord.x,uBackSize.y-gl_FragCoord.y);
  vec3 back=texture(uBack,pixel/uBackSize).rgb;
  vec2 rel=pixel-uOrigin;
  if(uStage==0 || any(lessThan(rel,vec2(0))) || any(greaterThanEqual(rel,uSize))) {
    dst=vec4(srgb(back),1);return;
  }
  vec2 uv=rel/uSize;
  vec4 shape=texelFetch(uShape,ivec2(rel),0);
  if(shape.a<=0.0) {dst=vec4(srgb(back),1);return;}
  vec4 raw=texture(uRaw,uv);
  vec3 glass=unmask(raw);
  if(uStage>=4) {
    vec3 soft=unmask(texture(uSoft,uv));
    vec3 wide=unmask(texture(uWide,uv));
    float inner=smoothstep(0.0,uRimWidth*1.8,shape.g);
    vec3 ordinary=mix(soft,wide,uMix*mix(uOrdinary.x,1.0,inner));
    glass=mix(glass,ordinary,mix(uOrdinary.y,uOrdinary.z,inner));
    if(uBloom!=0) {
      vec3 halo=unmask(texture(uHalo,uv));
      // Use the already softened local baseline, rather than carving the raw
      // source's sharp contour out of the halo. Flat colours still cancel.
      vec3 rgb=(uLegacy!=0 || uPrevious!=0) ? unmask(raw) : ordinary;
      float peak=max(rgb.r,max(rgb.g,rgb.b));
      float energy=uLegacy!=0 ? pow(peak,1.40) : peak*smoothstep(uPrevious!=0?.055:.035,uPrevious!=0?.58:.287,peak);
      vec3 core=rgb*energy;
      vec3 spread=max(vec3(0),halo-core*(uLegacy!=0 ? .74 : 1.0));
      if(uLegacy==0) {
        spread *= smoothstep(vec3(uPrevious!=0?.00065:.00025),vec3(uPrevious!=0?.00385:.00225),spread);
        if(uPrevious!=0) spread *= 1.0-.52*smoothstep(vec3(0),vec3(.080),abs(soft-wide));
      }
      spread *= uBloomStrength;
      glass+=spread*(1.0-glass);
    }
  }
  vec3 composed=mix(back,glass,shape.a);
  if(uStage>=5 && shape.b>0.0) {
    float index=shape.r*float(uCount)-.5;
    int lo=int(floor(index));
    ivec2 first=ivec2((lo+uCount)%uCount,0), second=ivec2((lo+1+uCount)%uCount,0);
    vec3 light=mix(texelFetch(uAmbient,first,0).rgb,texelFetch(uAmbient,second,0).rgb,fract(index));
    if(uStage>=6) {
      vec4 tint=mix(texelFetch(uTint,ivec2((lo+uCount)%uCount,0),0),
                   texelFetch(uTint,ivec2((lo+1+uCount)%uCount,0),0),fract(index));
      // Keep lightness independently from the colour of the incident ray.
      // Additive lift keeps the incoming hue ordering even when there is little headroom.
      vec3 hue=tint.rgb;
      float y=dot(hue,vec3(.2126,.7152,.0722));
      float chroma=.63;
      vec3 colored=vec3(.820)+chroma*(hue-y);
      float peak=max(colored.r,max(colored.g,colored.b));
      colored=vec3(.823)+(colored-vec3(.823))*min(1.0,.177/max(.001,peak-.823));
      light=mix(light,colored,tint.a*uTintStrength);
    }
    composed=mix(composed,light,shape.b);
  }
  dst=vec4(srgb(composed),1);
}
`;

  function renderer(canvas) {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
    if (!gl) throw new Error("WebGL 2 不可用");
    const floating = !!gl.getExtension("EXT_color_buffer_float");
    gl.disable(gl.DITHER);
    const opaqueTex = floating ? gl.RGBA16F : gl.RGBA8;

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
      }
      return shader;
    }

    const vs = compile(gl.VERTEX_SHADER, vertex);
    function makeProgram(source) {
      const fs = compile(gl.FRAGMENT_SHADER, prefix + source);
      const id = gl.createProgram();
      gl.attachShader(id, vs);
      gl.attachShader(id, fs);
      gl.linkProgram(id);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(id, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(id));
      return { id, locations: new Map() };
    }

    const programs = [wallpaperSource, refract, blur, reduce, gauss, detectContact, extendContact, resolveAmbient, finish].map(makeProgram);
    gl.deleteShader(vs);
    gl.bindVertexArray(gl.createVertexArray());

    function texture(width, height, data, linear = false) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, data ? gl.RGBA32F : opaqueTex,
        width, height, 0, gl.RGBA, data ? gl.FLOAT : floating ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, data);
      return { tex, width, height };
    }

    function target(width, height) {
      const buffer = texture(width, height, null, true);
      buffer.fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, buffer.tex, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("无法创建成像缓冲区");
      }
      return buffer;
    }

    function release(buffer) {
      gl.deleteTexture(buffer.tex);
      if (buffer.fb) gl.deleteFramebuffer(buffer.fb);
    }

    function pass(program, output, uniforms, textures = {}) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, output?.fb ?? null);
      gl.viewport(0, 0, output?.width ?? canvas.width, output?.height ?? canvas.height);
      gl.useProgram(program.id);
      const location = name => {
        if (!program.locations.has(name)) program.locations.set(name, gl.getUniformLocation(program.id, name));
        return program.locations.get(name);
      };
      for (const [name, [method, ...args]] of Object.entries(uniforms)) gl[method](location(name), ...args);
      let unit = 0;
      for (const [name, buffer] of Object.entries(textures)) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, buffer.tex);
        gl.uniform1i(location(name), unit++);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    const f = value => ["uniform1f", value];
    const i = value => ["uniform1i", value];
    const v = (x, y) => ["uniform2f", x, y];
    const size = buffer => v(buffer.width, buffer.height);
    let scene, maps, scale, inputSource;
    let customSource = false;

    function resize(width, height, ratio) {
      scale = ratio;
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      if (scene && scene.width === w && scene.height === h) return;
      canvas.width = w;
      canvas.height = h;
      if (scene) release(scene);
      scene = target(w, h);
    }

    function prepare(w, h, radius) {
      const width = Math.max(2, Math.round(w * scale));
      const height = Math.max(2, Math.round(h * scale));
      const key = [w, h, radius, scale].join("/");
      if (maps?.key === key) return maps.geometry;
      if (maps) for (const buffer of maps.buffers) release(buffer);
      const geometry = profile(w, h, radius);
      const shape = new Float32Array(width * height * 4);
      const mat = new Float32Array(shape.length);
      const rim = new Float32Array(shape.length);
      const weights = new Float32Array(shape.length);
      const loc = {};
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const p = (x + .5) / scale, q = (y + .5) / scale;
          const at = 4 * (x + y * width);
          geometry.locate(p, q, loc);
          const alpha = clamp(.5 + loc.d * scale);
          if (!alpha) continue;
          const depth = Math.max(0, loc.d);
          shape[at] = loc.s / geometry.perimeter;
          shape[at + 1] = depth;
          shape[at + 2] = geometry.highlight(loc.s, depth, true) * alpha;
          shape[at + 3] = alpha;
          if (depth <= Math.max(geometry.straightDepth, geometry.curveDepth)) {
            geometry.coordinate(loc.s, depth, 1, mat, at);
            geometry.coordinate(loc.s, depth, 2, mat, at + 2);
            geometry.rim(loc.s, depth, rim, at, weights, at);
          } else {
            mat[at] = mat[at + 2] = p;
            mat[at + 1] = mat[at + 3] = q;
          }
        }
      }
      const n = Math.ceil(geometry.perimeter / .85);
      const edge = new Float32Array(n * 3 * 4);
      const boundary = new Float32Array(n * 4);
      for (let y = 0; y < 3; y++) {
        const d = [.53, 1.12, 1.76][y];
        for (let x = 0; x < n; x++) {
          const s = (x + .5) / n * geometry.perimeter;
          const p = geometry.point(s);
          const at = 4 * (x + y * n);
          edge[at] = p.x - p.nx * d;
          edge[at + 1] = p.y - p.ny * d;
          edge[at + 2] = geometry.highlight(s, d);
          if (y===0) boundary.set([p.x,p.y,p.nx,p.ny],x*4);
        }
      }
      const shapeTex = texture(width, height, shape);
      const mapTex = texture(width, height, mat);
      const rimTex = texture(width, height, rim);
      const weightTex = texture(width, height, weights);
      const edgeTex = texture(n, 3, edge);
      const boundaryTex = texture(n, 1, boundary);
      const raw = target(width, height);
      const reduced = divisor => target(Math.ceil(width / divisor), Math.ceil(height / divisor));
      const softX = reduced(2), soft = reduced(2), wideX = reduced(3), wide = reduced(3);
      const haloX = reduced(4), halo = reduced(4);
      const softBase=reduced(2), wideBase=reduced(3), haloBase=reduced(4);
      const direct = target(n, 1), tint = target(n, 1), ambient = target(n,1);
      const buffers = [shapeTex, mapTex, rimTex, weightTex, edgeTex, boundaryTex, raw, softX, soft, wideX, wide, haloX, halo, softBase, wideBase, haloBase, direct, tint, ambient];
      maps = { key, geometry, n, shapeTex, mapTex, rimTex, weightTex, edgeTex, boundaryTex, raw,
        softX, soft, wideX, wide, haloX, halo, softBase, wideBase, haloBase, direct, tint, ambient, buffers, kernels: new Map() };
      return geometry;
    }

    function render(frame) {
      const [pScene, pRaw, pBlur, pReduce, pGaussian, pContact, pExtend, pAmbient, pFinal] = programs;
      const { raw, shapeTex, mapTex, rimTex, weightTex, edgeTex, boundaryTex, softX, soft, wideX, wide,
        haloX, halo, softBase, wideBase, haloBase, direct, tint, ambient, geometry, n, kernels } = maps;
      const origin = v(Math.round(frame.x * scale), Math.round(frame.y * scale));
      const backSize = size(scene);
      const common = { uOrigin: origin, uSize: size(raw), uBackSize: backSize, uScale: f(scale) };
      if(frame.sourceCanvas) {
        if(!inputSource) inputSource=gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,inputSource);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.SRGB8_ALPHA8,gl.RGBA,gl.UNSIGNED_BYTE,frame.sourceCanvas);
        customSource=true;
      } else {
        customSource=false;
        pass(pScene, scene, {
        uSize: backSize, uTime: f(frame.time), uScale: f(scale), uPlate: i(frame.plate),
        uProbes: i(frame.probes), uCase: i(frame.testCase), uFixture: ["uniform4f", ...frame.fixture],
        "uMarkers[0]": ["uniform2fv", frame.markers], uShift: v(...frame.shift),
        uContactColor: ["uniform3f", ...frame.color],
        });
      }
      const backdrop = customSource ? {tex:inputSource} : scene;
      const material = window.L4Material.resolve(geometry,frame);
      if (frame.stage > 0) {
        pass(pRaw, raw, { ...common, uStage: i(frame.stage) },
          { uBack: backdrop, uShape: shapeTex, uMap: mapTex, uRim: rimTex, uWeights: weightTex });
      }

      if (frame.stage >= 4) {
        const filtered = (base, horizontal, vertical, sigma, energy = 0) => {
          if(frame.previousL4 || frame.legacyL4) {
            const stride = sigma / 1.64;
            pass(pBlur, horizontal, { uSize: size(horizontal), uStep: v(stride / raw.width, 0), uEnergy: i(energy), uLegacy: i(Number(!!frame.legacyL4)) }, { uInput: raw });
            pass(pBlur, vertical, { uSize: size(vertical), uStep: v(0, stride / raw.height), uEnergy: i(0) }, { uInput: horizontal });
            return;
          }
          pass(pReduce,base,{uSize:size(base),uFoot:v(1/base.width,1/base.height),uEnergy:i(energy)},{uInput:raw});
          const gaussian=(input,output,s,dx,dy)=>{
            const key=s.toFixed(5);
            let uniform=kernels.get(key);
            if(!uniform){
              const count=Math.min(12,Math.ceil(2.9*s/2));
              const entries=new Float32Array(24);
              const weight=j=>Math.exp(-.5*(j/s)**2);
              let sum=1;
              for(let i=0;i<count;i++){
                const j=2*i+1;
                const a=weight(j),b=weight(j+1),w=a+b;
                entries[2*i]=j+b/w;
                entries[2*i+1]=w;
                sum+=2*w;
              }
              for(let i=0;i<count;i++) entries[2*i+1]/=sum;
              uniform={uCount:i(count),uCenter:f(1/sum),"uPairs[0]":["uniform2fv",entries]};
              kernels.set(key,uniform);
            }
            pass(pGaussian,output,{...uniform,uSize:size(output),uDirection:v(dx,dy)},{uInput:input});
          };
          gaussian(base,horizontal,sigma*base.width/raw.width,1/base.width,0);
          gaussian(horizontal,vertical,sigma*base.height/raw.height,0,1/base.height);
        };
        filtered(softBase,softX,soft,material.fine*scale);
        filtered(wideBase,wideX,wide,material.wide*scale);
        if(frame.bloom) filtered(haloBase,haloX,halo,material.halo*scale,1);
      }

      if (frame.stage>=5) {
        pass(pAmbient,ambient,{...common,uRadius:f(window.RimLight.radius(geometry))},
          {uBack:backdrop,uBoundary:boundaryTex});
      }
      if (frame.stage >= 6) {
        pass(pContact, direct, { ...common, uCount: i(n), uContactWindow: v(...frame.contactWindow) },
          { uRaw: raw, uEdge: edgeTex, uBack: backdrop });
        const reach = Math.min(112, Math.round(clamp(Math.min(geometry.width, geometry.height) * tuning.tintReach, 18, 82) / geometry.perimeter * n));
        pass(pExtend, tint, { uCount: i(n), uReach: i(reach) }, { uDirect: direct });
      }
      pass(pFinal, null, {
        ...common, uMix: f(material.wideMix), uBloomStrength: f(material.glow),
        uOrdinary: ["uniform3f",material.edgeWide,material.edgeSoft,material.faceSoft], uLegacy:i(Number(!!frame.legacyL4)),uPrevious:i(Number(!!frame.previousL4)),
        uTintStrength: f(tuning.tintStrength), uRimWidth: f(geometry.rimWidth), uStage: i(frame.stage),
        uBloom: i(Number(frame.bloom)), uCount: i(n),
      }, { uBack: backdrop, uRaw: raw, uShape: shapeTex, uSoft: soft, uWide: wide, uHalo: halo, uTint: tint, uAmbient: ambient });
    }

    function readContacts(field) {
      const buffer = maps[field];
      if (!buffer || !buffer.fb) throw new Error("Unknown contact field");
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.fb);
      const values = floating ? new Float32Array(buffer.width * 4) : new Uint8Array(buffer.width * 4);
      gl.readPixels(0, 0, buffer.width, 1, gl.RGBA, floating ? gl.FLOAT : gl.UNSIGNED_BYTE, values);
      if (floating) return Array.from(values);
      return Array.from(values, value => value / 255);
    }

    return { resize, prepare, render, readContacts, floating };
  }

  return { renderer, profile, tuning, clamp, mod };
})();
