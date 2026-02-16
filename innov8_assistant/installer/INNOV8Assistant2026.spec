# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules


# Keep paths dynamic so the spec works from any machine/workspace path.
project_root = Path(__file__).resolve().parents[1]
package_root = project_root.parent
icon_path = project_root / "assets" / "innov8.ico"

hiddenimports = (
    collect_submodules("faster_whisper")
    + collect_submodules("pyttsx3")
    + collect_submodules("sounddevice")
    + collect_submodules("rapidfuzz")
)

datas = (
    collect_data_files("faster_whisper", include_py_files=False)
    + collect_data_files("pyttsx3", include_py_files=False)
    + [(str(project_root / "README.md"), ".")]
)

a = Analysis(
    [str(project_root / "main.py")],
    pathex=[str(package_root)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="INNOV8Assistant2026",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(icon_path) if icon_path.exists() else None,
)
