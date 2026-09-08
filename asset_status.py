"""Password-gated asset records. Only encrypted JSON is persisted."""
import hashlib
import hmac
import json
import math
import os
import secrets
import threading
import time
from io import BytesIO
from urllib.parse import unquote
from datetime import date, datetime
from zoneinfo import ZoneInfo

from cryptography.fernet import Fernet, InvalidToken
from flask import Blueprint, jsonify, make_response, render_template, request
from itsdangerous import BadSignature, URLSafeTimedSerializer
from werkzeug.security import generate_password_hash, check_password_hash

PRIVATE_TAB = "__private_asset_status__"
AUTH_TAB = "__private_asset_auth__"
SESSION_SECONDS = 900
MAX_BYTES = 1_000_000


def setup_capability():
    return hmac.new(os.environ["ASSET_STATUS_KEY"].encode(), b"asset-status-owner-setup", hashlib.sha256).hexdigest()


def validate_document(data):
    if not isinstance(data, dict) or not isinstance(data.get("accounts"), list):
        raise ValueError("Invalid document")
    if len(data["accounts"]) > 1000:
        raise ValueError("Too many rows")
    if not isinstance(data.get("other", ""), str):
        raise ValueError("Invalid text")
    scope = data.get("total_scope", "c1")
    if scope not in ("c1", "all"):
        raise ValueError("Invalid total scope")
    result = {"accounts": [], "other_assets":[], "future":[], "expenses":[], "other": data.get("other", ""), "total_scope":scope}
    colors = data.get("name_colors", {})
    if not isinstance(colors,dict) or len(colors)>100 or any(not isinstance(name,str) or len(name)>200 or color not in ("blue","green") for name,color in colors.items()):
        raise ValueError("Invalid name colors")
    result["name_colors"] = colors
    for field in ("bond_notes", "movement_notes", "future_balance_label", "future_balance_notes", "future_extra_label", "future_extra_notes"):
        value = data.get(field, "")
        if not isinstance(value,str) or len(value)>10000:
            raise ValueError("Invalid section text")
        result[field] = value
    extra = data.get("future_extra_amount")
    if extra is not None and (isinstance(extra,bool) or not isinstance(extra,(int,float)) or not math.isfinite(extra) or abs(extra)>9e15):
        raise ValueError("Invalid extra amount")
    result["future_extra_amount"] = extra
    if len(result["other"]) > 100_000:
        raise ValueError("Too much text")
    ids = set()
    for row in data["accounts"]:
        if not isinstance(row, dict):
            raise ValueError("Invalid row")
        clean = {}
        for field in ("id", "category", "name", "description", "account", "notes", "maturity"):
            value = row.get(field, "")
            if not isinstance(value, str) or len(value) > 4000:
                raise ValueError("Invalid text")
            clean[field] = value
        if not clean["id"] or clean["id"] in ids:
            raise ValueError("Invalid row ID")
        ids.add(clean["id"])
        clean["group"] = row.get("group", "total")
        if clean["group"] not in ("total","bonds","movement"):
            raise ValueError("Invalid group")
        year = row.get("year", 2025 if clean["group"] == "bonds" else None)
        if (clean["group"]=="bonds" and year is None) or (year is not None and (isinstance(year,bool) or not isinstance(year,int) or not 1900<=year<=2200)):
            raise ValueError("Invalid year")
        clean["year"] = year
        if clean["group"] == "total" and clean["category"] not in ("예적금","코인","주식","금"):
            raise ValueError("Invalid asset category")
        clean["in_total"] = row.get("in_total", True)
        if not isinstance(clean["in_total"], bool):
            raise ValueError("Invalid total inclusion")
        for field in ("amount", "interest"):
            value = row.get(field)
            if value is not None and (isinstance(value, bool) or not isinstance(value, (float, int))
                                      or not math.isfinite(value) or abs(value) > 9e15):
                raise ValueError("Invalid amount")
            clean[field] = value
        if clean["maturity"]:
            clean["maturity"] = date.fromisoformat(clean["maturity"]).isoformat()
        result["accounts"].append(clean)
    for collection in ("other_assets", "future", "expenses"):
        items = data.get(collection, [])
        if not isinstance(items,list) or len(items)>1000:
            raise ValueError("Invalid assets")
        for row in items:
            if not isinstance(row, dict):
                raise ValueError("Invalid asset")
            clean = {field:row.get(field, "") for field in ("id", "description", "notes")}
            if any(not isinstance(v,str) or len(v)>10000 for v in clean.values()) or not clean["id"] or clean["id"] in ids:
                raise ValueError("Invalid asset text")
            ids.add(clean["id"])
            value = row.get("amount")
            if value is not None and (isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or abs(value)>9e15):
                raise ValueError("Invalid asset amount")
            clean["amount"] = value
            clean["in_total"] = row.get("in_total", collection == "other_assets")
            if not isinstance(clean["in_total"], bool):
                raise ValueError("Invalid inclusion")
            result[collection].append(clean)
    return result


def create_asset_blueprint(get_db, query):
    bp = Blueprint("asset_status", __name__, url_prefix="/asset-status")
    attempts = {}
    mutex = threading.Lock()

    def load_auth(cipher):
        conn = get_db()
        try:
            row = query(conn, "SELECT content FROM tab_notes WHERE tab = %s ORDER BY id LIMIT 1", (AUTH_TAB,)).fetchone()
            return json.loads(cipher.decrypt(row["content"].encode())) if row else None
        finally:
            conn.close()

    def config():
        key = os.environ.get("ASSET_STATUS_KEY", "")
        if not key:
            return None
        try:
            cipher = Fernet(key.encode())
            return cipher, URLSafeTimedSerializer(key, salt="asset-status-session"), load_auth(cipher)
        except Exception:
            return None

    def authenticated(cfg):
        if not cfg or not cfg[2]:
            return False
        try:
            value = cfg[1].loads(request.cookies.get("asset_session", ""), max_age=SESSION_SECONDS)
            fingerprint = cfg[2]["id"]
            token = request.headers.get("X-Asset-Token", "")
            return (isinstance(value, dict) and bool(token)
                    and hmac.compare_digest(value.get("password", ""), fingerprint)
                    and hmac.compare_digest(value.get("token", ""), hashlib.sha256(token.encode()).hexdigest()))
        except (BadSignature, TypeError):
            return False

    @bp.before_request
    def guard():
        if request.method != "GET":
            if request.headers.get("X-Asset-Request") != "1":
                return jsonify(error="허용되지 않은 요청입니다."), 403
            origin = request.headers.get("Origin")
            allowed_origins = {"https://" + request.host}
            if request.host.startswith(("127.0.0.1:", "localhost:")):
                allowed_origins.add("http://" + request.host)
            if origin and origin not in allowed_origins:
                return jsonify(error="요청 출처를 확인할 수 없습니다."), 403
        if request.content_length and request.content_length > MAX_BYTES:
            return jsonify(error="저장할 내용이 너무 큽니다."), 413
        if request.path.endswith(("/records", "/initial-workbook")):
            if not authenticated(config()):
                return jsonify(error="비밀번호를 다시 입력해 주세요."), 401

    @bp.after_request
    def privacy_headers(response):
        response.headers["Cache-Control"] = "no-store, private, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; "
            "img-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        )
        return response

    @bp.get("/")
    def page():
        response = make_response(render_template("asset_status.html"))
        response.delete_cookie("asset_session", path="/asset-status", httponly=True, samesite="Strict")
        return response

    @bp.post("/unlock")
    def unlock():
        cfg = config()
        if not cfg:
            return jsonify(error="자산 현황의 보안 설정이 아직 완료되지 않았습니다."), 503
        if not cfg[2]:
            return jsonify(error="소유자가 먼저 자산현황 비밀번호를 설정해야 합니다."), 409
        # Per-worker rate limit; bounded memory and no password/IP logging.
        ip = request.remote_addr or "unknown"
        now = time.monotonic()
        with mutex:
            for old in [k for k, v in attempts.items() if now - v[0] > 300]:
                del attempts[old]
            if len(attempts) >= 5000 and ip not in attempts:
                return jsonify(error="잠시 후 다시 시도해 주세요."), 429
            start, count = attempts.get(ip, (now, 0))
            if count >= 5:
                return jsonify(error="잠시 후 다시 시도해 주세요."), 429
            attempts[ip] = (start, count + 1)
        data = request.get_json(silent=True) or {}
        password = data.get("password", "") if isinstance(data, dict) else ""
        if not isinstance(password, str) or len(password) > 256 or not check_password_hash(cfg[2]["hash"], password):
            return jsonify(error="비밀번호가 올바르지 않습니다."), 401
        with mutex:
            attempts.pop(ip, None)
        fingerprint = cfg[2]["id"]
        token = secrets.token_urlsafe(32)
        response = jsonify(ok=True, expires_in=SESSION_SECONDS, token=token)
        signed = cfg[1].dumps({"password":fingerprint, "token":hashlib.sha256(token.encode()).hexdigest()})
        response.set_cookie("asset_session", signed, max_age=SESSION_SECONDS,
                            httponly=True, secure=not request.host.startswith(("127.0.0.1:", "localhost:")),
                            samesite="Strict", path="/asset-status")
        return response

    @bp.post("/setup")
    def setup():
        cfg = config()
        if not cfg:
            return jsonify(error="보안 설정을 준비 중입니다."), 503
        supplied = request.headers.get("X-Asset-Setup", "")
        if not hmac.compare_digest(supplied, setup_capability()):
            return jsonify(error="소유자 전용 설정 화면에서 진행해 주세요."), 403
        data = request.get_json(silent=True)
        password = data.get("password") if isinstance(data, dict) else None
        if not isinstance(password, str) or not 12 <= len(password) <= 256:
            return jsonify(error="비밀번호는 12자 이상 256자 이하로 입력해 주세요."), 400
        conn = get_db()
        try:
            query(conn, "SELECT pg_advisory_xact_lock(731902841)")
            if query(conn, "SELECT id FROM tab_notes WHERE tab = %s", (AUTH_TAB,)).fetchone():
                return jsonify(error="이미 비밀번호가 설정되어 있습니다."), 409
            auth = {"hash":generate_password_hash(password), "id":secrets.token_hex(32)}
            encrypted = cfg[0].encrypt(json.dumps(auth).encode()).decode()
            query(conn, "INSERT INTO tab_notes (tab, content) VALUES (%s, %s)", (AUTH_TAB, encrypted))
            conn.commit()
            return jsonify(ok=True)
        except Exception:
            return jsonify(error="비밀번호를 저장하지 못했습니다. 다시 시도해 주세요."), 503
        finally:
            conn.close()

    @bp.post("/lock")
    def lock():
        response = jsonify(ok=True)
        response.delete_cookie("asset_session", path="/asset-status", httponly=True, samesite="Strict")
        return response

    @bp.route("/records", methods=["GET", "POST", "PUT"])
    @bp.post("/initial-import")
    @bp.post("/initial-workbook")
    def records():
        cfg = config()
        owner_import = request.path.endswith("/initial-import")
        if owner_import:
            if not cfg:
                return jsonify(error="보안 설정을 준비 중입니다."), 503
            if not hmac.compare_digest(request.headers.get("X-Asset-Setup", ""), setup_capability()):
                return jsonify(error="소유자 확인이 필요합니다."), 403
        conn = get_db()
        try:
            # Serialize creation and revisions without altering the database schema.
            query(conn, "SELECT pg_advisory_xact_lock(731902841)")
            row = query(conn, "SELECT id, content FROM tab_notes WHERE tab = %s ORDER BY id LIMIT 1",
                        (PRIVATE_TAB,)).fetchone()
            stored = None
            if row:
                stored = json.loads(cfg[0].decrypt(row["content"].encode()))
            if request.method == "GET":
                return jsonify(document=stored, year=datetime.now(ZoneInfo("Asia/Seoul")).year)
            if request.method == "POST" and stored:
                return jsonify(error="이미 내용이 등록되어 있습니다."), 409
            if request.path.endswith("/initial-workbook"):
                from import_asset_status import read_document
                colors = json.loads(unquote(request.headers.get("X-Asset-Name-Colors", "{}")))
                incoming = read_document(BytesIO(request.get_data(cache=False)), name_colors=colors)
            else:
                incoming = request.get_json(silent=True)
            if not isinstance(incoming, dict):
                return jsonify(error="입력 내용을 확인해 주세요."), 400
            if request.method == "PUT" and (not stored or incoming.get("revision") != stored["revision"]):
                return jsonify(error="다른 화면에서 내용이 변경되었습니다. 수정 내용을 확인한 뒤 다시 열어 주세요."), 409
            clean = validate_document(incoming)
            clean["revision"] = secrets.token_hex(16)
            clean["updated_at"] = datetime.now(ZoneInfo("Asia/Seoul")).isoformat()
            encrypted = cfg[0].encrypt(json.dumps(clean, ensure_ascii=False).encode()).decode()
            if row:
                query(conn, "UPDATE tab_notes SET content = %s WHERE id = %s", (encrypted, row["id"]))
            else:
                query(conn, "INSERT INTO tab_notes (tab, content) VALUES (%s, %s)", (PRIVATE_TAB, encrypted))
            conn.commit()
            if owner_import:
                saved = query(conn, "SELECT content FROM tab_notes WHERE tab = %s ORDER BY id LIMIT 1", (PRIVATE_TAB,)).fetchone()
                verified = validate_document(json.loads(cfg[0].decrypt(saved["content"].encode())))
                digest = hashlib.sha256(json.dumps(verified, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
                return jsonify(ok=True, digest=digest)
            return jsonify(document=clean, year=datetime.now(ZoneInfo("Asia/Seoul")).year)
        except (InvalidToken, json.JSONDecodeError):
            return jsonify(error="저장된 내용을 열 수 없습니다. 보안 설정을 확인해 주세요."), 503
        except (ValueError, TypeError):
            return jsonify(error="금액·날짜·입력 내용을 확인해 주세요."), 400
        except Exception:
            # Never log database exceptions: their parameters may contain financial data.
            return jsonify(error="저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."), 503
        finally:
            conn.close()

    return bp
