# Reusable site scripts

These scripts use paths relative to the repository, so they work from any current directory. They require Python 3.10 or newer.

```powershell
python -m pip install -r src/requirements.txt
python src/generate_print_assets.py --check
python src/check_site_assets.py
python src/preview_mobile_artwork.py --output mobile-artwork-preview.png
```

`generate_print_assets.py` is the source for the three code-generated files in `images/bookish/`. Its `--check` mode compares them byte for byte without writing; omit `--check` to regenerate them. You can use `--output-dir` to generate a separate trial set.

`check_site_assets.py` verifies local links in root HTML files and image/font URLs in root CSS files. `preview_mobile_artwork.py` saves a contact sheet at 320, 375, and 430 CSS-pixel viewports by default; use `--viewport-widths` to change them. The contact sheet approximates the artwork treatment rather than rendering the whole browser page.
