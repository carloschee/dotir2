#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
optimizar_media.py
Dotir 2 — Optimizador de assets de audio y video

Escanea assets/audio/*.mp3 y assets/videos/*.mp4 (no recursivo),
optimiza con ffmpeg y reemplaza los originales in-place.
Guarda backups en assets/audio/_backup/ y assets/videos/_backup/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    python3 optimizar_media.py [opciones]

Ejecutar desde la raiz del repositorio (donde esta assets/).
Requiere ffmpeg y ffprobe instalados en el PATH.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLAGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Modo
----
  (sin flags)          Procesa todos los MP3 y MP4 con valores por defecto.

  --dry-run            Simula el proceso completo sin modificar ningun archivo.
                       Muestra la estrategia que se aplicaria a cada archivo.
                       Util para revisar antes de ejecutar en produccion.

  --solo-audio         Procesa unicamente los archivos MP3.
                       Ignora assets/videos/ por completo.

  --solo-video         Procesa unicamente los archivos MP4.
                       Ignora assets/audio/ por completo.

Audio MP3
---------
  --audio-br N         Bitrate de salida para los MP3, en kbps.
                       Default: 128
                       Rango recomendado: 96–192
                       Para contenido infantil, 128 es imperceptible vs 192+.
                       Tambien normaliza el sample rate a 44.1 kHz (estandar MP3).

Video MP4
---------
  --crf N              Factor de calidad constante para reencoder H.264.
                       Default: 28
                       Rango util: 18 (casi sin perdida) – 35 (muy comprimido).
                       Solo se usa cuando el video requiere reencoder completo
                       (ver logica de estrategia abajo).

  --audio-mp4-br N     Bitrate del stream de audio dentro del MP4, en kbps.
                       Default: 96
                       El audio original de los MP4 de Dotir 2 suele estar
                       a 128–132 kbps AAC; bajar a 96 es inaudible en video
                       infantil y ahorra ~25% del audio.

  --umbral-px N        Ancho maximo (en pixeles) para considerar un video
                       "pequeno" y evitar reencoder de video.
                       Default: 854  (equivale a 480p landscape)
                       Sube a 1280 si quieres incluir videos 720p en la
                       estrategia de copia directa (-c:v copy).

General
-------
  --raiz DIR           Ruta al directorio raiz del proyecto.
                       Default: directorio de trabajo actual (.)
                       Util si el script se ejecuta desde otra ubicacion:
                         python3 ~/scripts/optimizar_media.py --raiz ~/dotir2

  --sin-backup         Omite las copias de seguridad antes de reemplazar.
                       PELIGROSO: si ffmpeg produce un archivo corrupto,
                       no hay forma de recuperar el original.
                       Usar solo si el repositorio git esta limpio y se
                       puede hacer git checkout para restaurar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRATEGIA DE VIDEO (auto-detectada por ffprobe)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

El script inspecciona cada MP4 antes de procesarlo y elige:

  [A] Video H.264 con ancho <= umbral-px  Y  audio con bitrate alto
        -c:v copy                 (video sin tocar, instantaneo)
        -c:a aac -b:a 96k         (audio recomprimido)
        -movflags +faststart      (moov atom al inicio, mejor streaming)

  [B] Video H.264 con ancho <= umbral-px  Y  audio ya optimo
        -c:v copy -c:a copy       (todo se copia sin reencoder)
        -movflags +faststart      (solo reordena el contenedor)

  [C] Video en resolucion mayor O codec distinto a H.264
        -c:v libx264 -crf N       (reencoder completo)
        -vf scale='min(1280,iw)':-2   (max 1280px ancho, aspect ratio auto)
        -r 24                     (24 fps)
        -c:a aac -b:a 96k
        -movflags +faststart

En todos los casos: si el archivo de salida pesa igual o mas que el
original (margen 2%), el original se deja intacto y no se reemplaza.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EJEMPLOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  # Ver que haria sin modificar nada
  python3 optimizar_media.py --dry-run

  # Procesar todo con valores por defecto (recomendado para empezar)
  python3 optimizar_media.py

  # Solo audio, bitrate mas agresivo
  python3 optimizar_media.py --solo-audio --audio-br 96

  # Solo video, CRF mas agresivo para videos grandes
  python3 optimizar_media.py --solo-video --crf 30

  # Incluir videos 720p en la estrategia de copia directa
  python3 optimizar_media.py --solo-video --umbral-px 1280

  # Desde otra ubicacion, sin backup (solo si git esta limpio)
  python3 optimizar_media.py --raiz ~/proyectos/dotir2 --sin-backup
"""

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


# ── Colores ANSI ──────────────────────────────────────────────────────────────
class C:
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    GREEN  = "\033[92m"
    YELLOW = "\033[93m"
    RED    = "\033[91m"
    CYAN   = "\033[96m"
    BLUE   = "\033[94m"
    DIM    = "\033[2m"

def bold(s):   return f"{C.BOLD}{s}{C.RESET}"
def green(s):  return f"{C.GREEN}{s}{C.RESET}"
def yellow(s): return f"{C.YELLOW}{s}{C.RESET}"
def red(s):    return f"{C.RED}{s}{C.RESET}"
def cyan(s):   return f"{C.CYAN}{s}{C.RESET}"
def blue(s):   return f"{C.BLUE}{s}{C.RESET}"
def dim(s):    return f"{C.DIM}{s}{C.RESET}"


# ── Utilidades ────────────────────────────────────────────────────────────────
def fmt_bytes(n):
    if n < 1024:
        return f"{n} B"
    if n < 1024 ** 2:
        return f"{n/1024:.1f} KB"
    return f"{n/1024**2:.2f} MB"

def pct_ahorro(original, nuevo):
    if original == 0:
        return 0.0
    return (1 - nuevo / original) * 100

def verificar_ffmpeg():
    for cmd in ("ffmpeg", "ffprobe"):
        if shutil.which(cmd) is None:
            print(red(f"\n[ERROR] '{cmd}' no encontrado en PATH."))
            print("        Instala ffmpeg: https://ffmpeg.org/download.html")
            print("        macOS:   brew install ffmpeg")
            print("        Ubuntu:  sudo apt install ffmpeg\n")
            sys.exit(1)


def inspeccionar_video(ruta: Path) -> dict:
    """
    Usa ffprobe para obtener codec, resolucion, framerate y bitrate de audio
    del primer stream de video y audio del archivo.
    Devuelve un dict con las claves:
        v_codec, v_width, v_height, v_fps, a_codec, a_bitrate_kbps
    o None si falla.
    """
    try:
        proc = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_streams",
                str(ruta),
            ],
            capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=30
        )
        data = json.loads(proc.stdout)
        streams = data.get("streams", [])

        info = {
            "v_codec": None, "v_width": 0, "v_height": 0, "v_fps": 0.0,
            "a_codec": None, "a_bitrate_kbps": 0,
        }

        for s in streams:
            if s.get("codec_type") == "video" and info["v_codec"] is None:
                info["v_codec"]  = s.get("codec_name", "")
                info["v_width"]  = int(s.get("width", 0))
                info["v_height"] = int(s.get("height", 0))
                # fps puede venir como "25/1" o "30000/1001"
                fps_raw = s.get("avg_frame_rate", "0/1")
                try:
                    num, den = fps_raw.split("/")
                    info["v_fps"] = round(float(num) / float(den), 3) if float(den) else 0
                except Exception:
                    info["v_fps"] = 0.0

            if s.get("codec_type") == "audio" and info["a_codec"] is None:
                info["a_codec"] = s.get("codec_name", "")
                br = s.get("bit_rate")
                if br:
                    info["a_bitrate_kbps"] = int(br) // 1000

        return info
    except Exception:
        return None


def elegir_estrategia_video(info: dict, crf: int, audio_mp4_br: int,
                             umbral_px: int) -> tuple[list, str]:
    """
    Decide el comando ffmpeg y devuelve (args_extra, descripcion_estrategia).
    
    Criterios para copiar video sin reencoder:
      - codec ya es h264
      - ancho <= umbral_px (default 854, es decir 480p o menos)
    
    En todos los casos se reencoda el audio si su bitrate actual supera
    el objetivo, y siempre se aplica +faststart.
    """
    v_codec = info.get("v_codec", "") if info else ""
    v_width = info.get("v_width", 0)  if info else 0
    a_br    = info.get("a_bitrate_kbps", 0) if info else 0

    ya_es_h264     = v_codec == "h264"
    resolucion_ok  = 0 < v_width <= umbral_px
    audio_excesivo = a_br > audio_mp4_br + 10   # margen 10 kbps

    if ya_es_h264 and resolucion_ok:
        # Video: copiar sin reencoder
        # Audio: reencoder solo si el bitrate actual es mayor al objetivo
        if audio_excesivo:
            cmd_av = ["-c:v", "copy", "-c:a", "aac", "-b:a", f"{audio_mp4_br}k"]
            desc = (f"video copy H.264 {v_width}p  |  "
                    f"audio AAC {a_br}k -> {audio_mp4_br}k  |  +faststart")
        else:
            cmd_av = ["-c:v", "copy", "-c:a", "copy"]
            desc = (f"video copy H.264 {v_width}p  |  "
                    f"audio copy ({a_br}k ya optimo)  |  +faststart")
        return cmd_av + ["-movflags", "+faststart"], desc
    else:
        # Reencoder video completo
        res_desc = f"{v_width}p -> max 1280px" if v_width > umbral_px else f"{v_width}p"
        cmd_av = [
            "-c:v", "libx264",
            "-crf", str(crf),
            "-preset", "slow",
            "-vf", "scale='min(1280,iw)':-2",
            "-r", "24",
            "-c:a", "aac",
            "-b:a", f"{audio_mp4_br}k",
            "-movflags", "+faststart",
        ]
        desc = (f"reencoder libx264 CRF{crf} {res_desc}  |  "
                f"audio AAC {audio_mp4_br}k  |  +faststart")
        return cmd_av, desc


# ── Procesamiento MP3 ─────────────────────────────────────────────────────────
def optimizar_mp3(src: Path, audio_br: int, dry_run: bool, sin_backup: bool) -> dict:
    """
    Reencoda un MP3 a audio_br kbps / 44.1 kHz con ffmpeg.
    Normaliza sample rate de 48 kHz a 44.1 kHz si hace falta.
    """
    resultado = {
        "archivo":       src.name,
        "ruta":          src,
        "tipo":          "audio",
        "estrategia":    f"libmp3lame {audio_br}k / 44.1kHz",
        "ok":            False,
        "omitido":       False,
        "bytes_antes":   src.stat().st_size,
        "bytes_despues": 0,
        "error":         None,
    }

    if dry_run:
        resultado["omitido"] = True
        resultado["bytes_despues"] = resultado["bytes_antes"]
        print(f"  {dim('[dry-run]')} {src.name}  {dim(resultado['estrategia'])}")
        return resultado

    backup_dir = src.parent / "_backup"
    tmp_path = None

    try:
        if not sin_backup:
            backup_dir.mkdir(exist_ok=True)
            shutil.copy2(src, backup_dir / src.name)

        with tempfile.NamedTemporaryFile(
            suffix=".mp3", dir=src.parent, delete=False
        ) as tmp:
            tmp_path = Path(tmp.name)

        cmd = [
            "ffmpeg", "-y",
            "-i", str(src),
            "-codec:a", "libmp3lame",
            "-b:a", f"{audio_br}k",
            "-ar", "44100",
            "-map_metadata", "0",
            "-id3v2_version", "3",
            str(tmp_path),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=120)

        if proc.returncode != 0:
            raise RuntimeError(proc.stderr[-400:])

        if not tmp_path.exists() or tmp_path.stat().st_size < 1024:
            raise RuntimeError("Archivo de salida vacio o corrupto.")

        bytes_nuevo = tmp_path.stat().st_size

        if bytes_nuevo >= resultado["bytes_antes"] * 0.98:
            tmp_path.unlink(missing_ok=True)
            resultado["omitido"] = True
            resultado["bytes_despues"] = resultado["bytes_antes"]
            print(f"  {yellow('=')} {src.name}  {dim('(ya estaba optimo, sin cambios)')}")
            return resultado

        shutil.move(str(tmp_path), str(src))
        resultado["ok"] = True
        resultado["bytes_despues"] = bytes_nuevo

    except Exception as e:
        resultado["error"] = str(e)
        if tmp_path and tmp_path.exists():
            tmp_path.unlink(missing_ok=True)

    return resultado


# ── Procesamiento MP4 ─────────────────────────────────────────────────────────
def optimizar_mp4(src: Path, crf: int, audio_mp4_br: int,
                  umbral_px: int, dry_run: bool, sin_backup: bool) -> dict:
    """
    Optimiza un MP4 con estrategia auto-detectada:
      - Video 480p H.264 o menor -> copia stream de video, solo toca audio y faststart
      - Video de mayor resolucion o codec distinto -> reencoda con libx264 CRF
    Siempre aplica -movflags +faststart.
    """
    info = inspeccionar_video(src)
    cmd_av, estrategia = elegir_estrategia_video(info, crf, audio_mp4_br, umbral_px)

    resultado = {
        "archivo":       src.name,
        "ruta":          src,
        "tipo":          "video",
        "estrategia":    estrategia,
        "ok":            False,
        "omitido":       False,
        "bytes_antes":   src.stat().st_size,
        "bytes_despues": 0,
        "error":         None,
    }

    if dry_run:
        resultado["omitido"] = True
        resultado["bytes_despues"] = resultado["bytes_antes"]
        print(f"  {dim('[dry-run]')} {src.name}")
        print(f"             {dim(estrategia)}")
        return resultado

    backup_dir = src.parent / "_backup"
    tmp_path = None

    try:
        if not sin_backup:
            backup_dir.mkdir(exist_ok=True)
            shutil.copy2(src, backup_dir / src.name)

        with tempfile.NamedTemporaryFile(
            suffix=".mp4", dir=src.parent, delete=False
        ) as tmp:
            tmp_path = Path(tmp.name)

        cmd = ["ffmpeg", "-y", "-i", str(src)] + cmd_av + [
            "-map_metadata", "0",
            str(tmp_path),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=600)

        if proc.returncode != 0:
            raise RuntimeError(proc.stderr[-400:])

        if not tmp_path.exists() or tmp_path.stat().st_size < 4096:
            raise RuntimeError("Archivo de salida vacio o corrupto.")

        bytes_nuevo = tmp_path.stat().st_size

        # Para el caso "copy" con audio ya optimo, aceptar incluso si no encoge
        # (el faststart por si solo puede no cambiar el tamaño significativamente)
        es_solo_faststart = "-c:a" not in cmd_av or cmd_av[cmd_av.index("-c:a") + 1] == "copy"
        margen = 1.005 if es_solo_faststart else 0.98

        if bytes_nuevo >= resultado["bytes_antes"] * margen:
            tmp_path.unlink(missing_ok=True)
            resultado["omitido"] = True
            resultado["bytes_despues"] = resultado["bytes_antes"]
            print(f"  {yellow('=')} {src.name}  {dim('(ya estaba optimo, sin cambios)')}")
            return resultado

        shutil.move(str(tmp_path), str(src))
        resultado["ok"] = True
        resultado["bytes_despues"] = bytes_nuevo

    except Exception as e:
        resultado["error"] = str(e)
        if tmp_path and tmp_path.exists():
            tmp_path.unlink(missing_ok=True)

    return resultado


# ── Reporte de un archivo ─────────────────────────────────────────────────────
def imprimir_resultado(r: dict):
    nombre   = r["archivo"]
    antes    = r["bytes_antes"]
    despues  = r["bytes_despues"]
    estrategia = r.get("estrategia", "")

    if r.get("error"):
        print(f"  {red('X')} {nombre}")
        print(f"    {red('Error:')} {r['error'][:120]}")
        return

    if r.get("omitido") and not r.get("ok"):
        return  # ya se imprimio dentro de la funcion

    ahorro = antes - despues
    pct    = pct_ahorro(antes, despues)
    print(
        f"  {green(chr(10003))} {nombre}  "
        f"{dim(fmt_bytes(antes))} -> {green(fmt_bytes(despues))}  "
        f"{cyan('-' + fmt_bytes(ahorro))}  "
        f"{bold(f'{pct:.1f}% menos')}"
    )
    if estrategia:
        print(f"    {dim(estrategia)}")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Optimiza MP3 y MP4 de Dotir 2 con ffmpeg",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--dry-run",      action="store_true",
                        help="Solo simula, no modifica archivos")
    parser.add_argument("--solo-audio",   action="store_true",
                        help="Solo procesa MP3")
    parser.add_argument("--solo-video",   action="store_true",
                        help="Solo procesa MP4")
    parser.add_argument("--crf",          type=int, default=28, metavar="N",
                        help="CRF para reencoder H.264 (18-35, default 28)")
    parser.add_argument("--audio-br",     type=int, default=128, metavar="N",
                        help="Bitrate MP3 en kbps (default 128)")
    parser.add_argument("--audio-mp4-br", type=int, default=96, metavar="N",
                        help="Bitrate audio dentro de MP4 en kbps (default 96)")
    parser.add_argument("--umbral-px",    type=int, default=854, metavar="N",
                        help="Ancho max para considerar video pequeno (default 854 = 480p)")
    parser.add_argument("--raiz",         type=str, default=".", metavar="DIR",
                        help="Directorio raiz del proyecto")
    parser.add_argument("--sin-backup",   action="store_true",
                        help="No guarda copias de seguridad (peligroso)")
    args = parser.parse_args()

    raiz       = Path(args.raiz).resolve()
    dir_audio  = raiz / "assets" / "audio"
    dir_videos = raiz / "assets" / "videos"

    print()
    print(bold("=" * 62))
    print(bold("  Dotir 2 — Optimizador de media"))
    print(bold("=" * 62))
    print(f"  Raiz:           {raiz}")
    print(f"  Bitrate MP3:    {args.audio_br} kbps")
    print(f"  Bitrate audio MP4: {args.audio_mp4_br} kbps")
    print(f"  CRF (reencoder):   {args.crf}  |  Umbral 'pequeno': {args.umbral_px}px ancho")
    if args.dry_run:
        print(f"  Modo:           {yellow('DRY RUN — no se modificara nada')}")
    print(f"  Backups:        {red('DESACTIVADOS') if args.sin_backup else green('activados') + '  (_backup/ en cada carpeta)'}")
    print(bold("=" * 62))
    print()

    verificar_ffmpeg()

    resultados = []

    # ── MP3 ──
    if not args.solo_video:
        if not dir_audio.is_dir():
            print(yellow(f"[AVISO] No se encontro: {dir_audio}"))
        else:
            mp3s = sorted(dir_audio.glob("*.mp3"))
            if not mp3s:
                print(yellow("  No hay archivos .mp3 en assets/audio/"))
            else:
                print(bold(f"Audio ({len(mp3s)} archivos MP3)"))
                print(dim(f"  Carpeta: {dir_audio}"))
                for f in mp3s:
                    r = optimizar_mp3(f, args.audio_br, args.dry_run, args.sin_backup)
                    imprimir_resultado(r)
                    resultados.append(r)
                print()

    # ── MP4 ──
    if not args.solo_audio:
        if not dir_videos.is_dir():
            print(yellow(f"[AVISO] No se encontro: {dir_videos}"))
        else:
            mp4s = sorted(dir_videos.glob("*.mp4"))
            if not mp4s:
                print(yellow("  No hay archivos .mp4 en assets/videos/"))
            else:
                print(bold(f"Video ({len(mp4s)} archivos MP4)"))
                print(dim(f"  Carpeta: {dir_videos}"))
                for f in mp4s:
                    r = optimizar_mp4(
                        f, args.crf, args.audio_mp4_br,
                        args.umbral_px, args.dry_run, args.sin_backup
                    )
                    imprimir_resultado(r)
                    resultados.append(r)
                print()

    # ── Resumen ──
    if not resultados:
        print(yellow("No se proceso ningun archivo."))
        return

    total_antes   = sum(r["bytes_antes"] for r in resultados)
    total_despues = sum(
        r["bytes_despues"] if not r.get("error") else r["bytes_antes"]
        for r in resultados
    )
    total_ahorro = total_antes - total_despues
    n_ok         = sum(1 for r in resultados if r.get("ok"))
    n_omitidos   = sum(1 for r in resultados if r.get("omitido"))
    n_errores    = sum(1 for r in resultados if r.get("error"))

    print(bold("=" * 62))
    print(bold("  Resumen"))
    print(bold("=" * 62))
    print(f"  Archivos optimizados: {green(str(n_ok))}")
    print(f"  Ya estaban optimos:   {n_omitidos}")
    print(f"  Errores:              {red(str(n_errores)) if n_errores else '0'}")
    print(f"  Tamano original:      {fmt_bytes(total_antes)}")
    print(f"  Tamano final:         {fmt_bytes(total_despues)}")
    print(f"  Ahorro total:         {cyan(fmt_bytes(total_ahorro))}  "
          f"({bold(f'{pct_ahorro(total_antes, total_despues):.1f}% menos')})")

    if not args.sin_backup and not args.dry_run and n_ok > 0:
        print()
        print(dim("  Backups guardados en:"))
        print(dim(f"    {dir_audio}/_backup/"))
        print(dim(f"    {dir_videos}/_backup/"))

    print(bold("=" * 62))
    print()

    if n_errores > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()