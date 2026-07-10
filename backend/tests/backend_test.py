"""Backend API tests for Nasser Cubiertas weekly menu app."""
import os
import io
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback: read from frontend/.env
    env_file = Path("/app/frontend/.env")
    for line in env_file.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip()
            break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "recepcion"
ADMIN_PASSWORD = "rec73491654"

MARA_XLSX = "/tmp/mara.xlsx"

SABROSITOS_TEXT = """Menú de la semana
Lunes
🍽️ Milanesa con puré
🍽️ Tarta de verdura
Martes
🍽️ Pollo al horno
🍽️ Fideos con tuco
Miércoles
🍽️ Bife a la plancha
🍽️ Pastel de papas
Jueves
🍽️ Empanadas
🍽️ Ensalada César
Viernes
🍽️ Pizza
🍽️ Ravioles
"""


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api_client):
    r = api_client.post(f"{API}/admin/login",
                        json={"username": ADMIN_USER, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["token"]
    assert isinstance(token, str) and len(token) > 0
    return token


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data(admin_token):
    """Cleanup test menus/selections at start and end."""
    hdr = {"Authorization": f"Bearer {admin_token}"}
    # Clean before
    requests.delete(f"{API}/selections/reset", params={"provider": "mara"}, headers=hdr)
    requests.delete(f"{API}/selections/reset", params={"provider": "sabrositos"}, headers=hdr)
    yield
    # Clean after: reset selections
    requests.delete(f"{API}/selections/reset", params={"provider": "mara"}, headers=hdr)
    requests.delete(f"{API}/selections/reset", params={"provider": "sabrositos"}, headers=hdr)


# ---------- Health ----------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("app") == "nasser-menus"


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self, api_client):
        r = api_client.post(f"{API}/admin/login",
                            json={"username": ADMIN_USER, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_bad_password(self, api_client):
        r = api_client.post(f"{API}/admin/login",
                            json={"username": ADMIN_USER, "password": "wrong"})
        assert r.status_code == 401

    def test_login_bad_user(self, api_client):
        r = api_client.post(f"{API}/admin/login",
                            json={"username": "nope", "password": ADMIN_PASSWORD})
        assert r.status_code == 401

    def test_protected_without_token(self, api_client):
        r = api_client.post(f"{API}/menus", json={"provider": "mara", "days": []})
        assert r.status_code == 401

    def test_protected_with_bad_token(self, api_client):
        r = requests.post(f"{API}/menus",
                          json={"provider": "mara", "days": []},
                          headers={"Authorization": "Bearer invalid"})
        assert r.status_code == 401


# ---------- Parsers ----------
class TestParsers:
    def test_parse_excel_mara(self, auth_headers):
        assert Path(MARA_XLSX).exists(), "mara.xlsx not found at /tmp/mara.xlsx"
        with open(MARA_XLSX, "rb") as f:
            files = {"file": ("mara.xlsx", f,
                              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            r = requests.post(f"{API}/menus/parse-excel", files=files, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["provider"] == "mara"
        assert isinstance(data["days"], list)
        # Should have all 6 days
        days = {d["day"]: d for d in data["days"]}
        assert set(days.keys()) == {"lunes", "martes", "miercoles", "jueves", "viernes", "sabado"}
        # At least one weekday should have main items
        weekday_items = sum(len(days[d].get("main", [])) for d in
                            ["lunes", "martes", "miercoles", "jueves", "viernes"])
        assert weekday_items > 0, "Parser found no main items in Mara Excel"

    def test_parse_text_sabrositos(self, auth_headers):
        r = requests.post(f"{API}/menus/parse-text",
                          json={"text": SABROSITOS_TEXT}, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["provider"] == "sabrositos"
        days = {d["day"]: d for d in data["days"]}
        assert "Milanesa con puré" in days["lunes"]["main"]
        assert "Pollo al horno" in days["martes"]["main"]
        assert "Bife a la plancha" in days["miercoles"]["main"]

    def test_parse_excel_no_auth(self, api_client):
        with open(MARA_XLSX, "rb") as f:
            files = {"file": ("mara.xlsx", f)}
            r = requests.post(f"{API}/menus/parse-excel", files=files)
        assert r.status_code == 401


# ---------- Menus CRUD ----------
class TestMenusCRUD:
    created_ids = []

    def test_create_menu_manual(self, auth_headers):
        body = {
            "provider": "mara",
            "week_start": "2026-01-05",
            "week_end": "2026-01-10",
            "days": [
                {"day": "lunes", "date": "2026-01-05",
                 "breakfast": ["Café con medialunas"],
                 "main": ["Milanesa con papas", "Guiso de lentejas"],
                 "diet": ["Pollo grillado"],
                 "sides": ["Ensalada", "Pan"]},
                {"day": "martes", "main": ["Tallarines"]},
                {"day": "miercoles", "main": []},
                {"day": "jueves", "main": []},
                {"day": "viernes", "main": []},
                {"day": "sabado", "main": []},
            ],
        }
        r = requests.post(f"{API}/menus", json=body, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["provider"] == "mara"
        assert data["week_start"] == "2026-01-05"
        assert "id" in data and data["id"]
        TestMenusCRUD.created_ids.append(data["id"])

        # Verify persistence via GET list
        r2 = requests.get(f"{API}/menus", params={"provider": "mara"})
        assert r2.status_code == 200
        ids = [m["id"] for m in r2.json()]
        assert data["id"] in ids

    def test_list_menus_public(self, api_client):
        # No auth needed for GET
        r = api_client.get(f"{API}/menus", params={"provider": "mara"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_active_menus(self, api_client):
        r = api_client.get(f"{API}/menus/active")
        assert r.status_code == 200
        data = r.json()
        assert "mara" in data
        assert "sabrositos" in data
        # Mara should have a menu after previous test
        assert data["mara"] is not None
        assert data["mara"]["provider"] == "mara"

    def test_update_menu(self, auth_headers):
        assert TestMenusCRUD.created_ids, "Need created menu first"
        mid = TestMenusCRUD.created_ids[0]
        body = {
            "provider": "mara",
            "week_start": "2026-01-05",
            "week_end": "2026-01-10",
            "days": [{"day": "lunes", "main": ["Updated dish"]}],
        }
        r = requests.put(f"{API}/menus/{mid}", json=body, headers=auth_headers)
        assert r.status_code == 200
        # Verify GET
        r2 = requests.get(f"{API}/menus", params={"provider": "mara"})
        updated = [m for m in r2.json() if m["id"] == mid][0]
        lunes = next(d for d in updated["days"] if d["day"] == "lunes")
        assert "Updated dish" in lunes["main"]


# ---------- Selections ----------
class TestSelections:
    menu_id = None
    sabrositos_menu_id = None

    @pytest.fixture(scope="class", autouse=True)
    def setup_menus(self, auth_headers):
        # Create a Mara menu
        body = {
            "provider": "mara",
            "week_start": "2026-02-02",
            "week_end": "2026-02-07",
            "days": [
                {"day": "lunes", "date": "2026-02-02",
                 "breakfast": ["Café", "Té"],
                 "main": ["Milanesa", "Pasta"],
                 "diet": ["Ensalada de pollo"],
                 "sides": ["Ensalada mixta"]},
                {"day": "martes", "main": ["Pollo", "Pescado"]},
                {"day": "miercoles", "main": []},
                {"day": "jueves", "main": []},
                {"day": "viernes", "main": []},
                {"day": "sabado", "main": []},
            ],
        }
        r = requests.post(f"{API}/menus", json=body, headers=auth_headers)
        assert r.status_code == 200
        TestSelections.menu_id = r.json()["id"]

        # Sabrositos menu
        r2 = requests.post(f"{API}/menus", json={
            "provider": "sabrositos",
            "days": [{"day": "lunes", "main": ["Pizza"]}],
        }, headers=auth_headers)
        assert r2.status_code == 200
        TestSelections.sabrositos_menu_id = r2.json()["id"]

    def test_create_selection(self, api_client):
        payload = {
            "user_name": "TEST_Juan Perez",
            "provider": "mara",
            "menu_id": TestSelections.menu_id,
            "choices": {
                "lunes": {"breakfast": "Café", "main": "Milanesa", "side": "Ensalada mixta"},
                "martes": {"main": "Pollo"},
            },
        }
        r = api_client.post(f"{API}/selections", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_name"] == "TEST_Juan Perez"
        assert data["provider"] == "mara"
        assert "id" in data

    def test_upsert_same_user(self, api_client, auth_headers):
        # Second submission with same name should upsert (not duplicate)
        payload = {
            "user_name": "TEST_Juan Perez",
            "provider": "mara",
            "menu_id": TestSelections.menu_id,
            "choices": {
                "lunes": {"breakfast": "Té", "main": "Pasta"},
            },
        }
        r = api_client.post(f"{API}/selections", json=payload)
        assert r.status_code == 200

        # List selections
        r2 = requests.get(f"{API}/selections",
                          params={"provider": "mara", "menu_id": TestSelections.menu_id},
                          headers=auth_headers)
        assert r2.status_code == 200
        sels = r2.json()
        matching = [s for s in sels if s["user_name"] == "TEST_Juan Perez"]
        assert len(matching) == 1, f"Expected 1 selection after upsert, got {len(matching)}"
        # Verify update took effect
        assert matching[0]["choices"]["lunes"]["main"] == "Pasta"

    def test_upsert_case_insensitive(self, api_client, auth_headers):
        # Same name different case should also upsert (user_name_lc)
        payload = {
            "user_name": "test_juan perez",
            "provider": "mara",
            "menu_id": TestSelections.menu_id,
            "choices": {"lunes": {"main": "Milanesa"}},
        }
        r = api_client.post(f"{API}/selections", json=payload)
        assert r.status_code == 200

        r2 = requests.get(f"{API}/selections",
                          params={"provider": "mara", "menu_id": TestSelections.menu_id},
                          headers=auth_headers)
        sels = r2.json()
        matching = [s for s in sels if s["user_name"].lower() == "test_juan perez"]
        assert len(matching) == 1, f"Expected 1 selection after case-insensitive upsert, got {len(matching)}"

    def test_create_selection_invalid_menu(self, api_client):
        payload = {
            "user_name": "TEST_Foo Bar",
            "provider": "mara",
            "menu_id": "nonexistent-id",
            "choices": {},
        }
        r = api_client.post(f"{API}/selections", json=payload)
        assert r.status_code == 404

    def test_create_selection_empty_name(self, api_client):
        payload = {
            "user_name": "   ",
            "provider": "mara",
            "menu_id": TestSelections.menu_id,
            "choices": {},
        }
        r = api_client.post(f"{API}/selections", json=payload)
        assert r.status_code == 400

    def test_list_selections_requires_auth(self, api_client):
        r = api_client.get(f"{API}/selections", params={"provider": "mara"})
        assert r.status_code == 401

    def test_export_xlsx(self, api_client, admin_token):
        # Add another selection for exports
        api_client.post(f"{API}/selections", json={
            "user_name": "TEST_Maria Lopez",
            "provider": "mara",
            "menu_id": TestSelections.menu_id,
            "choices": {"lunes": {"breakfast": "Café", "main": "Pasta"}},
        })
        url = f"{API}/selections/export"
        r = requests.get(url, params={"provider": "mara", "token": admin_token,
                                      "menu_id": TestSelections.menu_id})
        assert r.status_code == 200, r.text
        assert r.headers.get("Content-Type", "").startswith(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        cd = r.headers.get("Content-Disposition", "")
        assert "attachment" in cd
        assert ".xlsx" in cd
        # Valid xlsx: starts with PK zip signature
        assert r.content[:2] == b"PK"
        assert len(r.content) > 500

    def test_export_bad_token(self, api_client):
        r = requests.get(f"{API}/selections/export",
                         params={"provider": "mara", "token": "wrong"})
        assert r.status_code == 401

    def test_reset_selections(self, api_client, admin_token):
        hdr = {"Authorization": f"Bearer {admin_token}"}
        r = requests.delete(f"{API}/selections/reset", params={"provider": "mara"}, headers=hdr)
        assert r.status_code == 200
        assert "deleted" in r.json()
        # Verify empty
        r2 = requests.get(f"{API}/selections",
                          params={"provider": "mara", "menu_id": TestSelections.menu_id},
                          headers=hdr)
        assert len(r2.json()) == 0
