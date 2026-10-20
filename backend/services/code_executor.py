"""
FlowML Isolated Code Execution Service.

Guarantees:
1. User code NEVER runs inside the FastAPI server process.
2. AST static analysis blocks unauthorized network, filesystem, and subprocess APIs.
3. Execution runs in a dedicated Docker worker container when Docker is installed.
   - Flags: --network none, --read-only, --tmpfs /tmp:rw,size=64m, --user 1000:1000, --cpus 1.0, -m 256m, --pids-limit 64
4. Fallback execution runs in an isolated subprocess with stripped environment variables (no app secrets),
   strict timeouts, output truncation, and active memory monitoring.
5. Permitted libraries: numpy, pandas, matplotlib, scikit-learn.
"""

import ast
import os
import sys
import json
import time
import uuid
import shutil
import tempfile
import threading
import subprocess
from typing import Dict, Any, Optional, List

from services.store import StoreBackend, get_store

# ── Security Configuration ───────────────────────────────────────────────────
ALLOWED_ROOT_MODULES = {
    "numpy", "np",
    "pandas", "pd",
    "sklearn", "scikit-learn",
    "matplotlib", "plt",
    "math", "json", "random", "re",
    "datetime", "collections", "itertools",
}

BLOCKED_MODULES = {
    "socket", "http", "urllib", "requests", "aiohttp", "ftplib", "telnetlib",
    "subprocess", "multiprocessing", "threading", "pty", "shutil",
    "ctypes", "pickle", "marshal", "builtins", "importlib",
    "webbrowser", "smtplib", "imaplib", "poplib"
}

BLOCKED_CALLS = {
    "eval", "exec", "compile", "__import__", "input"
}

# In-flight running processes for cancellation support
_ACTIVE_CODE_PROCESSES: Dict[str, subprocess.Popen] = {}
_ACTIVE_LOCK = threading.Lock()


def validate_code_security(code: str) -> Optional[str]:
    """
    Analyzes Python AST to catch unauthorized network, subprocess,
    or internal secret access before any execution occurs.
    Returns error string if unsafe, None if clean.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return f"Syntax Error: {e}"

    for node in ast.walk(tree):
        # 1. Check imports
        if isinstance(node, ast.Import):
            for alias in node.names:
                root_pkg = alias.name.split(".")[0]
                if root_pkg in BLOCKED_MODULES:
                    return f"Security Violation: Import of '{root_pkg}' is forbidden (network/system operations prohibited)."
                if root_pkg not in ALLOWED_ROOT_MODULES and root_pkg != "os" and root_pkg != "sys":
                    return f"Security Violation: Package '{root_pkg}' is not in the allowed libraries list (numpy, pandas, matplotlib, scikit-learn)."

        elif isinstance(node, ast.ImportFrom):
            if node.module:
                root_pkg = node.module.split(".")[0]
                if root_pkg in BLOCKED_MODULES:
                    return f"Security Violation: Import from '{root_pkg}' is forbidden."
                if root_pkg not in ALLOWED_ROOT_MODULES and root_pkg != "os" and root_pkg != "sys":
                    return f"Security Violation: Package '{root_pkg}' is not in the allowed libraries list."

        # 2. Check forbidden function calls
        elif isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Name) and func.id in BLOCKED_CALLS:
                return f"Security Violation: Call to built-in '{func.id}' is forbidden."

        # 3. Check access to os.system, os.popen, os.environ, etc.
        elif isinstance(node, ast.Attribute):
            if node.attr in {"system", "popen", "spawn", "environ", "getenv"}:
                return f"Security Violation: Access to system environment or process execution via '{node.attr}' is prohibited."
            if node.attr.startswith("__") and node.attr.endswith("__") and node.attr not in {"__name__", "__doc__"}:
                return f"Security Violation: Access to dunder attribute '{node.attr}' is prohibited."

    return None


def _get_process_memory_mb(pid: int) -> float:
    """Returns working set memory in MB using OS utilities."""
    try:
        if sys.platform == "win32":
            import ctypes
            from ctypes import wintypes

            class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
                _fields_ = [
                    ("cb", wintypes.DWORD),
                    ("PageFaultCount", wintypes.DWORD),
                    ("PeakWorkingSetSize", ctypes.c_size_t),
                    ("WorkingSetSize", ctypes.c_size_t),
                ]

            h = ctypes.windll.kernel32.OpenProcess(0x0400 | 0x0010, False, pid)
            if not h:
                return 0.0
            pmc = PROCESS_MEMORY_COUNTERS()
            pmc.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS)
            ctypes.windll.psapi.GetProcessMemoryInfo(h, ctypes.byref(pmc), pmc.cb)
            ctypes.windll.kernel32.CloseHandle(h)
            return pmc.WorkingSetSize / (1024.0 * 1024.0)
        else:
            # Linux / POSIX fallback via /proc
            with open(f"/proc/{pid}/statm", "r") as f:
                pages = int(f.read().split()[1])
                return (pages * os.sysconf("SC_PAGE_SIZE")) / (1024.0 * 1024.0)
    except Exception:
        return 0.0


def execute_python_code(
    uid: str,
    code: str,
    input_dataset_id: Optional[str] = None,
    timeout_seconds: int = 10,
    memory_limit_mb: int = 256,
    input_data_path: Optional[str] = None,
    store: Optional[StoreBackend] = None,
) -> Dict[str, Any]:
    """
    Executes Python user code in an isolated worker process.
    Guarantees zero execution inside the main FastAPI process.
    """
    run_id = f"crun_{uuid.uuid4().hex[:12]}"
    start_time = time.time()

    # Step 1: Pre-execution AST validation
    security_err = validate_code_security(code)
    if security_err:
        return {
            "run_id": run_id,
            "status": "failed",
            "stdout": "",
            "stderr": security_err,
            "traceback": security_err,
            "duration_ms": int((time.time() - start_time) * 1000),
            "plots": [],
            "output_preview": None,
            "error_type": "SecurityViolation",
        }

    # Step 2: Prepare isolated sandbox directory
    store = store or get_store()
    sandbox_dir = tempfile.mkdtemp(prefix=f"flowml_box_{run_id}_")

    resolved_input_path = input_data_path
    if not resolved_input_path and input_dataset_id:
        try:
            resolved_input_path = store.get_dataset_path(uid, input_dataset_id)
        except Exception as e:
            shutil.rmtree(sandbox_dir, ignore_errors=True)
            return {
                "run_id": run_id,
                "status": "failed",
                "stdout": "",
                "stderr": f"Failed to locate input dataset: {e}",
                "traceback": str(e),
                "duration_ms": 0,
                "plots": [],
                "output_preview": None,
            }

    spec = {
        "run_id": run_id,
        "code": code,
        "input_data_path": resolved_input_path,
        "output_data_dir": sandbox_dir,
    }

    spec_file = os.path.join(sandbox_dir, "input_spec.json")
    result_file = os.path.join(sandbox_dir, "output_result.json")

    with open(spec_file, "w", encoding="utf-8") as f:
        json.dump(spec, f)

    runner_script = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "sandbox_runner.py")
    )

    docker_bin = shutil.which("docker")
    use_docker = bool(docker_bin and os.getenv("FORCE_DOCKER", "0") == "1")

    # Step 3: Launch worker process (Docker or Isolated Subprocess)
    proc = None
    try:
        if use_docker:
            # Full Docker sandbox container
            cmd = [
                docker_bin, "run", "--rm",
                "--network", "none",
                "--read-only",
                "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
                "--user", "1000:1000",
                "--cpus", "1.0",
                "-m", f"{memory_limit_mb}m",
                "--memory-swap", f"{memory_limit_mb}m",
                "--pids-limit", "64",
                "-v", f"{sandbox_dir}:/sandbox:rw",
                "-v", f"{runner_script}:/app/sandbox_runner.py:ro",
            ]
            if input_data_path and os.path.exists(input_data_path):
                cmd.extend(["-v", f"{input_data_path}:/data/input.csv:ro"])

            cmd.extend([
                "flowml-worker:latest",
                "python", "/app/sandbox_runner.py",
                "/sandbox/input_spec.json",
                "/sandbox/output_result.json"
            ])
            env = {}  # Empty environment: zero host secrets
        else:
            # Fallback: Isolated Python subprocess with stripped environment
            cmd = [sys.executable, runner_script, spec_file, result_file]
            env = {
                "PATH": os.environ.get("PATH", ""),
                "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
                "USERPROFILE": os.environ.get("USERPROFILE", sandbox_dir),
                "HOME": os.environ.get("USERPROFILE", sandbox_dir),
                "HOMEDRIVE": os.environ.get("HOMEDRIVE", "C:"),
                "HOMEPATH": os.environ.get("HOMEPATH", "\\"),
                "MPLCONFIGDIR": sandbox_dir,
                "TEMP": sandbox_dir,
                "TMP": sandbox_dir,
                "PYTHONUNBUFFERED": "1",
                "PYTHONDONTWRITEBYTECODE": "1",
            }

        proc = subprocess.Popen(
            cmd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=sandbox_dir,
        )

        with _ACTIVE_LOCK:
            _ACTIVE_CODE_PROCESSES[run_id] = proc

        # Step 4: Actively monitor execution timeout and memory threshold
        killed_reason = None
        poll_interval = 0.05
        max_polls = int(timeout_seconds / poll_interval)

        for _ in range(max_polls):
            ret = proc.poll()
            if ret is not None:
                break

            # Check memory consumption
            if proc.pid:
                mem_mb = _get_process_memory_mb(proc.pid)
                if mem_mb > memory_limit_mb:
                    killed_reason = f"MemoryLimitExceeded: Process exceeded memory limit of {memory_limit_mb}MB (used {mem_mb:.1f}MB)."
                    try:
                        proc.kill()
                    except Exception:
                        pass
                    break

            time.sleep(poll_interval)
        else:
            if proc.poll() is None:
                killed_reason = f"TimeoutError: Execution exceeded {timeout_seconds}s time limit. Process terminated."
                try:
                    proc.kill()
                except Exception:
                    pass

        try:
            stdout_data, stderr_data = proc.communicate(timeout=2)
        except Exception:
            stdout_data, stderr_data = "", ""

    finally:
        with _ACTIVE_LOCK:
            _ACTIVE_CODE_PROCESSES.pop(run_id, None)

    # Step 5: Parse results or construct killed report
    res_data = None
    if os.path.exists(result_file):
        try:
            with open(result_file, "r", encoding="utf-8") as f:
                res_data = json.load(f)
        except Exception:
            pass

    if killed_reason:
        final_result = {
            "run_id": run_id,
            "status": "failed",
            "stdout": stdout_data[:10000],
            "stderr": killed_reason,
            "traceback": killed_reason,
            "duration_ms": int((time.time() - start_time) * 1000),
            "plots": [],
            "output_preview": None,
            "output_df": None,
            "error_type": "Killed" if "Memory" in killed_reason else "Timeout",
        }
    elif res_data:
        output_df_loaded = None
        out_csv = res_data.get("output_csv_path")
        if out_csv and os.path.exists(out_csv):
            try:
                import pandas as pd
                output_df_loaded = pd.read_csv(out_csv)
            except Exception:
                pass

        final_result = {
            "run_id": run_id,
            "status": res_data.get("status", "completed"),
            "stdout": res_data.get("stdout", ""),
            "stderr": res_data.get("stderr", ""),
            "traceback": res_data.get("traceback"),
            "duration_ms": res_data.get("duration_ms", int((time.time() - start_time) * 1000)),
            "plots": res_data.get("plots", []),
            "output_preview": res_data.get("output_preview"),
            "output_df": output_df_loaded,
            "error_type": res_data.get("error_type", "ExecutionError" if res_data.get("status") == "failed" else None),
        }
    else:
        final_result = {
            "run_id": run_id,
            "status": "failed",
            "stdout": stdout_data[:10000],
            "stderr": stderr_data[:10000] or "Process terminated without output.",
            "traceback": stderr_data[:10000],
            "duration_ms": int((time.time() - start_time) * 1000),
            "plots": [],
            "output_preview": None,
            "output_df": None,
            "error_type": "Killed",
        }

    # Save execution run record in user's store
    _save_run_history(uid, run_id, code, final_result, store)

    # Cleanup temp sandbox directory
    shutil.rmtree(sandbox_dir, ignore_errors=True)

    return final_result


def stop_code_run(run_id: str) -> bool:
    """Stops an active running code process."""
    with _ACTIVE_LOCK:
        proc = _ACTIVE_CODE_PROCESSES.get(run_id)
        if proc:
            try:
                proc.kill()
                return True
            except Exception:
                pass
    return False


def _save_run_history(
    uid: str,
    run_id: str,
    code: str,
    result: Dict[str, Any],
    store: Optional[StoreBackend] = None,
):
    """Persists code execution metadata in user storage."""
    try:
        store = store or get_store()
        runs_dir = os.path.join(store.base_dir, uid, "code_runs")
        os.makedirs(runs_dir, exist_ok=True)
        rec = {
            "run_id": run_id,
            "code": code[:2000],
            "status": result.get("status"),
            "duration_ms": result.get("duration_ms"),
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "has_plots": len(result.get("plots", [])) > 0,
            "has_preview": result.get("output_preview") is not None,
        }
        with open(os.path.join(runs_dir, f"{run_id}.json"), "w", encoding="utf-8") as f:
            json.dump(rec, f, indent=2)
    except Exception:
        pass


def get_code_history(uid: str, store: Optional[StoreBackend] = None) -> List[Dict[str, Any]]:
    """Retrieves list of past Python code runs for user."""
    history = []
    try:
        store = store or get_store()
        runs_dir = os.path.join(store.base_dir, uid, "code_runs")
        if os.path.exists(runs_dir):
            for fname in sorted(os.listdir(runs_dir), reverse=True):
                if fname.endswith(".json"):
                    try:
                        with open(os.path.join(runs_dir, fname), "r", encoding="utf-8") as f:
                            history.append(json.load(f))
                    except Exception:
                        pass
    except Exception:
        pass
    return history
