"""Crons server-side de WhatsApp (APScheduler).

Cadencia (mockup de automations):
  - weekly_digest   → lunes 08:00
  - monthly_report  → día 1 del mes 08:00 (PDF si hay PUBLIC_REPORT_URL)
  - covenant_watch  → cada hora; alerta cuando un escenario está en WATCH/BREACH

Recipients en ZAVU_RECIPIENTS (E.164, separados por coma).
Solo arranca si ENABLE_SCHEDULER=1 (off en tests por defecto).
"""

from __future__ import annotations

import os

_scheduler = None
_last_status = {}  # dedupe de covenant_watch: escenario -> último status alertado


def _recipients() -> list[str]:
    return [r.strip() for r in os.getenv("ZAVU_RECIPIENTS", "").split(",") if r.strip()]


def _job_weekly_digest():
    from integrations.zavu import send_whatsapp
    from models.assistant import weekly_digest_text

    text = weekly_digest_text()
    for to in _recipients():
        send_whatsapp(to, text)


def _job_monthly_report():
    from integrations.zavu import send_document, send_whatsapp
    from models.assistant import weekly_digest_text

    text = "🗓️ *Altis Forecast — Monthly report*\n" + weekly_digest_text()
    url = os.getenv("PUBLIC_REPORT_URL")
    for to in _recipients():
        if url:
            send_document(to, url, caption=text)
        else:
            send_whatsapp(to, text)


def _job_covenant_watch():
    from integrations.zavu import send_whatsapp
    from models.assistant import gather_context

    ctx = gather_context()
    for s, v in ctx.get("scenarios", {}).items():
        status = v.get("status")
        if status in ("WATCH", "BREACH") and _last_status.get(s) != status:
            _last_status[s] = status
            emoji = "🔴" if status == "BREACH" else "🟡"
            text = (
                f"{emoji} *Covenant {v['label']}* flipped to {status} — "
                f"headroom {v['headroom']} (low {v['low_point']} wk {v['low_week']})."
            )
            for to in _recipients():
                send_whatsapp(to, text)
        elif status == "SAFE":
            _last_status[s] = "SAFE"  # reset para re-alertar si vuelve a empeorar


def start_scheduler():
    """Arranca los crons si ENABLE_SCHEDULER=1. Idempotente."""
    global _scheduler
    if os.getenv("ENABLE_SCHEDULER", "0") not in ("1", "true", "True"):
        return None
    if _scheduler is not None:
        return _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
    except Exception:
        return None

    tz = os.getenv("SCHEDULER_TZ", "Europe/Amsterdam")
    sch = BackgroundScheduler(timezone=tz)
    sch.add_job(_job_weekly_digest, CronTrigger(day_of_week="mon", hour=8, minute=0), id="weekly_digest")
    sch.add_job(_job_monthly_report, CronTrigger(day=1, hour=8, minute=0), id="monthly_report")
    sch.add_job(_job_covenant_watch, CronTrigger(minute=0), id="covenant_watch")
    sch.start()
    _scheduler = sch
    return sch
