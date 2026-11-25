"use strict";

const wallpaperSource = String.raw`
uniform vec2 uSize;
uniform float uTime, uScale;
uniform int uPlate, uProbes, uCase;
uniform vec4 uFixture;
uniform vec2 uMarkers[4];
uniform vec2 uShift;
uniform vec3 uContactColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float band(float d, float width) {
  return exp(-pow(d / width, 2.0));
}
float segment(vec2 p, vec2 a, vec2 b) {
  vec2 ab=b-a;
  return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab), 0.0, 1.0));
}
float line(float d, float width) {
  return 1.0-smoothstep(width-.4,width+.6,d);
}
float spot(vec2 p, vec2 center, float radius) {
  return 1.0-smoothstep(radius-.8,radius+.35,length(p-center));
}
vec3 nightTide(vec2 coord) {
  vec2 p=(coord*2.0-uSize)/uSize.y;
  float t=uTime*6.2831853/16.0;
  float x=p.x;
  float y=p.y;
  float flow=-.035-0.255*x+0.19*sin(2.05*x+.62+0.53*sin(t))
             +.14*sin(3.03*x-0.78+0.29*cos(t))+.088*cos(t+.75*x);
  float noiseFold=noise(vec2(1.6*x,1.55*y)+vec2(.33*cos(t),.35*sin(t)));
  vec3 rgb=mix(vec3(.0025,.010,.016),vec3(.004,.029,.036),
               .7*band(y-flow,.51)+.2*band(x-.5,1.5));
  float drift=.033*sin(9.5*x+.32*sin(t))+.015*cos(17.0*x-2.1*y+.30*cos(t));
  float fold=y-flow+drift;
  float width=.17+.035*sin(2.3*x+sin(t)*.34)+.018*cos(4.0*x+.42);
  float body=band(fold,width);
  float wave=fold/width;
  float rolls=.5+.5*cos(20.5*wave+2.9*sin(x*3.4+.48*sin(t))+9.0*noiseFold);
  float sheer=.5+.5*sin(59.0*wave+4.4*sin(x*5.3+.24*cos(t))+2.8*noiseFold);
  float crest=band(fold-.055+.027*sin(4.8*x),.025);
  float crestRim=band(fold-.047+.027*sin(4.8*x),.0041);
  float primary=(.28+.72*smoothstep(-1.38,.82,x))*(.77+.23*cos(x*3.4-.61));
  vec3 jade=mix(vec3(.012,.265,.206),vec3(.018,.195,.36),smoothstep(.04,1.15,x));
  rgb+=jade*primary*body*(.26+.41*pow(rolls,3.2)+.12*pow(sheer,6.0));
  rgb+=mix(vec3(.04,.60,.44),vec3(.05,.43,.70),smoothstep(.15,1.14,x))
      *primary*(crest*(.17+.07*sheer)+crestRim*(.22+.31*pow(rolls,2.0)));
  float other=y-flow+.237+.12*cos(x*2.2-.43*cos(t))+.055*sin(x*4.2-.31);
  float violet=band(other,.105);
  float filaments=pow(.5+.5*sin(131.0*other+4.0*sin(4.5*x)+3.0*noiseFold),6.0);
  rgb+=vec3(.031,.093,.179)*violet*(.22+.38*filaments)*(.46+.54*smoothstep(-1.3,.95,x));
  rgb+=vec3(.028,.185,.42)*band(other-.043,.013)*(.36+.64*filaments)
      *smoothstep(-.52,.95,x);
  float copper=y-.43+.215*x+.08*sin(x*3.1+.5+.46*sin(t))+.06*sin(x*6.5+.31*cos(t));
  float copperEnv=band(x+.28,1.00)*smoothstep(.06,.7,noiseFold);
  float copperLine=band(copper,.018)+.25*band(copper+.029,.047);
  rgb+=vec3(.67,.148,.043)*copperEnv*(copperLine*.24+band(copper+.006,.0045)*.56)
      *(.64+.36*sin(12.0*x+.71*sin(t)));
  float angled=y-flow-.18-.055*cos(x*2.3+.45*cos(t));
  rgb+=vec3(.015,.097,.067)*band(angled,.12)*pow(.5+.5*sin(71.0*angled+3.0*sin(1.9*x)+5.0*noiseFold),4.0);
  float dust=hash(floor(coord))-.5;
  rgb*=.83+.17*noise(coord*.105)+.09*dust;
  rgb+=max(0.0,dust)*.003;
  float vignette=1.0-.35*smoothstep(.37,1.18,length(vec2(x*.53,y*.80)));
  return rgb*vignette;
}
vec3 diagnostic(vec2 p) {
  vec2 c=uFixture.xy, d=p-c;
  vec2 halfSize=uFixture.zw;
  vec3 rgb=vec3(.014,.027,.032);
  if(uPlate == 3) return vec3(.07);
  if(uPlate == 1 || uPlate == 4) {
    if(uCase == 0) {
      float slope=(d.y+.46*d.x);
      float grid=abs(mod(slope+16.0,51.0)-25.5);
      rgb+=vec3(.025,.043,.051)*line(grid,1.1);
      if(uPlate==1) {
        rgb+=vec3(.022,.083,.08)*line(abs(slope-5.0),9.0);
        rgb+=vec3(.071,.125,.147)*line(abs(slope-14.0),2.2);
      }
    }
    if(uPlate == 1) {
      if((uProbes & 1) != 0) rgb=mix(rgb,vec3(.81,.54,.13),spot(p,uMarkers[0],4.1));
      if((uProbes & 2) != 0) rgb=mix(rgb,vec3(.05,.62,.81),spot(p,uMarkers[1],4.1));
      rgb=mix(rgb,vec3(.86,.31,.15),spot(p,uMarkers[2],3.1));
      rgb=mix(rgb,vec3(.65,.79,.17),spot(p,uMarkers[3],3.1));
    } else {
      if((uProbes & 1) != 0) rgb=mix(rgb,vec3(.90,.27,.034),spot(p,uMarkers[0]+uShift,6.3));
      if((uProbes & 2) != 0) rgb=mix(rgb,vec3(.038,.42,.97),spot(p,uMarkers[1],6.3));
    }
    return rgb;
  }
  if(uPlate == 2) {
    rgb=vec3(.0035,.005,.0065);
    float texture=.5+.5*cos((d.x*.78+d.y*.61)*2.48);
    float softBand=line(abs(d.y-0.289*d.x+.23*halfSize.y),11.0);
    float sideBand=line(abs(d.y-0.289*d.x+.84*halfSize.y),9.0);
    float cornerWaves=line(abs(d.y+0.315*d.x-.47*halfSize.y),9.0);
    rgb+=vec3(.022,.031,.036)*(softBand+sideBand+cornerWaves)*(.09+.91*texture);
    vec2 a=c+vec2(-halfSize.x*.43,halfSize.y*.28);
    vec2 b=c+vec2(halfSize.x*.43,halfSize.y*.28);
    rgb+=vec3(.91,.67,.40)*line(segment(p,a+vec2(-12,0),a+vec2(12,0)),3.1);
    rgb+=vec3(.118,.086,.052)*line(segment(p,b+vec2(-12,0),b+vec2(12,0)),3.1);
    return rgb;
  }
  rgb=uCase==3?vec3(.013,.062,.055):vec3(.020,.030,.035);
  if(uCase == 1) return uContactColor;
  if((uProbes & 1) != 0) rgb=mix(rgb,uContactColor,spot(p,uMarkers[0],7.0));
  return rgb;
}
void main() {
  vec3 rgb=uPlate==0?nightTide(gl_FragCoord.xy):diagnostic(gl_FragCoord.xy/uScale);
  dst=vec4(max(vec3(0.0),rgb),1.0);
}
`;
