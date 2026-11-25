"use strict";
window.RimLight = (() => {
  const white=.819;
  const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
  const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
  // Shared by GPU and CPU. Coordinates refer to an isotropic near-neighborhood,
  // never to the previously recolored L4 or contact-gated L6.
  const kernel=[
    [0,0,4], [-.5,0,3],[.5,0,3],[-1,0,1],[1,0,1],
    [-.50,-.50,2],[0,-.5,3],[.50,-.50,2],
    [-.50,.50,2],[0,.5,3],[.50,.50,2],
    [0,-1,1],[0,1,1],
  ];
  const total=kernel.reduce((sum,entry)=>sum+entry[2],0);
  const radius=g=>6+15*Math.min(g.width,g.height)/(Math.min(g.width,g.height)+136);
  function gain(x,y,nx,ny,d) {
    // The normal sets incidence, while a smooth light field varies along even perfectly flat edges.
    const direction=(x+y)*.50;
    const field=smooth(Math.abs(direction));
    const toward=(nx+ny)*Math.sign(direction)*.7071;
    const lit=field*(.79+.21*smooth(.5+.5*toward));
    const peak=.036+.745*lit;
    const core=.48+1.42*lit;
    const shoulder=.75+4.05*lit;
    const body=.19+.27*lit;
    const f=(1-body)*(1-smooth(d/core)) + body*(1-smooth(d/shoulder));
    return peak*f;
  }
  function ambient(r,g,b,out,at) {
    const y=.2126*r+.7152*g+.0722*b;
    const k=.50/Math.sqrt(.34+y);
    const limit=.176/Math.max(.176,k*(Math.max(r,g,b)-y));
    out[at]=white+(r-y)*k*limit;
    out[at+1]=white+(g-y)*k*limit;
    out[at+2]=white+(b-y)*k*limit;
    out[at+3]=1;
  }
  const glsl=String.raw`
    const vec3 luma=vec3(.2126,.7152,.0722);
    vec3 ambientLight(vec3 rgb) {
      float y=dot(rgb,luma);
      float k=.50/sqrt(.34+y);
      float limit=.176/max(.176,k*(max(rgb.r,max(rgb.g,rgb.b))-y));
      return vec3(${white})+(rgb-vec3(y))*k*limit;
    }
  `;
  return {gain,radius,kernel,total,ambient,glsl};
})();
