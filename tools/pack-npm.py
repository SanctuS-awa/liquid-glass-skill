"""Build the local npm tarball with a self-contained package README."""
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory

root = Path(__file__).resolve().parents[1]
with TemporaryDirectory(prefix="liquidglass-pack-") as tmp:
    staging = Path(tmp)
    for directory in ("bin", "liquid-glass"):
        shutil.copytree(root / directory, staging / directory)
    shutil.copy2(root / "package.json", staging)
    shutil.copy2(root / "LICENSE", staging)
    shutil.copy2(root / "tools/npm-README.md", staging / "README.md")
    npm = shutil.which("npm")
    if not npm:
        raise SystemExit("npm 10+ is required")
    subprocess.run(
        [npm, "pack", "--offline", "--ignore-scripts", "--pack-destination", str(root), "."],
        cwd=staging, check=True,
    )
