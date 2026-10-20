"""
Tests for FlowML Studio Email Service (flowmlstudio@gmail.com) and /api/auth endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from app import app
from services.email_service import (
    PROJECT_EMAIL,
    send_verification_email,
    verify_email_token,
    send_password_reset_email,
    send_project_update_email,
    get_email_service_status,
)


def test_project_email_sender_is_flowmlstudio():
    """Verify official project sender is configured to flowmlstudio@gmail.com."""
    assert PROJECT_EMAIL == "flowmlstudio@gmail.com"
    status = get_email_service_status()
    assert status["project_email"] == "flowmlstudio@gmail.com"


def test_send_and_verify_email_token_flow():
    """Verify sending verification email generates a valid token that confirms user email."""
    test_email = "developer@flowml.studio"
    res = send_verification_email(to_email=test_email, user_id="dev_user_1")

    assert res["success"] is True
    assert res["from"] == "flowmlstudio@gmail.com"
    assert res["to"] == test_email
    assert "token" in res
    assert "verify_url" in res

    token = res["token"]

    # Valid token verification
    verification_result = verify_email_token(token)
    assert verification_result["valid"] is True
    assert verification_result["email"] == test_email

    # Invalid token check
    invalid_result = verify_email_token("flw_ver_invalid_token_123")
    assert invalid_result["valid"] is False


def test_api_auth_send_verification_endpoint():
    """Test POST /api/auth/send-verification and POST /api/auth/verify-token."""
    client = TestClient(app)
    resp = client.post(
        "/api/auth/send-verification",
        json={"email": "student@university.edu", "user_id": "std_42"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["from"] == "flowmlstudio@gmail.com"
    token = data["token"]

    # Verify via API endpoint
    verify_resp = client.post("/api/auth/verify-token", json={"token": token})
    assert verify_resp.status_code == 200
    assert verify_resp.json()["valid"] is True
    assert verify_resp.json()["email"] == "student@university.edu"


def test_api_auth_send_password_reset():
    """Test POST /api/auth/send-password-reset."""
    client = TestClient(app)
    resp = client.post(
        "/api/auth/send-password-reset",
        json={"email": "member@flowml.org"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["from"] == "flowmlstudio@gmail.com"
    assert "reset_url" in data


def test_api_auth_send_project_update():
    """Test POST /api/auth/send-project-update."""
    client = TestClient(app)
    resp = client.post(
        "/api/auth/send-project-update",
        json={
          "email": "lead@research.org",
          "project_name": "Census Income 300k Records",
          "update_type": "Model Training Complete",
          "details": {
              "status": "Success",
              "records_count": "300,000",
              "metrics": {"Accuracy": "96.4%"},
          },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["from"] == "flowmlstudio@gmail.com"
