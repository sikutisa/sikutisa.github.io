"""Build comparison sheets for manual QA only; never publish these images."""
import json, hashlib, subprocess, io
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache' / 'image-review'
OUT.mkdir(parents=True, exist_ok=True)
manifest = json.loads((ROOT/'docs/image-refresh/manifest.json').read_text(encoding='utf-8'))
groups = {}
missing = []
for item in manifest['images']:
    groups.setdefault(item['document'], []).append(item)
    target = OUT/'originals'/f"{item['id']}.png"
    target.parent.mkdir(exist_ok=True)
    if not target.exists():
        result = subprocess.run(['git','show',f"HEAD:{item['original']}"], cwd=ROOT, capture_output=True)
        if result.returncode == 0 and hashlib.sha256(result.stdout).hexdigest() == item['originalSha256']:
            target.write_bytes(result.stdout)
        else:
            cached = ROOT/'.cache/image-refresh/source-images'/f"{Path(item['document']).stem}-{Path(item['original']).name}"
            if cached.exists():
                target.write_bytes(cached.read_bytes())
            else:
                missing.append(item['id'])
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 26)
index = []
for gi,(doc,items) in enumerate(groups.items()):
    for start in range(0,len(items),3):
        chunk = items[start:start+3]
        sheet = Image.new('RGB',(2400,850*len(chunk)), 'white')
        draw = ImageDraw.Draw(sheet)
        for row,item in enumerate(chunk):
            y=row*850
            draw.text((16,y+8),f"{gi:02d} {Path(item['original']).name} {item['id']} | BEFORE (left) / AFTER (right)",fill='black',font=font)
            for kind,x,width in [('original',0,950),('generated',970,1420)]:
                file=OUT/'originals'/f"{item['id']}.png" if kind=='original' else ROOT/item['generated']
                if file.exists():
                    im=Image.open(file).convert('RGBA')
                    white=Image.new('RGBA',im.size,'white');white.alpha_composite(im)
                    white=ImageOps.contain(white.convert('RGB'),(width-20,790))
                    sheet.paste(white,(x+(width-white.width)//2,y+50+(790-white.height)//2))
                else:
                    draw.text((x+20,y+200),'Original unavailable: untracked file retired',fill='red',font=font)
            draw.line((960,y+45,960,y+840),fill='#777777',width=2)
            draw.line((0,y+849,2399,y+849),fill='#777777',width=2)
        name=f'{gi:02d}-{start//3:02d}.png'
        sheet.save(OUT/name)
        index.append({'sheet':name,'document':doc,'ids':[i['id'] for i in chunk]})
(OUT/'index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'sheets':len(index),'images':len(manifest['images']),'missingOriginals':missing}))
