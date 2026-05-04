from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

NS_MAIN = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
NS_REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'


def col_to_index(cell_ref: str) -> int:
    letters = ''.join(ch for ch in cell_ref if ch.isalpha())
    index = 0
    for ch in letters:
        index = (index * 26) + (ord(ch.upper()) - ord('A') + 1)
    return index - 1


def read_shared_strings(zf: ZipFile) -> list[str]:
    if 'xl/sharedStrings.xml' not in zf.namelist():
        return []

    root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
    values: list[str] = []
    for si in root.findall(f'.//{NS_MAIN}si'):
        parts = [t.text or '' for t in si.findall(f'.//{NS_MAIN}t')]
        values.append(''.join(parts))
    return values


def read_first_sheet_path(zf: ZipFile) -> str:
    wb = ET.fromstring(zf.read('xl/workbook.xml'))
    sheets = wb.find(f'{NS_MAIN}sheets')
    if sheets is None or len(sheets) == 0:
        raise ValueError('Workbook has no sheets.')

    first_sheet = sheets[0]
    rel_id = first_sheet.attrib.get(f'{NS_REL}id')
    if not rel_id:
        raise ValueError('First sheet relationship id not found.')

    rels = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))
    for rel in rels:
        if rel.attrib.get('Id') == rel_id:
            target = rel.attrib.get('Target')
            if not target:
                break
            return f"xl/{target}" if not target.startswith('/') else target.lstrip('/')

    raise ValueError('Could not resolve first worksheet path.')


def parse_sheet_rows(zf: ZipFile, sheet_path: str, shared_strings: list[str]) -> list[list[str]]:
    root = ET.fromstring(zf.read(sheet_path))
    rows_out: list[list[str]] = []

    for row in root.findall(f'.//{NS_MAIN}sheetData/{NS_MAIN}row'):
        cells: dict[int, str] = {}
        max_index = -1

        for c in row.findall(f'{NS_MAIN}c'):
            ref = c.attrib.get('r', '')
            idx = col_to_index(ref) if ref else (max_index + 1)
            max_index = max(max_index, idx)

            cell_type = c.attrib.get('t')
            v = c.find(f'{NS_MAIN}v')
            is_elem = c.find(f'{NS_MAIN}is')

            value = ''
            if cell_type == 's' and v is not None and v.text is not None:
                value = shared_strings[int(v.text)]
            elif cell_type == 'inlineStr' and is_elem is not None:
                ts = [t.text or '' for t in is_elem.findall(f'.//{NS_MAIN}t')]
                value = ''.join(ts)
            elif v is not None and v.text is not None:
                value = v.text

            cells[idx] = value

        row_values = [cells.get(i, '') for i in range(max_index + 1)] if max_index >= 0 else []
        rows_out.append(row_values)

    return rows_out


def clean_header(value: str) -> str:
    return re.sub(r'\s+', ' ', value.strip())


def convert(input_xlsx: Path, output_json: Path) -> int:
    with ZipFile(input_xlsx) as zf:
        shared_strings = read_shared_strings(zf)
        first_sheet_path = read_first_sheet_path(zf)
        rows = parse_sheet_rows(zf, first_sheet_path, shared_strings)

    if not rows:
        raise ValueError('No rows found in first worksheet.')

    headers = [clean_header(h) for h in rows[0]]
    slug_idx = next((i for i, h in enumerate(headers) if h.lower() == 'slug'), None)
    if slug_idx is None:
        raise ValueError('Could not find a "slug" column in headers.')

    shelters: dict[str, dict[str, str]] = {}
    for row in rows[1:]:
        padded = row + [''] * (len(headers) - len(row))
        item = {headers[i]: padded[i] for i in range(len(headers))}
        slug = item.get(headers[slug_idx], '').strip()
        if not slug:
            continue
        shelters[slug] = item

    output_json.write_text(json.dumps(shelters, indent=2, ensure_ascii=False) + '\n')
    return len(shelters)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Convert shelter-list Excel data to slug-keyed JSON.'
    )
    parser.add_argument(
        '--input',
        type=Path,
        default=Path('/Users/johnneed/Projects/gmc-shelters/sheleter-list.xlsx'),
        help='Path to source .xlsx file.'
    )
    parser.add_argument(
        '--output',
        type=Path,
        default=Path('/Users/johnneed/Projects/gmc-shelters/shelter-list.json'),
        help='Path to output .json file.'
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.input.exists():
        raise FileNotFoundError(f'Source file not found: {args.input}')

    args.output.parent.mkdir(parents=True, exist_ok=True)
    count = convert(args.input, args.output)
    print(f'Wrote {count} shelters to {args.output}')


if __name__ == '__main__':
    main()

