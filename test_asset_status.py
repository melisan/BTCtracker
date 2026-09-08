import copy
import ast
import os
from pathlib import Path
import sqlite3
import unittest
from unittest.mock import patch

from cryptography.fernet import Fernet
from flask import Flask
from asset_status import create_asset_blueprint, PRIVATE_TAB, validate_document


SAMPLE = {"accounts":[{"id":"sample-1", "in_total":True, "category":"예적금", "name":"가상 이름", "description":"가상 예금",
          "account":"001-000-000", "amount":100000, "interest":1234, "notes":"테스트", "maturity":"2026-12-31"}], "other":"가상 기타 내용", "other_assets":[], "total_scope":"c1"}


def fixture():
    db = sqlite3.connect(":memory:", check_same_thread=False)
    db.row_factory = sqlite3.Row
    db.execute("CREATE TABLE tab_notes (id INTEGER PRIMARY KEY, tab TEXT, content TEXT, pinned BOOLEAN DEFAULT FALSE, created_at TEXT)")
    class Connection:
        def commit(self): db.commit()
        def close(self): db.rollback()
    conn = Connection()
    def query(_, sql, args=()):
        if "pg_advisory" in sql: return None
        return db.execute(sql.replace("%s", "?"), args)
    app = Flask(__name__)
    app.register_blueprint(create_asset_blueprint(lambda:conn, query))
    return app, db


class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"ASSET_STATUS_KEY":Fernet.generate_key().decode(), "ADMIN_PASSWORD":"synthetic-test-only-password"})
        self.env.start()
        self.app, self.db = fixture()
        self.client = self.app.test_client()
        self.headers = {"X-Asset-Request":"1"}
    def tearDown(self):
        self.db.close(); self.env.stop()
    def unlock(self):
        response = self.client.post("/asset-status/unlock", json={"password":"synthetic-test-only-password"}, headers=self.headers)
        if response.status_code == 200:
            self.headers["X-Asset-Token"] = response.json["token"]
        return response
    def test_requires_password_for_read_and_write(self):
        self.assertEqual(self.client.get("/asset-status/records").status_code,401)
        self.assertEqual(self.client.post("/asset-status/records",json=SAMPLE,headers=self.headers).status_code,401)
    def test_wrong_password_and_rate_limit(self):
        for _ in range(5):
            self.assertEqual(self.client.post("/asset-status/unlock",json={"password":"wrong"},headers=self.headers).status_code,401)
        self.assertEqual(self.unlock().status_code,429)
    def test_missing_configuration_fails_closed(self):
        with patch.dict(os.environ,{"ASSET_STATUS_KEY":""}): self.assertEqual(self.unlock().status_code,503)
        with patch.dict(os.environ,{"ADMIN_PASSWORD":"admin1234"}): self.assertEqual(self.unlock().status_code,503)
    def test_origin_and_header(self):
        self.assertEqual(self.client.post("/asset-status/unlock",json={}).status_code,403)
        self.assertEqual(self.client.post("/asset-status/unlock",json={},headers={**self.headers,"Origin":"https://untrusted.example"}).status_code,403)
    def test_encrypted_roundtrip_and_revision(self):
        response = self.unlock()
        self.assertIn("HttpOnly",response.headers["Set-Cookie"])
        self.assertIn("SameSite=Strict",response.headers["Set-Cookie"])
        first = self.client.post("/asset-status/records",json=SAMPLE,headers=self.headers)
        self.assertEqual(first.status_code,200)
        stored = self.db.execute("SELECT content FROM tab_notes WHERE tab=?",(PRIVATE_TAB,)).fetchone()[0]
        self.assertNotIn("001-000",stored)
        self.assertNotIn("가상",stored)
        self.assertEqual(self.client.get("/asset-status/records").status_code,401)
        read = self.client.get("/asset-status/records",headers=self.headers).json["document"]
        self.assertEqual(validate_document(read),validate_document(SAMPLE))
        self.assertEqual(self.client.post("/asset-status/records",json=SAMPLE,headers=self.headers).status_code,409)
        read["accounts"][0]["amount"] = 200000
        self.assertEqual(self.client.put("/asset-status/records",json=read,headers=self.headers).status_code,200)
        self.assertEqual(self.client.put("/asset-status/records",json=read,headers=self.headers).status_code,409)
    def test_lock_and_revisit(self):
        self.unlock(); self.client.post("/asset-status/lock",json={},headers=self.headers)
        self.assertEqual(self.client.get("/asset-status/records").status_code,401)
        self.unlock(); response = self.client.get("/asset-status/")
        self.assertEqual(response.status_code,200)
        self.assertIn("no-store", response.headers["Cache-Control"])
        self.assertIn("default-src 'none'",response.headers["Content-Security-Policy"])
        self.assertEqual(self.client.get("/asset-status/records").status_code,401)
    def test_invalid_values(self):
        for field,value in [("amount",float("nan")),("amount","1,000"),("maturity","2026-02-30"),("account",1234)]:
            bad = copy.deepcopy(SAMPLE); bad["accounts"][0][field] = value
            with self.assertRaises(ValueError): validate_document(bad)
    def test_key_loss_does_not_overwrite_records(self):
        self.unlock(); self.client.post("/asset-status/records",json=SAMPLE,headers=self.headers)
        with patch.dict(os.environ,{"ASSET_STATUS_KEY":Fernet.generate_key().decode()}):
            self.unlock()
            self.assertEqual(self.client.post("/asset-status/records",json=SAMPLE,headers=self.headers).status_code,503)

    def test_public_notes_cannot_read_or_modify_private_storage(self):
        # Load route definitions without running existing production startup migrations.
        tree = ast.parse(Path("app.py").read_text())
        tree.body = [node for node in tree.body if not (isinstance(node,ast.Expr)
            and isinstance(node.value,ast.Call) and isinstance(node.value.func,ast.Name)
            and node.value.func.id in {"init_db","clean_snapshot_outliers"})]
        namespace = {"__name__":"asset_routes_test"}
        exec(compile(tree,"app.py","exec"),namespace)
        class Connection:
            def commit(inner): self.db.commit()
            def close(inner): pass
        namespace["get_db"] = lambda: Connection()
        namespace["query"] = lambda conn,sql,args=(): self.db.execute(sql.replace("%s","?"),args)
        self.db.execute("INSERT INTO tab_notes (id,tab,content) VALUES (1,?,?)",(PRIVATE_TAB,"ciphertext"))
        client = namespace["app"].test_client()
        self.assertEqual(client.get("/api/notes",query_string={"tab":PRIVATE_TAB}).status_code,404)
        self.assertEqual(client.post("/api/notes",json={"tab":PRIVATE_TAB,"content":"attack"}).status_code,404)
        self.assertEqual(client.post("/api/notes/1/pin",json={}).status_code,404)
        client.put("/api/notes/1",json={"content":"attack"})
        client.delete("/api/notes/1")
        self.assertEqual(self.db.execute("SELECT content FROM tab_notes WHERE id=1").fetchone()[0],"ciphertext")


if __name__ == "__main__": unittest.main()
