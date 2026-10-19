#!/usr/bin/env python3
"""Ordena as avaliações em temas e gera replica/feedback.md.
- peso: nota 1-2 = 3, nota 3 = 2, nota 4-5 = 1, sem nota (HN) = 1.5; mais recentes valem um pouco mais
- tema "fino" (< 3 avaliações ou 1 fonte só) é marcado como tal
- linhas sem link são descartadas (regra: toda citação tem link)
- lista pedidos ("wish", "please add", "would be nice"...) com as palavras dos usuários
- lista notas baixas que não caíram em nenhum tema, para leitura à mão
Uso: py -3 replica/research/rank.py replica/reviews.csv --out replica/feedback.md
"""
import argparse
import csv
import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
REQUEST = re.compile(r"\b(wish|please add|would love|would be (?:nice|great)|i want|need(?:s)? (?:a|an|to be able)|missing|add (?:a|an|the) |feature request|gostaria|falta|poderia ter|seria bom)\b", re.I)


def weight(row):
    r = row["rating"].strip()
    w = 1.5 if not r else 3 if int(r) <= 2 else 2 if int(r) == 3 else 1
    try:
        age = (date.today() - date.fromisoformat(row["date"])).days
        w *= 1.3 if age < 365 else 1.0 if age < 3 * 365 else 0.7
    except ValueError:
        pass
    return w


def source_of(s):
    return "app-store" if s.startswith("app-store") else s


def excerpt(text, kw, n=260):
    """Trecho literal em volta da palavra (sem reescrever nada)."""
    i = text.lower().find(kw.lower())
    if len(text) <= n or i < 0:
        return text if len(text) <= n else text[:n].rstrip() + "…"
    start = max(0, i - n // 2)
    return ("…" if start else "") + text[start:start + n].strip() + ("…" if start + n < len(text) else "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--out", required=True)
    ap.add_argument("--themes", default=str(HERE / "themes.json"))
    a = ap.parse_args()
    themes = json.loads(Path(a.themes).read_text(encoding="utf-8"))
    rows = [r for r in csv.DictReader(open(a.csv, encoding="utf-8")) if r["url"].startswith("http") and r["text"].strip()]

    # casa a palavra-chave só no começo de uma palavra (evita "ink" em "link", "pen" em "open")
    pats = {t: [(k.strip(), re.compile(r"(?<![a-z0-9à-ú])" + re.escape(k.strip().lower()), re.I)) for k in kws] for t, kws in themes.items()}
    hits = defaultdict(list)
    unmatched_low = []
    requests = []
    for r in rows:
        low = r["text"].lower()
        matched = False
        for theme, ps in pats.items():
            kw = next((k for k, p in ps if p.search(low)), None)
            if kw:
                hits[theme].append((r, kw))
                matched = True
        if not matched and r["rating"] and int(r["rating"]) <= 2:
            unmatched_low.append(r)
        if REQUEST.search(r["text"]):
            requests.append(r)

    ranked = sorted(hits.items(), key=lambda kv: -sum(weight(r) for r, _ in kv[1]))
    by_src = defaultdict(int)
    for r in rows:
        by_src[r["source"]] += 1
    ratings = [int(r["rating"]) for r in rows if r["rating"]]

    out = ["# Feedback: o que os usuários do Miro dizem", ""]
    out.append(f"Amostra: **{len(rows)} linhas** com link ({', '.join(f'{k}: {v}' for k, v in sorted(by_src.items()))}).")
    if ratings:
        out.append(f"App Store: {len(ratings)} avaliações com nota; média {sum(ratings) / len(ratings):.2f}; "
                   f"notas 1–2: {sum(1 for x in ratings if x <= 2)}, nota 3: {sum(1 for x in ratings if x == 3)}, 4–5: {sum(1 for x in ratings if x >= 4)}.")
    out.append("Hacker News: comentários que citam o Miro (nem todos são avaliações; leia o contexto pelo link).")
    out.append("")
    out.append("## Temas (ordenados por peso: notas baixas e recentes pesam mais)")
    out.append("")
    out.append("| # | tema | linhas | fontes | notas 1–3 | peso | |")
    out.append("| --- | --- | --- | --- | --- | --- | --- |")
    for i, (t, lst) in enumerate(ranked, 1):
        srcs = {source_of(r["source"]) for r, _ in lst}
        lowc = sum(1 for r, _ in lst if r["rating"] and int(r["rating"]) <= 3)
        thin = "fino" if len(lst) < 3 or len(srcs) < 2 else ""
        out.append(f"| {i} | {t} | {len(lst)} | {len(srcs)} | {lowc} | {sum(weight(r) for r, _ in lst):.1f} | {thin} |")
    out.append("")
    for t, lst in ranked:
        out.append(f"### {t}")
        out.append("")
        best = sorted(lst, key=lambda x: (-weight(x[0]), len(x[0]["text"])))[:6]
        for r, kw in best:
            nota = f"nota {r['rating']}" if r["rating"] else "sem nota"
            out.append(f"- ({r['source']}, {nota}, {r['date']}) “{excerpt(r['text'], kw)}” — [link]({r['url']})")
        out.append("")
    out.append("## Pedidos nas palavras dos usuários")
    out.append("")
    for r in sorted(requests, key=lambda r: -weight(r))[:40]:
        m = REQUEST.search(r["text"])
        out.append(f"- ({r['source']}, {r['rating'] or 'sem nota'}) “{excerpt(r['text'], m.group(0).lower())}” — [link]({r['url']})")
    out.append("")
    out.append("## Notas baixas que não caíram em nenhum tema (ler à mão)")
    out.append("")
    for r in unmatched_low:
        out.append(f"- ({r['source']}, nota {r['rating']}, {r['date']}) “{excerpt(r['text'], '')}” — [link]({r['url']})")
    Path(a.out).write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"{len(rows)} linhas, {len(ranked)} temas, {len(requests)} pedidos, {len(unmatched_low)} notas baixas sem tema -> {a.out}")


if __name__ == "__main__":
    main()
