"""Entry point.

Usage:
  python run.py ingest    # parse xlsx files → DuckDB
  python run.py model     # run all 5 models → forecast_13w
  python run.py serve     # start FastAPI on port 8000
  python run.py all       # ingest + model + serve
"""

import sys

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"

    if cmd in ("ingest", "all"):
        from ingestion.reconcile import reconcile_all

        rows = reconcile_all("data/raw/")
        print(f"✅ Ingestion complete ({rows} rows)")

    if cmd in ("model", "all"):
        from db.database import get_connection
        from models.scenario_engine import run_all_scenarios

        run_all_scenarios(get_connection())
        print("✅ Models complete")

    if cmd in ("serve", "all"):
        import uvicorn

        uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)
