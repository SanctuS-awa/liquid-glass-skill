#!/usr/bin/env python3
"""L4/L6 clarity gate. Default: read a JSON manifest. --svg S writes a neutral probe."""
import argparse
import json
import math
from pathlib import Path
from statistics import fmean

def linear(u):
    u = u / 255
    return u / 12.92 if u <= .04045 else ((u + .055) / 1.055) ** 2.4

def lum(pixel):
    return sum(k * linear(v) for k, v in zip((.2126,.7152,.0722),pixel))

def contrast(pair):
    if len(pair) != 2 or not all(len(group) >= 3 for group in pair):
        raise ValueError("provide two groups of at least 3 samples")
    if not all(math.isfinite(v) and 0 <= v <= 1 for group in pair for v in group):
        raise ValueError("finite linear Y samples in [0, 1] required")
    return abs(fmean(pair[0]) - fmean(pair[1]))

def assess(data):
    raw,p,q=data['B3'],data['B4a'],data['B6']
    bFine,bMain=contrast(raw['fine']),contrast(raw['main'])
    mFine,mMain=contrast(p['fine']),contrast(p['main'])
    cMain=contrast(q['main'])
    if bFine < .035 or bMain < .060:
        return {'status':'INVALID BASELINE','B3_fine':bFine,'B3_main':bMain}
    fine,main,total=mFine/bFine,mMain/bMain,cMain/bMain
    ok={'L4_fine_window':.40-1e-9<=fine<=.85+1e-9,'L4_primary':main>=.75-1e-9,'B6_primary':total>=.60-1e-9}
    if 'signed_displacement_px' in data:
        d0,d6=data['signed_displacement_px']
        # Displacements are B3 - B0 and B6 - B0 for the same feature.
        u=data.get('measurement_uncertainty_px',0)
        if not all(math.isfinite(v) for v in (d0,d6,u)) or u<0 or abs(d0)<1 or abs(d0)<=u:
            return {'status':'INVALID DISPLACEMENT BASELINE','signed_displacement_px':[d0,d6]}
        ok['B6_displacement']=d0*d6>0 and abs(d6)>=.5*abs(d0)
    return {'status':'PASS NUMERIC' if all(ok.values()) else 'FAIL',
            'ratios':{'B4a_fine/B3':round(fine,4),'B4a_main/B3':round(main,4),'B6_main/B3':round(total,4)},
            'criteria':ok,
            'not_evaluated':'normal-size visual inspection; L4b halo; other layers and motion'}

def from_images(data,folder):
    try:
        from PIL import Image
    except ImportError as e:
        raise SystemExit("PNG-manifest mode requires Pillow; direct linear-Y arrays do not") from e
    out={k:data[k] for k in ('signed_displacement_px','measurement_uncertainty_px') if k in data}
    stage_files=data['frames']
    coords=data['coordinates']
    size=None
    for stage,items in (('B3',('fine','main')),('B4a',('fine','main')),('B6',('main',))):
        with Image.open(folder/stage_files[stage]) as im:
            if im.format!='PNG':
                raise ValueError("PNG input required, not JPEG")
            if size is not None and im.size != size:
                raise ValueError("all frames must be registered, at equal original pixel dimensions")
            size=im.size
            px=im.convert('RGB')
            row={}
            for feature in items:
                if len(coords[feature])!=2:
                    raise ValueError("exactly two coordinate groups required")
                left,right=({tuple(pt) for pt in group} for group in coords[feature])
                if left & right:
                    raise ValueError("the coordinate groups must not overlap")
                if any(not (0<=x<size[0] and 0<=y<size[1]) for x,y in left|right):
                    raise ValueError("sample outside frame")
                row[feature]=[[lum(px.getpixel(pt)) for pt in sorted(group)] for group in (left,right)]
            out[stage]=row
    return out

def selftest():
    c=lambda d:[[.20]*3,[.20+d]*3]
    base={'B3':{'fine':c(.08),'main':c(.14)},'signed_displacement_px':[3,2]}
    controls={'PASS':(.052,.125,.10),'NO_BLUR':(.08,.14,.13),'FROSTED_L4':(.018,.063,.058),'OPAQUE_L5':(.052,.125,.052)}
    result={}
    for name,(f,m,a) in controls.items():
        result[name]=assess(dict(base,B4a={'fine':c(f),'main':c(m)},B6={'main':c(a)}))
    assert result['PASS']['status']=='PASS NUMERIC'
    assert not result['NO_BLUR']['criteria']['L4_fine_window']
    assert not result['FROSTED_L4']['criteria']['L4_primary']
    assert result['OPAQUE_L5']['criteria']['L4_fine_window'] and not result['OPAQUE_L5']['criteria']['B6_primary']
    return result

def svg(w):
    if not math.isfinite(w) or not 12<=w<=300:
        raise ValueError("use S from 12 to 300; do not upscale intrinsically unmeasurable probes")
    p=w*.28
    # Vertical structures; orient the crop across the local sample direction in the renderer.
    # Near-mid-tone colors avoid deliberate high-energy point blooms.
    rect=lambda x,y,width,height,col: f'<rect x="{x:.2f}" y="{y:.2f}" width="{width:.2f}" height="{height:.2f}" fill="{col}"/>'
    parts=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 480" width="720" height="480">',rect(0,0,720,480,'#535353')]
    for j in range(-2,3):
        parts.append(rect(360+j*p-p*.23,96,p*.46,122,'#737373'))
    parts.extend([rect(360-w*.31,264,w*.26,122,'#838383'),rect(360+w*.31,264,w*.26,122,'#838383'),'</svg>'])
    return '\n'.join(parts)+'\n'

if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('manifest',nargs='?',type=Path)
    p.add_argument('--self-test',action='store_true')
    p.add_argument('--svg',type=float)
    a=p.parse_args()
    if a.svg is not None:
        print(svg(a.svg),end='')
    elif a.self_test:
        print(json.dumps(selftest(),indent=2))
    elif a.manifest:
        d=json.loads(a.manifest.read_text())
        result=assess(from_images(d,a.manifest.parent) if 'frames' in d else d)
        print(json.dumps(result,indent=2))
        raise SystemExit(0 if result['status']=='PASS NUMERIC' else 1)
    else:
        p.error("provide a manifest, --svg W, or --self-test")
