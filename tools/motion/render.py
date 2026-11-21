"""Rendu de la vidéo de présentation, image par image.

Usage :
  npx vite                          # sert tools/motion/ sur http://localhost:5173
  python tools/motion/render.py http://localhost:5173/tools/motion/ public/video
Prérequis : pip install playwright && playwright install chromium ; ffmpeg dans le PATH.
"""
import os, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173/tools/motion/'
out = sys.argv[2] if len(sys.argv) > 2 else 'public/video'
only = sys.argv[3] if len(sys.argv) > 3 else None  # liste de temps « 1,5.5,9 » pour des aperçus
os.makedirs(out, exist_ok=True)
frames = tempfile.mkdtemp(prefix='imperium-motion-')

with sync_playwright() as p:
    br = p.chromium.launch(args=['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
    pg = br.new_page(viewport={'width': 1280, 'height': 720}, device_scale_factor=1)
    pg.on('pageerror', lambda e: print('erreur page :', e))
    pg.goto(url)
    pg.wait_for_function('window.__ready === true', timeout=120000)
    pg.evaluate('document.fonts.ready')
    meta = pg.evaluate('window.__meta')
    fps, dur = meta['FPS'], meta['DURATION']
    times = [float(x) for x in only.split(',')] if only else [i / fps for i in range(int(dur * fps))]
    t0 = time.time()
    for i, t in enumerate(times):
        pg.evaluate(f'window.__frame({t})')
        pg.screenshot(path=os.path.join(frames, f'f{i:05d}.png') if not only else os.path.join(out, f'apercu_{t:05.2f}.png'))
        if i % 25 == 0: print(f'{i}/{len(times)} images ({time.time() - t0:.0f} s)', flush=True)
    br.close()

if not only:
    # Vidéo H.264 (lecture web), sans son, démarrage rapide ; affiche = image de fin.
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', os.path.join(frames, 'f%05d.png'),
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                    os.path.join(out, 'presentation.mp4')], check=True)
    poster = os.path.join(frames, f'f{int(fps * 21.6):05d}.png')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', poster, '-q:v', '4', os.path.join(out, 'poster.jpg')], check=True)
    print('vidéo :', os.path.join(out, 'presentation.mp4'))
