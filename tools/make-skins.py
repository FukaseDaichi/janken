"""きせかえスキンのスプライトを書き出す。元絵を差し替えたときだけ実行する。

    python3 tools/make-skins.py    # リポジトリルートで実行(要 Pillow)
    output/imagegen/revised/NN-{skin}-{hand}.png -> public/assets/player-{skin}-{hand}.webp

元絵一式(output/ 以下)はリポジトリに含めていないので、手元に無い場合は
書き出し済みの .webp がそのまま成果物になる。

スプライトの最大表示サイズはゲームオーバー画面のプレビューの 130px なので、
256px のまま quality=90 で落とす。PNG のままだと 15 枚で約 1.04MB あり
初回ロードで全部読むには重い(WebP なら約 220KB)。透過を持つので RGBA のまま扱う。
"""
import os

from PIL import Image

SRC_DIR = "output/imagegen/revised"
DST_DIR = "public/assets"
QUALITY = 90

# 元絵のファイル名は連番プレフィックス付き。スキン ID は src/logic/skins.ts と揃える
SKINS = {
    "cyber": "02-cyber",
    "mage": "03-mage",
    "forest": "04-forest",
    "samurai": "05-samurai",
    "maid": "01-maid",
}
HANDS = ("rock", "scissors", "paper")


def main():
    total_src = total_dst = 0
    for skin, prefix in SKINS.items():
        for hand in HANDS:
            src = f"{SRC_DIR}/{prefix}-{hand}.png"
            dst = f"{DST_DIR}/player-{skin}-{hand}.webp"
            im = Image.open(src).convert("RGBA")
            im.save(dst, "WEBP", quality=QUALITY, method=6)
            s, d = os.path.getsize(src), os.path.getsize(dst)
            total_src += s
            total_dst += d
            print(f"wrote {dst} {im.size} {d / 1024:.1f} KB (png {s / 1024:.1f} KB)")
    print(f"total: {total_src / 1024:.0f} KB -> {total_dst / 1024:.0f} KB")


main()
