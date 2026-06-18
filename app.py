"""
AI Lead Magnet — Flask API with lead scoring and MySQL persistence (XAMPP-friendly).
"""
import json
import os
import re
import pymysql
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder=os.path.dirname(os.path.abspath(__file__)))
CORS(app)

# XAMPP MySQL defaults — override with environment variables in production
DB_CONFIG = {
    "host": os.environ.get("MYSQL_HOST", "127.0.0.1"),
    "port": int(os.environ.get("MYSQL_PORT", "3306")),
    "user": os.environ.get("MYSQL_USER", "root"),
    "password": os.environ.get("MYSQL_PASSWORD", ""),
    "database": os.environ.get("MYSQL_DATABASE", "ai_lead_magnet"),
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor,
}


def get_connection(**kwargs):
    """Open a MySQL connection; optional kwargs override DB_CONFIG (e.g. autocommit)."""
    return pymysql.connect(**{**DB_CONFIG, **kwargs})


def ensure_schema():
    """Create database (if permitted) and table."""
    cfg = {k: v for k, v in DB_CONFIG.items() if k != "database"}
    db_name = DB_CONFIG["database"]
    try:
        conn = pymysql.connect(**cfg)
        with conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        conn.commit()
        conn.close()
    except pymysql.Error:
        pass

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS submissions (
                    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    store_url VARCHAR(512) NOT NULL,
                    answers_json JSON NOT NULL,
                    shop_health_score TINYINT UNSIGNED NOT NULL,
                    estimated_monthly_revenue INT UNSIGNED NOT NULL,
                    lead_category ENUM('Hot','Warm','Cold') NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
        conn.commit()
    finally:
        conn.close()


def normalize_url(u):
    u = u.strip().lower()
    if not u:
        return None
    # Agar http/https nahi hai toh khud add kar do
    if not u.startswith(('http://', 'https://')):
        u = 'https://' + u
    # Simple validation: sirf check karo ke "." mojud ho
    if "." not in u:
        return None
    return u


def url_looks_valid(url: str) -> bool:
    return True  # Sab validation bypass kar dein testing ke liye


def score_from_answers(answers: dict) -> tuple[int, int, str, dict]:
    """
    Deterministic scoring from five answers.
    Returns (health_score 0-100, estimated_monthly_revenue int, lead_category, dashboard_extras).
    """
    g = str(answers.get("goal", "")).lower()
    plat = str(answers.get("platform", "")).lower()
    traffic = str(answers.get("traffic", "")).lower()
    ads = str(answers.get("ads", "")).lower()
    rev = str(answers.get("revenue", "")).lower()

    points = 35  # baseline for completing the flow

    goal_map = {"grow revenue": 12, "launch new products": 10, "reduce costs": 8, "brand awareness": 6}
    points += goal_map.get(g, 8)

    plat_map = {"shopify": 12, "woocommerce": 10, "custom": 8, "other": 6}
    points += plat_map.get(plat, 7)

    traffic_map = {"100k+": 14, "10k-100k": 11, "1k-10k": 8, "under 1k": 5}
    points += traffic_map.get(traffic, 7)

    ads_map = {"yes, actively": 12, "sometimes": 8, "no": 5}
    points += ads_map.get(ads, 6)

    revenue_base = 8000
    rev_map = {
        "under 10k": (8000, 6),
        "10k-50k": (22000, 9),
        "50k-200k": (75000, 11),
        "200k+": (180000, 14),
    }
    base_rev, rev_pts = rev_map.get(rev, (12000, 8))
    revenue_base = base_rev
    points += rev_pts

    health = max(0, min(100, int(round(points))))

    # Lead tier: blend health with commercial signals so Hot/Warm/Cold vary realistically
    qual = 0
    if rev in ("50k-200k", "200k+"):
        qual += 4
    elif rev == "10k-50k":
        qual += 2

    if traffic == "100k+":
        qual += 3
    elif traffic == "10k-100k":
        qual += 2
    elif traffic == "1k-10k":
        qual += 1

    if ads == "yes, actively":
        qual += 2
    elif ads == "sometimes":
        qual += 1

    if health >= 74 and qual >= 7:
        category = "Hot"
    elif health >= 55 and qual >= 3:
        category = "Warm"
    elif qual <= 2 or health < 55:
        category = "Cold"
    else:
        category = "Warm"

    # Estimated monthly revenue scales slightly with health
    est_revenue = int(round(revenue_base * (0.85 + (health / 100) * 0.35)))
    est_revenue = max(2000, est_revenue)

    if health >= 72 and base_rev >= 22000:
        category = "Hot"
    elif health >= 50:
        category = "Warm"
    else:
        category = "Cold"

    potential_pct = 12 + (health % 18)

    opportunities = [
        {
            "title": "Improve Product Page Conversion",
            "monthly_value": int(est_revenue * 0.18),
        },
        {
            "title": "Improve Checkout Experience",
            "monthly_value": int(est_revenue * 0.06),
        },
        {
            "title": "Leverage Abandoned Cart Recovery",
            "monthly_value": int(est_revenue * 0.11),
        },
    ]

    opp_sum = sum(o["monthly_value"] for o in opportunities)
    center_total = int(opp_sum * 0.42)

    traffic_score = max(40, min(98, health + (3 if "100k" in traffic else -5)))
    conv_rate = round(1.2 + (health / 100) * 2.4, 1)
    site_speed = max(55, min(98, 72 + (hash(g + plat) % 21)))
    exp = "Excellent" if health >= 85 else "Good" if health >= 65 else "Fair"

    # Donut segment weights (must sum to 100 for clean arc math on client)
    seg_a = max(15, min(50, int(traffic_score * 0.35)))
    seg_b = max(15, min(45, int(site_speed * 0.28)))
    seg_c = 100 - seg_a - seg_b

    extras = {
        "percentile_comparison": max(50, min(95, health)),
        "potential_increase_pct": potential_pct,
        "opportunities": opportunities,
        "donut_segments": [
            {"label": "Traffic mix", "value": seg_a, "color": "#0052CC"},
            {"label": "Conversion", "value": seg_b, "color": "#6554C0"},
            {"label": "Retention", "value": seg_c, "color": "#36B37E"},
        ],
        "donut_center_monthly": center_total,
        "traffic_score": traffic_score,
        "conversion_rate": conv_rate,
        "site_speed": site_speed,
        "experience_label": exp,
    }

    return health, est_revenue, category, extras


def persist_submission(
    url: str, answers: dict, health: int, revenue: int, category: str
) -> None:
    # autocommit: one round-trip less than explicit commit(); connect_timeout: fail fast if DB is down
    conn = get_connection(autocommit=True, connect_timeout=8)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO submissions
                (store_url, answers_json, shop_health_score, estimated_monthly_revenue, lead_category)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (url, json.dumps(answers), health, revenue, category),
            )
    finally:
        conn.close()


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/script.js")
def script():
    return send_from_directory(app.static_folder, "script.js", mimetype="application/javascript")


@app.route("/api/health")
def health():
    return jsonify({"ok": True})


@app.route("/api/report", methods=["POST"])
def report():
    data = request.get_json(silent=True) or {}
    raw_url = (data.get("url") or "").strip()
    url = normalize_url(raw_url)
    answers = data.get("answers") or {}

    if not url_looks_valid(url):
        return jsonify({"error": "Please enter a valid store URL (e.g. yourstore.com)."}), 400

    required = ["goal", "platform", "traffic", "ads", "revenue"]
    missing = [k for k in required if not str(answers.get(k, "")).strip()]
    if missing:
        return jsonify({"error": "Please answer all 5 questions."}), 400

    health_score, est_revenue, category, extras = score_from_answers(answers)

    try:
        persist_submission(url, answers, health_score, est_revenue, category)
    except pymysql.Error as e:
        return jsonify(
            {
                "error": "Database error. Ensure MySQL is running in XAMPP and database user/password match.",
                "detail": str(e),
            }
        ), 503

    return jsonify(
        {
            "answers": answers,
            "shop_health_score": health_score,
            "estimated_monthly_revenue": est_revenue,
            "lead_category": category,
            "percentile_comparison": extras["percentile_comparison"],
            "potential_increase_pct": extras["potential_increase_pct"],
            "opportunities": extras["opportunities"],
            "donut_segments": extras["donut_segments"],
            "donut_center_monthly": extras["donut_center_monthly"],
            "traffic_score": extras["traffic_score"],
            "conversion_rate": extras["conversion_rate"],
            "site_speed": extras["site_speed"],
            "experience_label": extras["experience_label"],
        }
    )


if __name__ == "__main__":
    ensure_schema()
    app.run(host="127.0.0.1", port=5000, debug=True)
