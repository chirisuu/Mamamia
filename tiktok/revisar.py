#!/usr/bin/env python3
"""Revisa una cuenta de TikTok y guarda sus videos en videos.json.

Uso:
    python revisar.py                       # usa la cuenta de config (CUENTA)
    python revisar.py --cuenta otra.cuenta  # otra cuenta
    python revisar.py --nuevos nuevos.json  # además escribe ahí solo los videos nuevos

Fuentes, en orden:
  1. yt-dlp (lista la cuenta completa, la más fiable cuando TikTok no bloquea).
  2. La página pública de inserción de TikTok (/embed/@cuenta), con los más recientes.

La primera vez que corre solo guarda lo que ya había: no marca nada como "nuevo",
para no avisarte de golpe de todos los videos viejos.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CUENTA = "claudesinpermiso"
MAX_VIDEOS = 60          # cuántos de los más recientes mira en cada revisión
AQUI = Path(__file__).resolve().parent
ARCHIVO = AQUI / "videos.json"
AGENTE = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)


def ahora_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def fecha_desde_id(video_id: str) -> int | None:
    """Los IDs de TikTok llevan la fecha de subida en sus 32 bits altos."""
    try:
        ts = int(video_id) >> 32
    except ValueError:
        return None
    return ts if 1_451_606_400 < ts < 4_102_444_800 else None  # entre 2016 y 2100


def limpiar(texto) -> str:
    return re.sub(r"\s+", " ", str(texto or "")).strip()


def video(cuenta: str, vid: str, titulo="", fecha=None, duracion=None) -> dict:
    return {
        "id": vid,
        "url": f"https://www.tiktok.com/@{cuenta}/video/{vid}",
        "titulo": limpiar(titulo)[:300],
        "fecha": int(fecha) if fecha else fecha_desde_id(vid),
        "duracion": int(duracion) if duracion else None,
    }


# ---------- Fuente 1: yt-dlp ----------

def con_ytdlp(cuenta: str) -> list[dict]:
    from yt_dlp import YoutubeDL  # import aquí: si no está instalado, pasa a la fuente 2

    opciones = {
        "extract_flat": "in_playlist",
        "playlistend": MAX_VIDEOS,
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
    }
    with YoutubeDL(opciones) as ydl:
        info = ydl.extract_info(f"https://www.tiktok.com/@{cuenta}", download=False)

    videos = []
    for e in info.get("entries") or []:
        if not e or not str(e.get("id", "")).isdigit():
            continue
        videos.append(video(
            cuenta, str(e["id"]),
            titulo=e.get("title") or e.get("description"),
            fecha=e.get("timestamp"),
            duracion=e.get("duration"),
        ))
    if not videos:
        raise RuntimeError("yt-dlp no devolvió videos")
    return videos


# ---------- Fuente 2: página de inserción ----------

def con_embed(cuenta: str) -> list[dict]:
    pedido = urllib.request.Request(
        f"https://www.tiktok.com/embed/@{cuenta}",
        headers={"User-Agent": AGENTE, "Accept-Language": "es-ES,es;q=0.9"},
    )
    with urllib.request.urlopen(pedido, timeout=30) as r:
        html = r.read().decode("utf-8", "replace")

    m = re.search(
        r'<script[^>]+id="__FRONTITY_CONNECT_STATE__"[^>]*>(.*?)</script>', html, re.S
    )
    if not m:
        raise RuntimeError("la página de inserción no trae datos (¿cambió TikTok?)")
    estado = json.loads(m.group(1))
    datos = estado.get("source", {}).get("data", {}).get(f"/embed/@{cuenta}", {})

    videos = []
    for v in datos.get("videoList") or []:
        vid = str(v.get("id", ""))
        if vid.isdigit():
            videos.append(video(
                cuenta, vid,
                titulo=v.get("desc") or v.get("title"),
                fecha=v.get("createTime"),
                duracion=(v.get("video") or {}).get("duration"),
            ))
    if not videos:
        raise RuntimeError("la página de inserción no tiene videos")
    return videos


# ---------- Mezcla y guardado ----------

def cargar() -> dict:
    if ARCHIVO.exists():
        return json.loads(ARCHIVO.read_text(encoding="utf-8"))
    return {}


def mezclar(viejos: list[dict], encontrados: list[dict], cuando: str) -> tuple[list, list]:
    por_id = {v["id"]: v for v in viejos}
    nuevos = []
    for v in encontrados:
        previo = por_id.get(v["id"])
        if previo:
            # completa datos que antes faltaban, sin perder cuándo lo descubrimos
            for k in ("titulo", "fecha", "duracion"):
                if v.get(k) and not previo.get(k):
                    previo[k] = v[k]
        else:
            v["descubierto"] = cuando
            por_id[v["id"]] = v
            nuevos.append(v)
    todos = sorted(por_id.values(), key=lambda v: (v.get("fecha") or 0, v["id"]), reverse=True)
    nuevos.sort(key=lambda v: (v.get("fecha") or 0, v["id"]))  # avisos del más viejo al más nuevo
    return todos, nuevos


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--cuenta", default=CUENTA)
    p.add_argument("--nuevos", type=Path, help="archivo donde escribir solo los videos nuevos")
    args = p.parse_args()
    cuenta = args.cuenta.lstrip("@").strip()

    previo = cargar()
    if previo.get("cuenta") not in (None, cuenta):
        previo = {}  # cambiaste de cuenta: empieza de cero
    viejos = previo.get("videos", [])
    cuando = ahora_iso()

    encontrados, fuente, errores = None, None, []
    for nombre, fn in (("yt-dlp", con_ytdlp), ("embed", con_embed)):
        try:
            encontrados, fuente = fn(cuenta), nombre
            break
        except Exception as e:  # noqa: BLE001 — cualquier fallo pasa a la siguiente fuente
            errores.append(f"{nombre}: {limpiar(e)[:300]}")
            print(f"[aviso] {errores[-1]}", file=sys.stderr)

    if encontrados is None:
        datos = {**previo, "cuenta": cuenta, "videos": viejos,
                 "estado": "error", "error": " | ".join(errores)}
        if not previo.get("error_desde"):
            datos["error_desde"] = cuando
        nuevos = []
    else:
        todos, nuevos = mezclar(viejos, encontrados, cuando)
        if not viejos:
            nuevos = []  # primera revisión: no avises de todo el historial
        datos = {"cuenta": cuenta, "videos": todos, "estado": "ok", "fuente": fuente,
                 "ultima_novedad": cuando if (nuevos or not viejos) else previo.get("ultima_novedad")}

    # Solo reescribe el archivo si cambió algo (así no hay un commit cada pocas horas).
    comparar = lambda d: {k: v for k, v in d.items() if k != "revisado"}  # noqa: E731
    if comparar(datos) != comparar(previo):
        datos["revisado"] = cuando
        ARCHIVO.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.nuevos:
        args.nuevos.write_text(json.dumps(nuevos, ensure_ascii=False, indent=2), encoding="utf-8")

    if encontrados is None:
        print("No se pudo revisar la cuenta. Se mantienen los videos guardados.")
        return 0
    print(f"@{cuenta}: {len(encontrados)} videos leídos con {fuente}, "
          f"{len(nuevos)} nuevos, {len(datos['videos'])} guardados en total.")
    for v in nuevos:
        print(f"  NUEVO  {v['url']}  {v['titulo'][:80]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
