"""Runtime configuration for the archived Bitcoin RPC worker.

Credentials must be provided through the process environment. There are no
built-in credentials and this module does not automatically load a .env file.
"""

import os


def _required_env(name: str) -> str:
    value = os.environ.get(name)
    if value is None or not value.strip():
        raise RuntimeError(f"Set the required environment variable {name} before starting the legacy worker.")
    return value


RPC_USERNAME = _required_env("DSCAP_RPC_USER")
RPC_PASSWORD = _required_env("DSCAP_RPC_PASSWORD")

RPC_URL = "http://127.0.0.1:8332/"
RPC_IP = "@127.0.0.1:8332"
ZMQ_IP = "tcp://127.0.0.1:28332"
