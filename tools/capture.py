"""Render the actual, local, offline file entry using a Chromium executable and Playwright.
Set CHROME to a Chromium/Chrome executable, then python tools/capture.py still|motion|checks.
"""
import os, sys, json, math, time
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
root=Path(__file__).resolve().parents[1]
exe=os.environ.get('CHROME')
media=root/'media';qa=root/'qa'; media.mkdir(exist_ok=True);qa.mkdir(exist_ok=True)
mode=sys.argv[1] if len(sys.argv)>1 else 'still'
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-networking'])
    ctx=browser.new_context(viewport={'width':1200,'height':785},device_scale_factor=1,offline=True);page=ctx.new_page()
    errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
    page.goto((root/'web/index.html').as_uri()+'?capture=1',wait_until='load');page.wait_for_function('window.specimen && window.specimen.status.box');print(page.evaluate('specimen.status'),flush=True)
    def frame(q=1,t=2.15,**opts):return page.evaluate('([q,t,o])=>specimen.frame(q,t,o)',[q,t,opts])
    if mode=='still':
        frame();page.screenshot(path=str(media/'hero.png'));print('hero saved',flush=True)
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(180);frame();page.screenshot(path=str(media/'mobile.png'));print('mobile saved',flush=True)
    elif mode=='motion':
        from tempfile import TemporaryDirectory
        import subprocess
        fps=12;dur=12.0
        with TemporaryDirectory(prefix='liquid-frames-') as tmp:
            frame(1,2.15)
            events={12,28,57,71,100,115}
            for i in range(round(dur*fps)):
                if i in events:
                    page.locator('#lensButton').dispatch_event('click')
                # The ordinary DOM click handler + the live spring integrator are stepped with a fixed clock.
                page.evaluate('(dt)=>specimen.step(dt)',0 if i==0 else 1/fps)
                page.screenshot(path=tmp+'/%04d.jpg'%i,type='jpeg',quality=94,clip={'x':0,'y':0,'width':1200,'height':723})
                if i%15==0: print('frame',i,flush=True)
            inp=['ffmpeg','-y','-loglevel','error','-threads','2','-framerate',str(fps),'-i',tmp+'/%04d.jpg']
            subprocess.run(inp+['-vf','scale=1200:724','-c:v','libx264','-pix_fmt','yuv420p','-preset','fast','-crf','18','-movflags','+faststart',str(media/'specimen.mp4')],check=True)
            subprocess.run(inp+['-filter_complex_threads','1','-filter_complex','[0:v]scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=224:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle','-loop','0',str(media/'specimen.gif')],check=True)
    elif mode=='checks':
        from PIL import Image
        from tempfile import TemporaryDirectory
        import numpy as np
        import shutil
        out={}
        for s,b,label in [(0,False,'B0'),(3,False,'B3'),(4,False,'B4a'),(4,True,'B4b'),(5,True,'B5'),(6,True,'B6')]:
            st=frame(1,2.15,stage=s,bloom=b,fixture=True,hide=True);page.locator('#scene').screenshot(path=str(qa/(label+'.png')))
        print('fixture',st)
        for s,b,label in [(0,False,'scene-B0'),(3,False,'scene-B3'),(4,False,'scene-B4a'),(6,True,'scene-B6')]:
            frame(1,2.15,stage=s,bloom=b,hide=True);page.locator('#scene').screenshot(path=str(qa/(label+'.png')))
        out['optics_scene']=st
        frame(1,2.15);page.evaluate('specimen.resume()');page.locator('#motion').click();page.locator('#lensButton').click();time.sleep(.15);state1=page.evaluate('specimen.status');page.locator('#lensButton').dispatch_event('click');state2=page.evaluate('specimen.status');page.wait_for_function('specimen.status.p===1',timeout=20000);state3=page.evaluate('specimen.status')
        assert state1['goal']==0 and state2['goal']==1 and state3['p']==1
        out['interrupted']=[state1,state2,state3]
        page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(60);page.locator('#lensButton').click();r=page.evaluate('specimen.status');assert r['paused'] and r['p']==0 and r['goal']==0;out['reduced_motion']=r
        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100);page.locator('#lensButton').focus();page.keyboard.press('Enter');page.wait_for_timeout(100);ss=page.evaluate('''() => ({...specimen.status,layout:[document.documentElement.clientWidth, document.documentElement.scrollWidth],title:getComputedStyle(document.querySelector('#glassBody h2')).filter, glassText:document.querySelector('#glassBody h2').textContent})''');assert ss['p']==1 and ss['layout'][0]==ss['layout'][1] and ss['title']=='none';out['phone_keys']=ss
        out['errors']=errors;assert not errors; (qa/'browser-checks.json').write_text(json.dumps(out,indent=2,ensure_ascii=False))
    print('page errors:',errors);browser.close()
