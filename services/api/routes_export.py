"""Document export endpoints."""

from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from services.accounting.main import read_journal_entries
from services.api.approvals import ApprovalStore

from .dependencies import get_approval_store, get_current_user_token, get_job_store
from .jobs import JobStore

router = APIRouter(prefix="/api/export", tags=["export"])

JobStoreDep = Annotated[JobStore, Depends(get_job_store)]
AuthDep = Annotated[str, Depends(get_current_user_token)]
ApprovalStoreDep = Annotated[ApprovalStore, Depends(get_approval_store)]


def _render_pdf(html: str) -> bytes:
    try:
        from weasyprint import HTML  # type: ignore
    except Exception:
        # Fallback to a minimal PDF structure containing the HTML as plain text.
        payload = html.encode("utf-8", errors="ignore")
        header = (
            b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
            b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
            b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n"
        )
        stream = b"4 0 obj<</Length %d>>stream\n%s\nendstream\nendobj\n" % (
            len(payload),
            payload,
        )
        trailer = (
            b"xref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000061 00000 n \n0000000115 00000 n \n0000000192 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n%d\n%%%%EOF"
            % (len(header),)
        )
        return header + stream + trailer

    html_doc = HTML(string=html)
    return html_doc.write_pdf()


def _build_invoice_html(jobs_data: list[dict[str, str]]) -> str:
    rows = "".join(
        f"<tr>"
        f"<td>{item['job_id']}</td>"
        f"<td>{item['vendor']}</td>"
        f"<td>{item['amount']}</td>"
        f"<td>{item['status']}</td>"
        f"<td>{item['approval']}</td>"
        f"<td>{item['issue_date']}</td>"
        f"</tr>"
        for item in jobs_data
    )
    generated = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    return f"""
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {{ font-family: sans-serif; font-size: 12px; }}
          table {{ border-collapse: collapse; width: 100%; }}
          th, td {{ border: 1px solid #ccc; padding: 6px; text-align: left; }}
          th {{ background: #f5f5f5; }}
        </style>
      </head>
      <body>
        <h1>Invoice Export</h1>
        <p>Generated at {generated} UTC</p>
        <table>
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Vendor</th>
              <th>Amount (JPY)</th>
              <th>Status</th>
              <th>Approval</th>
              <th>Issue Date</th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>
      </body>
    </html>
    """


@router.get("/invoices")
def export_invoices(
    job_store: JobStoreDep,
    approvals: ApprovalStoreDep,
    _: AuthDep,
) -> Response:
    jobs = job_store.list_jobs()
    if not jobs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No jobs to export"
        )

    approval_index = {record.job_id: record.status for record in approvals.list_all()}
    payload: list[dict[str, str]] = []
    for job in jobs:
        entry = job.journal_entry or {}
        amount = entry.get("amount") or entry.get("amount_gross") or ""
        issue_date = (
            (job.ocr_fields or {}).get("issue_date")
            if isinstance(job.ocr_fields, dict)
            else None
        )
        payload.append(
            {
                "job_id": job.id,
                "vendor": entry.get("vendor")
                or (job.ocr_fields or {}).get("vendor")
                or "不明",
                "amount": (
                    f"{amount:,}" if isinstance(amount, int | float) else str(amount)
                ),
                "status": job.status,
                "approval": approval_index.get(job.id, job.approval_status),
                "issue_date": issue_date or "-",
            }
        )

    html = _build_invoice_html(payload)
    pdf_bytes = _render_pdf(html)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="invoices.pdf"'},
    )


@router.get("/journal")
def export_journal(_: AuthDep) -> Response:
    entries = read_journal_entries()
    if not entries:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No journal entries available"
        )

    buffer = io.StringIO()
    writer = csv.DictWriter(
        buffer,
        fieldnames=[
            "job_id",
            "vendor",
            "debit_account",
            "credit_account",
            "amount",
            "tax",
            "recorded_at",
        ],
    )
    writer.writeheader()
    for entry in entries:
        writer.writerow(
            {
                "job_id": entry.get("job_id"),
                "vendor": entry.get("vendor"),
                "debit_account": entry.get("debit_account"),
                "credit_account": entry.get("credit_account"),
                "amount": entry.get("amount") or entry.get("amount_gross"),
                "tax": entry.get("tax"),
                "recorded_at": entry.get("recorded_at"),
            }
        )

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="journal.csv"'},
    )
