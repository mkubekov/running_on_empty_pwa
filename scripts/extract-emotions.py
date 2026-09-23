"""
Извлекает «Список слов для эмоций» из PDF книги в src/content/emotionWords.generated.ts.

PDF в репозиторий не входит — укажите путь к своему экземпляру:

    python scripts/extract-emotions.py "путь/к/книге.pdf"

Зависимостей нет: PDF от calibre разбирается стандартной библиотекой —
объекты, Flate-потоки и ToUnicode-таблицы шрифтов.
"""

from __future__ import annotations

import io
import os
import re
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'content', 'emotionWords.generated.ts')

TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
    'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', ' ': '-', '-': '-',
}


def slug(text: str) -> str:
    out = ''.join(TRANSLIT.get(ch, '') for ch in text.lower())
    return re.sub(r'-+', '-', out).strip('-')


def parse_objects(data: bytes) -> dict[int, bytes]:
    objs: dict[int, bytes] = {}
    for m in re.finditer(rb'(\d+)\s+(\d+)\s+obj', data):
        end = data.find(b'endobj', m.end())
        objs[int(m.group(1))] = data[m.end():end]
    return objs


def get_stream(body: bytes) -> bytes | None:
    i = body.find(b'stream')
    if i < 0:
        return None
    j = i + 6
    while body[j:j + 1] in (b'\r', b'\n'):
        j += 1
    raw = body[j:body.rfind(b'endstream')]
    if b'FlateDecode' in body[:i]:
        try:
            return zlib.decompress(raw)
        except zlib.error:
            return None
    return raw


def parse_cmap(stream: bytes) -> dict[int, str]:
    """ToUnicode-таблица: код глифа → символ."""
    mapping: dict[int, str] = {}
    text = stream.decode('latin-1')

    for block in re.findall(r'beginbfchar(.*?)endbfchar', text, re.S):
        for src, dst in re.findall(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', block):
            mapping[int(src, 16)] = ''.join(
                chr(int(dst[i:i + 4], 16)) for i in range(0, len(dst), 4)
            )

    for block in re.findall(r'beginbfrange(.*?)endbfrange', text, re.S):
        for lo, hi, dst in re.findall(
            r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', block
        ):
            base = int(dst, 16)
            for k in range(int(lo, 16), int(hi, 16) + 1):
                mapping[k] = chr(base + k - int(lo, 16))

    return mapping


def extract_text(path: str) -> list[str]:
    data = open(path, 'rb').read()
    objs = parse_objects(data)
    cmaps: dict[int, dict[int, str]] = {}

    def cmap_for(font_obj: int) -> dict[int, str]:
        if font_obj in cmaps:
            return cmaps[font_obj]
        body = objs.get(font_obj, b'')
        ref = re.search(rb'/ToUnicode\s+(\d+)\s+0\s+R', body)
        if not ref:
            desc = re.search(rb'/DescendantFonts\s*\[\s*(\d+)\s+0\s+R', body)
            if desc:
                ref = re.search(
                    rb'/ToUnicode\s+(\d+)\s+0\s+R', objs.get(int(desc.group(1)), b'')
                )
        result: dict[int, str] = {}
        if ref:
            stream = get_stream(objs.get(int(ref.group(1)), b''))
            if stream:
                result = parse_cmap(stream)
        cmaps[font_obj] = result
        return result

    pages = sorted(n for n, b in objs.items() if re.search(rb'/Type\s*/Page[^s]', b))
    lines: list[str] = []

    for page in pages:
        body = objs[page]
        fonts = {
            k.decode(): int(v)
            for k, v in re.findall(rb'/(F\d+)\s+(\d+)\s+0\s+R', body)
        }
        ref = re.search(rb'/Contents\s+(\d+)\s+0\s+R', body)
        if not ref:
            continue
        stream = get_stream(objs.get(int(ref.group(1)), b''))
        if not stream:
            continue

        content = stream.decode('latin-1')
        buf: list[str] = []
        current: dict[int, str] = {}

        def decode(hexstr: str) -> str:
            return ''.join(
                current.get(int(hexstr[i:i + 4], 16), '')
                for i in range(0, len(hexstr), 4)
            )

        for token in re.finditer(
            r'/(F\d+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj|\[(.*?)\]\s*TJ|T\*|ET',
            content,
            re.S,
        ):
            if token.group(1):
                current = cmap_for(fonts.get(token.group(1), -1))
            elif token.group(2):
                buf.append(decode(token.group(2)))
            elif token.group(3) is not None:
                for part in re.finditer(r'<([0-9A-Fa-f]+)>|(-?[\d.]+)', token.group(3)):
                    if part.group(1):
                        buf.append(decode(part.group(1)))
                    elif float(part.group(2)) < -150:
                        buf.append(' ')
            else:
                buf.append('\n')

        lines.extend(''.join(buf).split('\n'))

    return lines


def build(lines: list[str]) -> str:
    stripped = [line.strip() for line in lines]
    start = stripped.index('ГРУСТЬ')
    end = stripped.index('Справочные материалы')
    body = [line for line in stripped[start:end] if line]

    def is_header(line: str) -> bool:
        return line == line.upper() and bool(
            re.fullmatch(r'[А-ЯЁ]+(?: [А-ЯЁ]+)*', line)
        )

    categories: list[dict] = []
    for line in body:
        if is_header(line):
            categories.append({'raw': line, 'title': line.capitalize(), 'words': []})
        elif categories:
            if line not in categories[-1]['words']:
                categories[-1]['words'].append(line)

    # Книга делит список надвое: тяжёлые состояния, затем светлые.
    first_light = next(
        i for i, c in enumerate(categories) if c['raw'] == 'СЧАСТЛИВЫЙ'
    )
    for i, c in enumerate(categories):
        c['valence'] = 'light' if i >= first_light else 'heavy'
        c['id'] = slug(c['raw'])

    total = sum(len(c['words']) for c in categories)
    print(f'категорий: {len(categories)}, слов: {total}')

    entries = ',\n'.join(
        '  {\n'
        f"    id: '{c['id']}',\n"
        f"    title: '{c['title']}',\n"
        f"    valence: '{c['valence']}',\n"
        '    words: [\n'
        + ''.join(f"      '{w}',\n" for w in c['words'])
        + '    ],\n  }'
        for c in categories
    )

    return f'''// Сгенерировано разбором PDF книги — править руками не нужно.
// Источник: «Список слов для эмоций», раздел «Ресурсы для восстановления»
// в книге Jonice Webb «Running on Empty» (рус. изд. «Почти на нуле», 2022).
// {len(categories)} категорий, {total} слов. Разбор: scripts/extract-emotions.py (нужен PDF книги).

/**
 * Книга делит список ровно надвое: сначала тяжёлые состояния (Грусть →
 * Безразличный), затем светлые (Счастливый → Привлекательный). Мы намеренно
 * не называем их «негативными» и «позитивными» — автор настаивает, что плохих
 * эмоций не бывает, важно лишь то, что мы с ними делаем.
 */
export type Valence = 'heavy' | 'light'

export interface EmotionCategory {{
  id: string
  title: string
  valence: Valence
  words: string[]
}}

export const EMOTION_CATEGORIES: EmotionCategory[] = [
{entries},
]
'''


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    ts = build(extract_text(sys.argv[1]))
    io.open(OUT, 'w', encoding='utf-8').write(ts)
    print(f'записано: {OUT}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
