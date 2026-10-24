"""Downloads the open-licence fonts used by the renderer into ml/assets/fonts (not committed).

All fonts are from the google/fonts repository under the SIL Open Font License 1.1.
Usage: uv run python -m synth.fonts
"""

import urllib.parse
import urllib.request
from pathlib import Path

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
BASE = "https://raw.githubusercontent.com/google/fonts/main/"

FONTS: dict[str, str] = {
    "serif": "ofl/notoserif/NotoSerif[wdth,wght].ttf",
    "serif_source": "ofl/sourceserif4/SourceSerif4[opsz,wght].ttf",
    "serif_pt": "ofl/ptserif/PT_Serif-Web-Regular.ttf",
    "sans_plex": "ofl/ibmplexsans/IBMPlexSans[wdth,wght].ttf",
    "sans_open": "ofl/opensans/OpenSans[wdth,wght].ttf",
    "sans_lato": "ofl/lato/Lato-Regular.ttf",
    "mono_plex": "ofl/ibmplexmono/IBMPlexMono-Regular.ttf",
    "mono_courier": "ofl/courierprime/CourierPrime-Regular.ttf",
    "mono_incons": "ofl/inconsolata/Inconsolata[wdth,wght].ttf",
    "mono_roboto": "ofl/robotomono/RobotoMono[wght].ttf",
    "mono_pt": "ofl/ptmono/PTM55FT.ttf",
    "deva": "ofl/notosansdevanagari/NotoSansDevanagari[wdth,wght].ttf",
}


def font_path(key: str) -> Path:
    return FONT_DIR / f"{key}.ttf"


def ensure_fonts() -> None:
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    for key, rel in FONTS.items():
        target = font_path(key)
        if target.exists() and target.stat().st_size > 10_000:
            continue
        url = BASE + urllib.parse.quote(rel)
        with urllib.request.urlopen(url, timeout=60) as r:
            target.write_bytes(r.read())
        print(f"downloaded {key}")


if __name__ == "__main__":
    ensure_fonts()
