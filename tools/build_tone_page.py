from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "src" / "page-template.html"
BUNDLE = ROOT / "src" / "vendor" / "Tone-15.1.22.js"
LICENSE = ROOT / "src" / "vendor" / "Tone-15.1.22.LICENSE.txt"
SOURCE = ROOT / "src" / "march-tone.js"
OUTPUT = ROOT / "references" / "march-of-the-fallen-tone.html"


def main():
    html = TEMPLATE.read_text()
    license_text = LICENSE.read_text().strip()
    html = html.replace("<!-- LICENSE_BLOCK -->", "<!--\n" + license_text + "\n-->")
    bundle = BUNDLE.read_text().replace("\n//# sourceMappingURL=Tone.js.map", "")
    html = html.replace("/* TONE_BUNDLE */", bundle)
    html = html.replace("/* MARCH_SOURCE */", SOURCE.read_text())
    OUTPUT.write_text(html)
    print("Built " + str(OUTPUT) + " from the vendored Tone.js bundle and project source.")


if __name__ == "__main__":
    main()
