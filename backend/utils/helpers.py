import os
from fastapi import HTTPException

ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls', 'tsv', 'txt', 'data'}

def allowed_file(filename: str) -> bool:
    if not filename:
        return False
    if '.' in filename:
        return filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
    # Allow files without explicit extension so data_loader can inspect and validate contents
    return True

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
