import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

project = "Universal Paste Engine"
copyright = f"{datetime.now():%Y}, Universal Paste"
extensions = ["sphinx.ext.autodoc", "sphinx.ext.napoleon"]
html_theme = "alabaster"
exclude_patterns = ["_build"]
