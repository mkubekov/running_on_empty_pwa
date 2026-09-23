/**
 * Кладёт запасной словарь на место сгенерированного, если его ещё нет.
 *
 * Полный словарь собирается из PDF книги и в репозиторий не входит, поэтому
 * после `git clone` файла emotionWords.generated.ts просто нет и сборка упала
 * бы на отсутствующем импорте. Этот шаг делает клон рабочим сразу.
 *
 * Существующий файл не трогаем: у того, кто собрал полный словарь скриптом
 * extract-emotions.py, он не должен подменяться запасным при каждом запуске.
 */
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const generated = join(root, 'src', 'content', 'emotionWords.generated.ts')
const example = join(root, 'src', 'content', 'emotionWords.example.ts')

if (existsSync(generated)) {
  process.exit(0)
}

copyFileSync(example, generated)
console.log(
  'Словаря не было — положил запасной (8 групп).\n' +
    'Полный собирается из книги: python scripts/extract-emotions.py "путь/к/книге.pdf"',
)
