"""Package shim to allow imports like `server_fastapi.main` in tests.

This package re-exports symbols from the top-level `main.py` without moving files.
"""

__all__ = []
