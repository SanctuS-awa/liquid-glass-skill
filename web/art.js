/* Original vector backdrop, painted at the actual viewing size. One source is fed to every optical pass. */
window.paintStrata=(g,w,h,time,fixture)=>{
  if(fixture){ g.fillStyle='#333';g.fillRect(0,0,w,h);const X=w/2,Y=h/2;
    // Locally periodic sinusoid, and a broad stripe pair. Native, not scaled.
    for(let x=0;x<w;x++){const v=Math.round(90+23*Math.cos((x-Math.round(X))*2*Math.PI/14));g.fillStyle='rgb('+v+','+v+','+v+')';g.fillRect(x,0,1,h*.52)}
    g.fillStyle='#575757';g.fillRect(0,Math.round(h*.52),w,h);
    for(let x=Math.round(X)-192;x<w;x+=64){g.fillStyle='#747474';g.fillRect(x,Math.round(h*.52),24,h)}
    return;
  }
  g.save();g.scale(w/800,h/600);
  const K=2*Math.PI, wt=time*K/12, dx=Math.sin(wt)*23,dy=Math.cos(wt)*15;
  const grad=(x,y,X,Y,stops)=>{const z=g.createLinearGradient(x,y,X,Y);for (let j=0;j<stops.length;j++)z.addColorStop(stops[j][0],stops[j][1]);return z};
  g.fillStyle=grad(20,30,710,570,[[0,'#445e70'],[.28,'#233d52'],[.57,'#173145'],[.78,'#304753'],[1,'#895c54']]);g.fillRect(0,0,800,600);
  // Strata are slices of a single folded surface, not repeated independent icons. Unequal widths and
  // nested contours provide large seams plus finer details that can be traced into and out of the lens.
  const path=(shift,phase=0)=>{
    g.beginPath();g.moveTo(-85,340+shift+dy);
    g.bezierCurveTo(105+dx,250+shift+dy,214+dx,515+shift*.97,348+dx,425+shift*.79);
    g.bezierCurveTo(477+dx,344+shift*.80,438-dx*.5,153+shift*.65,635-dx*.52,93+shift*.60+dy*.59);
    g.bezierCurveTo(736-dx,65+shift*.56,800,20+shift*.42+dy*.45,885,-95+shift*.37);
  };
  const fillBand=(o,stops)=>{path(o);g.lineTo(890,890);g.lineTo(-89,900);g.closePath();g.fillStyle=grad(90,395,694,128,stops);g.fill()};
  const line=(o,color,width,blur=0)=>{path(o);g.lineWidth=width;g.strokeStyle=color;g.stroke()};
  // Distant fine, strictly decorative surveying contours.
  for (const [o,a,z] of [[-167,.12,1],[-159,.07,.8],[-118,.11,.7],[-65,.10,.8],[-58,.07,.6]])line(o,'rgba(174,194,196,'+a+')',z);
  fillBand(-34,[[0,'#60818e'],[.28,'#446671'],[.65,'#677d85'],[1,'#c89a80']]);
  fillBand(-26,[[0,'#3a666f'],[.4,'#365466'],[.72,'#455e6b'],[1,'#8c6863']]);line(-34,'rgba(197,211,193,.66)',1.3);
  fillBand(-12,[[0,'#a9c4be'],[.26,'#5e9caa'],[.5,'#356277'],[.82,'#394d61'],[1,'#b59284']]);
  fillBand(-4,[[0,'#416c79'],[.32,'#264c61'],[.57,'#30485b'],[.87,'#765d63'],[1,'#ba9480']]);
  line(-12,'rgba(223,227,206,.58)',1.0);line(-4,'rgba(192,227,219,.65)',.9);
  fillBand(35,[[0,'#779b9b'],[.26,'#7398a0'],[.56,'#79767b'],[.82,'#b58370'],[1,'#e7ad7e']]);
  fillBand(49,[[0,'#4d7883'],[.29,'#65858c'],[.52,'#977f78'],[.84,'#c68a70'],[1,'#ecb17d']]);
  line(34,'rgba(215,206,182,.72)',1.1);
  fillBand(82,[[0,'#72969e'],[.24,'#92a9a8'],[.5,'#b6a094'],[.78,'#edaf82'],[1,'#e9ad7e']]);
  fillBand(91,[[0,'#486a76'],[.3,'#748b8d'],[.55,'#ba8d7c'],[.88,'#df9973'],[1,'#dea37f']]);
  fillBand(104,[[0,'#3b6170'],[.31,'#6d8081'],[.55,'#bd8c77'],[.88,'#d39774'],[1,'#e5a77a']]);
  line(83,'rgba(247,224,186,.83)',1.5);line(92,'rgba(245,199,157,.73)',1.0);
  fillBand(158,[[0,'#4b6874'],[.4,'#8b807a'],[.71,'#bc816a'],[1,'#db9a70']]);
  fillBand(204,[[0,'#799094'],[.36,'#a48e80'],[.68,'#c09072'],[1,'#e8af83']]);
  for(let j=0;j<7;j++)line(207+j*7,'rgba(63,72,73,'+(.11-j*.007)+')',.8);
  // A narrow copper inclusion crossing the blue face is a strong, topologically clear witness.
  for (const [o,c,z] of [[-51,'rgba(239,187,129,.61)',2],[-49,'rgba(239,215,174,.64)',.65],[-45,'rgba(105,155,159,.48)',1]])line(o,c,z);
  g.restore();
};
