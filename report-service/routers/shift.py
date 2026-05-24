from fastapi import APIRouter
from fastapi.responses import Response
from models import ReportRequest
from builders import shift_dept, shift_all, timesheet

router = APIRouter()


@router.post("/shift/dept")
def generate_shift_dept(req: ReportRequest):
    data = shift_dept.build(req)
    filename = f"シフト_{req.ym}_{req.department or 'dept'}.xlsx"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_encode(filename)}"},
    )


@router.post("/shift/all")
def generate_shift_all(req: ReportRequest):
    data = shift_all.build(req)
    filename = f"シフト_{req.ym}_全員.xlsx"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_encode(filename)}"},
    )


@router.post("/timesheet")
def generate_timesheet(req: ReportRequest):
    data = timesheet.build(req)
    filename = f"勤怠_{req.ym}.xlsx"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_encode(filename)}"},
    )


def _encode(filename: str) -> str:
    from urllib.parse import quote
    return quote(filename, safe="")