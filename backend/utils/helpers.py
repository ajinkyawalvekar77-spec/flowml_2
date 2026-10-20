import os
from fastapi import HTTPException

ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}

def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def generate_error_response(message: str, details: str = None) -> dict:
    return {
        "error": message,
        "details": details or "No additional details provided."
    }

def raise_http_exception(status_code: int, message: str, details: str = None):
    raise HTTPException(status_code=status_code, detail=generate_error_response(message, details))

def ensure_dir(path: str):
    if not os.path.exists(path):
        os.makedirs(path)
