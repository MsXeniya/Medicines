"""Wrapper module that imports and re-exports the top-level main.py symbols.

This keeps `main.py` in place while allowing tests to `import server_fastapi.main`.
"""
import importlib
import types
import sys

# import the top-level main module (main.py in this folder)
_root = importlib.import_module("main")


class _Proxy(types.ModuleType):
    def __init__(self, name, root):
        super().__init__(name)
        super().__setattr__("_root", root)

    def __getattr__(self, item):
        return getattr(self._root, item)

    def __setattr__(self, name, value):
        if name == "_root":
            super().__setattr__(name, value)
        else:
            setattr(self._root, name, value)


# replace this module in sys.modules with a proxy that delegates to the real main
_proxy = _Proxy(__name__, _root)
sys.modules[__name__] = _proxy

