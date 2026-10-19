#!/usr/bin/env python3
"""Coleta avaliações PÚBLICAS do Miro só por fontes oficiais e permitidas:
  - App Store: feed RSS oficial de avaliações da Apple (us e br, até 10 páginas cada)
  - Hacker News: API oficial da Algolia (comentários que citam o Miro)
Grava replica/reviews.csv com: source,url,date,rating,text (texto exato, sem edição).
Uso: py -3 replica/research/collect.py
"""
import csv
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

APP_ID = "1180074773"  # Miro: your visual workspace (Realtimeboard Inc.)
OUT = Path(__file__).resolve().parents[1] / "reviews.csv"
UA = {"User-Agent": "mentoria-board-research/1.0 (leitura de avaliações públicas)"}


def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def app_store(country):
    rows = []
    for page in range(1, 11):
        url = f"https://itunes.apple.com/{country}/rss/customerreviews/page={page}/id={APP_ID}/sortBy=mostRecent/json"
        try:
            feed = get_json(url).get("feed", {})
        except Exception as e:  # página inexistente ou fora do ar: registra e segue
            print(f"  app store {country} p{page}: {e}", file=sys.stderr)
            break
        entries = feed.get("entry", [])
        if isinstance(entries, dict):
            entries = [entries]
        entries = [e for e in entries if "im:rating" in e]  # a 1ª entrada às vezes é o próprio app
        if not entries:
            break
        for e in entries:
            rid = e.get("id", {}).get("label", "")
            title = e.get("title", {}).get("label", "").strip()
            body = e.get("content", {}).get("label", "").strip()
            text = f"{title}. {body}" if title else body
            link = f"https://apps.apple.com/{country}/app/id{APP_ID}?see-all=reviews#review-{rid}"
            rows.append(("app-store-" + country, link, e.get("updated", {}).get("label", "")[:10], e["im:rating"]["label"], text))
        time.sleep(1.0)  # ritmo de leitura, sem martelar o servidor
    return rows


def hacker_news():
    rows = []
    seen = set()
    for q in ["miro whiteboard", "miro board", "\"miro\" alternative", "miro pricing"]:
        url = "https://hn.algolia.com/api/v1/search_by_date?" + urllib.parse.urlencode({"query": q, "tags": "comment", "hitsPerPage": 100})
        try:
            data = get_json(url)
        except Exception as e:
            print(f"  hn '{q}': {e}", file=sys.stderr)
            continue
        for h in data.get("hits", []):
            oid = h.get("objectID")
            raw = h.get("comment_text") or ""
            if oid in seen or not re.search(r"\bmiro\b", raw, re.I):
                continue
            seen.add(oid)
            text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
            text = re.sub(r"\s+", " ", text).strip()
            rows.append(("hacker-news", f"https://news.ycombinator.com/item?id={oid}", (h.get("created_at") or "")[:10], "", text))
        time.sleep(1.0)
    return rows


if __name__ == "__main__":
    import urllib.parse  # noqa: E402 (usado em hacker_news)

    all_rows = []
    for c in ("us", "br"):
        r = app_store(c)
        print(f"app store {c}: {len(r)} avaliações")
        all_rows += r
    r = hacker_news()
    print(f"hacker news: {len(r)} comentários que citam o Miro")
    all_rows += r
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["source", "url", "date", "rating", "text"])
        w.writerows(all_rows)
    print(f"total: {len(all_rows)} linhas -> {OUT}")
