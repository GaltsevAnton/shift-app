from fastapi import APIRouter
from fastapi.responses import Response
from models import AttendanceReportRequest, AttendanceSessionsRequest, AttendanceReportRangeRequest
from builders import attendance_timesheet, attendance_list, attendance_sessions

router = APIRouter()


@router.post("/timesheet")
def generate_attendance_timesheet(req: AttendanceReportRequest):
    data = attendance_timesheet.build(req)
    filename = f"勤怠集計_{req.ym}.xlsx"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_encode(filename)}"},
    )


@router.post("/list")
def generate_attendance_list(req: AttendanceReportRequest):
    data = attendance_list.build(req)
    filename = f"打刻一覧_{req.ym}.xlsx"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_encode(filename)}"},
    )

@router.post("/sessions")
def generate_attendance_sessions(req: AttendanceSessionsRequest):
    data = attendance_sessions.build(req)
    filename = f"勤怠リスト_{req.fromDate}_{req.toDate}.xlsx"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_encode(filename)}"},
    )

@router.post("/timesheet/filtered")
def generate_attendance_timesheet_filtered(req: AttendanceReportRangeRequest):
    data = attendance_timesheet.build_range(req)
    filename = f"勤怠集計_{req.fromDate}_{req.toDate}.xlsx"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_encode(filename)}"},
    )

def _encode(filename: str) -> str:
    from urllib.parse import quote
    return quote(filename, safe="")