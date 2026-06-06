"""Entry point.

Usage:
  python run.py ingest    # parse xlsx files → Postgres (transactions)
  python run.py model     # run all 5 models → forecast_13w
  python run.py seed      # seed the 4 role-based users
  python run.py calibrate # fit + persist weather↔billing calibration
  python run.py serve     # start FastAPI on port 8000
  python run.py all       # ingest + model + serve
"""

import sys
from pathlib import Path

# data/raw vive en la raíz del repo (backend/ es hija)
RAW_DIR = str(Path(__file__).resolve().parent.parent / "data" / "raw")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"

    if cmd == "seed":
        from db.seed_users import seed_users

        users = seed_users()
        print(f"✅ Seeded {len(users)} users")

    if cmd == "calibrate":
        from db.database import get_connection
        from models.weather_calibration import calibrate, persist

        con = get_connection()
        c = calibrate(con, force=True)
        persist(con, c)
        con.close()
        print(f"✅ Calibrated weather↔billing: R²={c['multivariate_r2']} "
              f"over {c['n_weeks']} weeks, significant={c['significant_drivers']}")

    if cmd in ("ingest", "all"):
        from ingestion.reconcile import reconcile_all

        rows = reconcile_all(RAW_DIR)
        print(f"✅ Ingestion complete ({rows} rows)")

    if cmd in ("model", "all"):
        from db.database import get_connection
        from models.scenario_engine import run_all_scenarios

        run_all_scenarios(get_connection())
        print("✅ Models complete")

    if cmd in ("serve", "all"):
        import os

        import uvicorn

        # Railway/Heroku inyectan $PORT; reload solo en dev (RELOAD=1).
        uvicorn.run(
            "api.main:app",
            host="0.0.0.0",
            port=int(os.getenv("PORT", "8000")),
            reload=os.getenv("RELOAD", "0") == "1",
        )
