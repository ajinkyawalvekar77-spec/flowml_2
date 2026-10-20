"""
In-memory rate limiter for API protection.
"""

import time
from collections import defaultdict
from fastapi import Request, HTTPException, status

_REQUEST_COUNTS = defaultdict(list)
_WINDOW_SECONDS = 60
_MAX_REQUESTS_DEFAULT = 120
_MAX_REQUESTS_BURST = 30


def check_rate_limit(request: Request, limit: int = _MAX_REQUESTS_DEFAULT):
    """
    Validates that client has not exceeded allowed requests in the last 60 seconds.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    auth_header = request.headers.get("Authorization", "")
    key = f"{client_ip}:{auth_header[:30]}"

    now = time.time()
    # Filter timestamps within window
    timestamps = [t for t in _REQUEST_COUNTS[key] if now - t < _WINDOW_SECONDS]
    timestamps.append(now)
    _REQUEST_COUNTS[key] = timestamps

    if len(timestamps) > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {limit} requests per minute.",
        )
