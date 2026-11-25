"""Create the native-pixel, fixed-window V7.21 clarity manifest and a compact comparison."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,math
from statistics import fmean
root=Path(__file__).resolve().parents[1];qa=root/'qa'
linear=lambda v: v/255/12.92 if v/255<=.04045 else ((v/255+.055)/1.055)**2.4
def Y(px):return sum(a*linear(b) for a,b in zip([.2126,.7152,.0722],px))
def pts(x,y):return [[x,j] for j in range(y,y+6)]
coords={'fine':[pts(332,200),pts(339,200)],'main':[pts(341,265),pts(367,265)]}
frames={k:k+'.png' for k in ('B3','B4a','B6')}
F={k:Image.open(qa/(k+'.png')).convert('RGB') for k in ('B0','B3','B4a','B6')}
def position(im):
    # Linear-light mid-threshold of the same broad stripe's rising edge. Restrict search to
    # its B0/B3-registered neighbourhood; primary edge in B6, not the ~x125 specular core.
    rows=[]
    for y in range(268,274):
        y0,y1=Y(F['B0'].getpixel((133,y))),Y(F['B0'].getpixel((153,y)))
        target=(y0+y1)*.5
        c=[(x,Y(im.getpixel((x,y)))) for x in range(128,150)]
        p=[x+(target-a)/(b-a) for (x,a),(_,b) in zip(c,c[1:]) if a<target<=b]
        assert len(p)==1
        rows.append(p[0])
    return fmean(rows)
pos={k:position(F[k]) for k in ('B0','B3','B6')}
manifest={'frames':frames,'coordinates':coords,'signed_displacement_px':[round(pos[k]-pos['B0'],3) for k in ('B3','B6')],'measurement_uncertainty_px':1.0}
(qa/'clarity-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
def contrast(im,groups):return abs(fmean(Y(im.getpixel(tuple(p))) for p in groups[0])-fmean(Y(im.getpixel(tuple(p))) for p in groups[1]))
C={s:{feat:contrast(F[s],xy) for feat,xy in coords.items()} for s in ('B3','B4a','B6')}
(qa/'measurements.json').write_text(json.dumps({'reference':{'W_px':208,'S_px':50,'fine_period_px':14,'main_bright_width_px':24,'view_px':[1200,785]},'C':C,'edge_x':pos,'note':'Linear-light contrast; source and ROI coordinates fixed across stages.'},indent=2)+'\n')
print(C,pos,manifest['signed_displacement_px'])
labels=['B0   /   BACKGROUND','B3   /   REFRACTED','B4a  /   SOFTENED','B6   /   COMPOSITE']
stages=['B0','B3','B4a','B6'];crop=(99,116,558,358)
sheet=Image.new('RGB',(2*(459+18)+18,2*(242+47)+5),'#f9f7f1');d=ImageDraw.Draw(sheet);font=ImageFont.load_default(size=15)
for i,s in enumerate(stages):
    x=18+i%2*477;y=10+i//2*289
    d.text((x,y),labels[i],font=font,fill='#30363b')
    sheet.paste(Image.open(qa/('scene-'+s+'.png')).crop(crop),(x,y+24))
sheet.save(qa/'stages.png')
