"""タイトルのヒーロー画像を書き出す。元絵を差し替えたときだけ実行する。

    python3 tools/make-hero.py     # リポジトリルートで実行(要 Pillow)
    docs/reference/title.png -> public/assets/hero-title.webp

TitleScene は画像を screen 合成で背景に重ねる(黒 = 変化なし)。そのための下ごしらえ:
- content bbox で余白を落とす
- 黒を完全に 0 まで潰す(色相は保ったまま輝度だけクラッシュ)ので、隅の色かぶりが出ない
- 外周を黒へフェザーして矩形の継ぎ目を消す
- WebP で書き出す。同じ絵の PNG は 1.1MB あり初回ロードに見合わない(WebP は 205KB)
"""
from PIL import Image, ImageChops, ImageOps

SRC = "docs/reference/title.png"
TH = 22          # content bbox 判定のしきい値
FLOOR = 16       # これ未満の輝度は 0 に潰す
PAD_RATIO = 0.012
FEATHER_RATIO = 2.2  # PAD に対するフェザー幅


def ramp(n, feather):
    vals = []
    for i in range(n):
        d = min(i, n - 1 - i)
        vals.append(255 if d >= feather else int(255 * (d / feather)))
    return vals


def main():
    im = Image.open(SRC).convert("RGB")
    print("source:", im.size)

    luma = im.convert("L")
    bbox = luma.point(lambda v: 255 if v > TH else 0).getbbox()
    print("content bbox:", bbox, "->", (bbox[2] - bbox[0], bbox[3] - bbox[1]))
    im = im.crop(bbox)

    # 黒クラッシュ(色相保持): factor = max(0, luma-FLOOR)/luma
    luma = im.convert("L")
    factor = luma.point(lambda v: 0 if v == 0 else int(255 * max(0, v - FLOOR) / v))
    im = Image.merge("RGB", [ImageChops.multiply(c, factor) for c in im.split()])

    # パディング + フェザー
    pad = int(max(im.size) * PAD_RATIO)
    im = ImageOps.expand(im, border=pad, fill=(0, 0, 0))
    w, h = im.size
    fe = int(pad * FEATHER_RATIO)
    mx = Image.new("L", (w, 1)); mx.putdata(ramp(w, fe)); mx = mx.resize((w, h))
    my = Image.new("L", (1, h)); my.putdata(ramp(h, fe)); my = my.resize((w, h))
    mask = ImageChops.multiply(mx, my)
    im = Image.merge("RGB", [ImageChops.multiply(c, mask) for c in im.split()])
    print("padded:", im.size, "aspect:", round(w / h, 4))

    import os
    width = 1200
    r = im.resize((width, round(width * h / w)), Image.LANCZOS)
    dst = "public/assets/hero-title.webp"
    r.save(dst, quality=90, method=6)
    print(f"wrote {dst} {r.size} {os.path.getsize(dst)/1024:.1f} KB  aspect={r.size[0]/r.size[1]:.4f}")


main()
