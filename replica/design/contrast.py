#!/usr/bin/env python3
"""Checa contraste WCAG de todos os pares em tokens.json.

Uso: python contrast.py replica/design/tokens.json
Pares: [fg, bg, kind]  kind = body (>= 4.5), large (>= 3), ui (>= 3: bordas de input, foco, seleção)
Nomes podem ser "texto" (grupo color) ou "grupo.nome" (ex.: sticky.ink).
Sai com código 1 se algum par falhar.
"""
import json
import sys

MIN = {"body": 4.5, "large": 3.0, "ui": 3.0}


def resolve(tokens, name):
    group, _, key = name.rpartition(".")
    return tokens[group or "color"][key]


def luminance(hex_color):
    h = hex_color.lstrip("#")
    if len(h) != 6:
        raise ValueError(f"cor não hex de 6 dígitos: {hex_color}")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = out
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(fg, bg):
    a, b = sorted((luminance(fg), luminance(bg)), reverse=True)
    return (a + 0.05) / (b + 0.05)


def main(path):
    with open(path, encoding="utf-8") as f:
        tokens = json.load(f)
    fails = 0
    print(f"{'fg':<24} {'bg':<20} {'tipo':<6} {'razão':>6}  resultado")
    for fg, bg, kind in tokens["pairs"]:
        r = ratio(resolve(tokens, fg), resolve(tokens, bg))
        ok = r >= MIN[kind]
        fails += not ok
        print(f"{fg:<24} {bg:<20} {kind:<6} {r:6.2f}  {'ok' if ok else 'FALHA (mín ' + str(MIN[kind]) + ')'}")
    print(f"\n{len(tokens['pairs'])} pares, {fails} falha(s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "replica/design/tokens.json"))
