"""
Audit logging service for security events and administrative actions.
"""

import os
import json
import time
from typing import Dict, Any, List, Optional
from services.store import get_store

_AUDIT_LOG_FILE = None

def _get_audit_path() -> str:
    global _AUDIT_LOG_FILE
    if _AUDIT_LOG_FILE is None:
        store = get_store()
        _AUDIT_LOG_FILE = os.path.join(store.base_dir, "audit_events.jsonl")
    return _AUDIT_LOG_FILE


def log_security_event(event_type: str, actor_uid: str, details: Dict[str, Any], severity: str = "INFO"):
    """Appends an event to the security audit trail."""
    path = _get_audit_path()
    entry = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "epoch": time.time(),
        "event_type": event_type,
        "actor_uid": actor_uid,
        "severity": severity,
        "details": details,
    }
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as e:
        print(f"[AUDIT FAIL] Could not write audit log: {e}")


def get_audit_logs(limit: int = 100) -> List[Dict[str, Any]]:
    """Reads latest security audit log entries."""
    path = _get_audit_path()
    if not os.path.exists(path):
        return []

    lines = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        lines.append(json.loads(line))
                    except Exception:
                        pass
    except Exception:
        return []

    return list(reversed(lines[-limit:]))
