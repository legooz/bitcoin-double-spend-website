"""Configuration checks use synthetic values and never connect to a node."""

import os
from pathlib import Path
import runpy
import unittest
from unittest.mock import patch


CONFIG = Path(__file__).resolve().parents[1] / "RPC_Params.py"


def load_config(environment):
    with patch.dict(os.environ, environment, clear=True):
        return runpy.run_path(str(CONFIG))


class RPCConfigTests(unittest.TestCase):
    def test_missing_credentials_fail_closed(self):
        for environment, missing in (
            ({}, "DSCAP_RPC_USER"),
            ({"DSCAP_RPC_USER": "test-user"}, "DSCAP_RPC_PASSWORD"),
            ({"DSCAP_RPC_PASSWORD": "test-secret"}, "DSCAP_RPC_USER"),
        ):
            with self.subTest(missing=missing, supplied=sorted(environment)):
                with self.assertRaises(RuntimeError) as error:
                    load_config(environment)
                self.assertIn(missing, str(error.exception))
                for value in environment.values():
                    self.assertNotIn(value, str(error.exception))

    def test_blank_credentials_fail_closed(self):
        for name in ("DSCAP_RPC_USER", "DSCAP_RPC_PASSWORD"):
            for blank in ("", " ", "\t\n"):
                environment = {"DSCAP_RPC_USER": "test-user", "DSCAP_RPC_PASSWORD": "test-secret"}
                environment[name] = blank
                with self.subTest(name=name, blank=repr(blank)):
                    with self.assertRaisesRegex(RuntimeError, name):
                        load_config(environment)

    def test_configured_values_are_preserved(self):
        # Synthetic fixtures are distinct from any real service credentials.
        config = load_config({"DSCAP_RPC_USER": "fixture-user_7", "DSCAP_RPC_PASSWORD": "fixture-secret_9-"})
        self.assertEqual(config["RPC_USERNAME"], "fixture-user_7")
        self.assertEqual(config["RPC_PASSWORD"], "fixture-secret_9-")

    def test_existing_loopback_endpoints_are_preserved(self):
        config = load_config({"DSCAP_RPC_USER": "test-user", "DSCAP_RPC_PASSWORD": "test-secret"})
        self.assertEqual(config["RPC_URL"], "http://127.0.0.1:8332/")
        self.assertEqual(config["RPC_IP"], "@127.0.0.1:8332")
        self.assertEqual(config["ZMQ_IP"], "tcp://127.0.0.1:28332")


if __name__ == "__main__":
    unittest.main()
