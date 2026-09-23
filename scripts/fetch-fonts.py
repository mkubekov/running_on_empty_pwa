"""
Скачивает Literata и Golos Text с Google Fonts в public/fonts и собирает
src/styles/fonts.css со ссылками на локальные файлы.

    python scripts/fetch-fonts.py

Шрифты держим у себя, а не подключаем ссылкой: приложение обязано
открываться без сети, а сторонний домен в офлайне просто не ответит.
Латиница-ext и латинский курсив отброшены — в русском интерфейсе они
не встречаются, а это 170 лишних килобайт в офлайн-кэше.
"""

from __future__ import annotations

import io
import os
import re
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, 'public', 'fonts')
CSS_OUT = os.path.join(ROOT, 'src', 'styles', 'fonts.css')

API = (
    'https://fonts.googleapis.com/css2'
    '?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400'
    '&family=Golos+Text:wght@400;500;600'
    '&display=swap'
)

# Без десктопного User-Agent Google отдаёт ttf вместо woff2.
UA = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/120.0 Safari/537.36'
)

KEEP_SUBSETS = {'cyrillic', 'cyrillic-ext', 'latin'}

HEADER = """/* Шрифты лежат локально: приложение должно открываться и без сети.
   Собрано scripts/fetch-fonts.py — латиница-ext и латинский курсив
   отброшены, в русском интерфейсе они не встречаются. */
"""


def main() -> int:
    os.makedirs(FONT_DIR, exist_ok=True)

    request = urllib.request.Request(API, headers={'User-Agent': UA})
    css = urllib.request.urlopen(request).read().decode('utf-8')

    # Google размечает блоки комментарием с именем подмножества.
    blocks = re.findall(r'/\* ([\w-]+) \*/\s*(@font-face \{.*?\})', css, re.S)

    faces: list[str] = []
    downloaded: dict[str, str] = {}

    for subset, block in blocks:
        style = re.search(r'font-style: (\w+)', block).group(1)
        if subset not in KEEP_SUBSETS or (style == 'italic' and subset == 'latin'):
            continue

        url = re.search(r'url\((https://[^)]+)\)', block).group(1)
        family = re.search(r"font-family: '([^']+)'", block).group(1)
        weight = re.search(r'font-weight: ([\d ]+)', block).group(1).replace(' ', '-')

        if url not in downloaded:
            suffix = '-italic' if style == 'italic' else ''
            name = f"{family.lower().replace(' ', '-')}-{weight}{suffix}-{subset}.woff2"
            urllib.request.urlretrieve(url, os.path.join(FONT_DIR, name))
            downloaded[url] = name

        faces.append(block.replace(f'url({url})', f'url(/fonts/{downloaded[url]})'))

    io.open(CSS_OUT, 'w', encoding='utf-8').write(HEADER + '\n' + '\n\n'.join(faces) + '\n')

    total = sum(
        os.path.getsize(os.path.join(FONT_DIR, f)) for f in os.listdir(FONT_DIR)
    )
    print(f'файлов: {len(downloaded)}, @font-face: {len(faces)}, всего: {total / 1024:.0f} КБ')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
