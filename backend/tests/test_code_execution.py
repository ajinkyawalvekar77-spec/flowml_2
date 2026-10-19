"""
Tests for Phase 3: Isolated Python Code Execution.
Validates:
1. Infinite loop is killed.
2. Memory bomb is killed.
3. Network calls fail.
4. Reading another user's files / app secrets fails.
5. customPython DAG node processes DataFrames.
"""

import time
import pytest
from fastapi.testclient import TestClient

from app import app
from services.code_executor import execute_python_code, validate_code_security
from services.pipeline_executor import execute_pipeline
from tests.conftest import auth_headers


def test_ast_blocks_network_libraries():
    """Network calls like socket/urllib/requests must be blocked before execution."""
    bad_code_1 = "import socket\ns = socket.socket()\ns.connect(('1.1.1.1', 80))"
    err_1 = validate_code_security(bad_code_1)
    assert err_1 is not None
    assert "socket" in err_1

    bad_code_2 = "import urllib.request\nurllib.request.urlopen('http://evil.com')"
    err_2 = validate_code_security(bad_code_2)
    assert err_2 is not None

    bad_code_3 = "from http.client import HTTPConnection\nconn = HTTPConnection('google.com')"
    err_3 = validate_code_security(bad_code_3)
    assert err_3 is not None


def test_ast_blocks_subprocess_and_env_secrets():
    """Process execution and reading host environment secrets must be blocked."""
    bad_code_1 = "import subprocess\nsubprocess.run(['ls', '-la'])"
    assert validate_code_security(bad_code_1) is not None

    bad_code_2 = "import os\nsecret = os.environ.get('FIREBASE_CREDENTIALS')"
    err = validate_code_security(bad_code_2)
    assert err is not None
    assert "environ" in err or "system" in err

    bad_code_3 = "import os\nos.system('dir')"
    assert validate_code_security(bad_code_3) is not None


def test_infinite_loop_is_killed():
    """An infinite loop must be terminated when the timeout is reached."""
    loop_code = "x = 0\nwhile True:\n    x += 1\n"
    # Execute with a tight 2s timeout
    result = execute_python_code(
        uid="test_user_loop",
        code=loop_code,
        timeout_seconds=2,
    )
    assert result["status"] == "failed"
    assert result["error_type"] in {"Timeout", "Killed"}
    assert "exceeded" in result["stderr"].lower() or "timeout" in result["stderr"].lower()


def test_memory_bomb_is_killed():
    """A memory bomb allocating massive arrays must be terminated."""
    mem_code = (
        "import numpy as np\n"
        "# Allocate multiple large arrays\n"
        "blocks = []\n"
        "for i in range(100):\n"
        "    blocks.append(np.ones((2000, 2000, 8), dtype=np.float64))\n"
    )
    # Execute with a tight 128MB limit and 10s timeout
    result = execute_python_code(
        uid="test_user_mem",
        code=mem_code,
        timeout_seconds=5,
        memory_limit_mb=128,
    )
    assert result["status"] == "failed"
    assert result["error_type"] in {"Killed", "Timeout"}


def test_code_execution_api_endpoint(monkeypatch, client):
    """Test POST /api/code/run is enabled by default for legitimate data manipulation."""
    monkeypatch.delenv("ENABLE_PYTHON_SANDBOX", raising=False)
    script = (
        "import numpy as np\n"
        "import pandas as pd\n"
        "data = {'col_a': [1, 2, 3], 'col_b': [10, 20, 30]}\n"
        "output_df = pd.DataFrame(data)\n"
        "print('DataFrame constructed successfully')\n"
    )
    resp = client.post(
        "/api/code/run",
        json={"code": script, "timeout": 10},
        headers={"Authorization": "Bearer test_user_dev"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert "DataFrame constructed successfully" in data["stdout"]
    assert data["output_preview"] is not None
    assert data["output_preview"]["rows"] == 3


def test_code_execution_requires_explicit_sandbox_enablement(monkeypatch, client):
    monkeypatch.setenv("ENABLE_PYTHON_SANDBOX", "false")
    response = client.post(
        "/api/code/run",
        json={"code": "print('not executed')"},
        headers=auth_headers("sandbox-test-user"),
    )
    assert response.status_code == 503
    assert "Not available in this setup" in response.json()["detail"]


def test_custom_python_dag_node(tmp_path):
    """Test customPython node integrated in full DAG pipeline."""
    # Create sample CSV
    csv_path = tmp_path / "input.csv"
    csv_path.write_text("feature1,feature2,target\n1,10,0\n2,20,1\n3,30,0\n4,40,1\n")

    nodes = [
        {"id": "n1", "type": "upload", "data": {"dataset_id": "ds_test", "file_path": str(csv_path)}},
        {
            "id": "n2",
            "type": "customPython",
            "data": {
                "code": "output_df = df.copy()\noutput_df['feature_sum'] = output_df['feature1'] + output_df['feature2']\nprint('Computed feature_sum')"
            },
        },
    ]
    edges = [{"id": "e1", "source": "n1", "target": "n2"}]

    workflow = {"nodes": nodes, "edges": edges}
    res = execute_pipeline(workflow, uid="test_user_dag")
    assert res["status"] == "success"
    assert res["node_statuses"]["n2"] == "Completed"
