from threading import Lock
TRANSACTION_STORE = {}
CLIENT_TRACKER = {}
STORE_LOCK = Lock()
CLIENT_LOCK = Lock()
CLEANUP_TASK = {}