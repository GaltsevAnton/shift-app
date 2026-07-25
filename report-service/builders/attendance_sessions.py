"""
勤怠リスト（セッション単位） — одна строка на одну смену (clock-in→clock-out).
Колонки: 申請者 | 日付 | 出勤時刻 | 退勤時刻 | 休憩開始 | 休憩終了 | 勤務時間
Соответствует виду リスト на экране 勤怠管理.
"""

import io
from datetime import datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.page import PageMargins
from models import AttendanceSessionsRequest

FONT_NAME   = "メイリオ"
C_HEADER_BG = "1F4E79"
C_HEADER_FG = "FFFFFF"
C_ROW_EVEN  = "F2F2F2"
C_GRID      = "AAAAAA"


def _thin(color=C_GRID):
    s = Side(style="thin", color=color)
    return Border(left=s, right=s, top=s, bottom=s)

def _fill(h): return PatternFill("solid", fgColor=h)

def _font(bold=False, color="000000", size=10, name=FONT_NAME):
    return Font(bold=bold, color=color, size=size, name=name)

def _align(h="center", v="center", wrap=False):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

def _parse_dt(iso_dt):
    if not iso_dt:
        return None
    try:
        return datetime.fromisoformat(iso_dt)
    except Exception:
        return None

def _fmt_time(dt):
    return dt.strftime("%H:%M") if dt else "--:--"

def _work_minutes(session):
    ci, co = _parse_dt(session.clockIn), _parse_dt(session.clockOut)
    if not ci or not co:
        return None
    mins = int((co - ci).total_seconds() / 60)
    bs, be = _parse_dt(session.breakStart), _parse_dt(session.breakEnd)
    if bs and be:
        mins -= int((be - bs).total_seconds() / 60)
    return mins if mins > 0 else 0

def _fmt_minutes(mins):
    if mins is None:
        return "―"
    h, m = divmod(mins, 60)
    return f"{h}時間{m}分"


def build(req: AttendanceSessionsRequest) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "勤怠リスト"

    headers = ["申請者", "日付", "出勤時刻", "退勤時刻", "休憩開始", "休憩終了", "勤務時間", "シフト予定"]
    ws.append(headers)
    for col in range(1, len(headers) + 1):
        c = ws.cell(row=1, column=col)
        c.font      = _font(bold=True, color=C_HEADER_FG, size=11)
        c.fill      = _fill(C_HEADER_BG)
        c.alignment = _align()
        c.border    = _thin()

    # Сортировка: дата (убыв.) → 氏名
    sessions = sorted(
        req.sessions,
        key=lambda s: (s.workDate, s.userName),
        reverse=False,
    )
    sessions.sort(key=lambda s: s.workDate, reverse=True)

    for i, s in enumerate(sessions):
        r  = i + 2
        ci = _parse_dt(s.clockIn)
        co = _parse_dt(s.clockOut)
        bs = _parse_dt(s.breakStart)
        be = _parse_dt(s.breakEnd)
        mins = _work_minutes(s)

        shift_str = f"{s.shiftStart}〜{s.shiftEnd}" if (s.shiftStart and s.shiftEnd) else "―"
        row = [
            s.userName,
            s.workDate,
            _fmt_time(ci),
            _fmt_time(co),
            _fmt_time(bs) if bs else "―",
            _fmt_time(be) if be else "―",
            _fmt_minutes(mins),
            shift_str,
        ]
        for col, val in enumerate(row, start=1):
            c = ws.cell(row=r, column=col)
            c.value     = val
            c.font      = _font(bold=(col == 7), color="0369A1" if col == 8 else "000000")
            c.alignment = _align(h="left" if col == 1 else "center")
            c.border    = _thin()
            if i % 2 == 1:
                c.fill = _fill(C_ROW_EVEN)

    ws.column_dimensions["A"].width = 16
    ws.column_dimensions["B"].width = 13
    ws.column_dimensions["C"].width = 11
    ws.column_dimensions["D"].width = 11
    ws.column_dimensions["E"].width = 11
    ws.column_dimensions["F"].width = 11
    ws.column_dimensions["G"].width = 12
    ws.column_dimensions["H"].width = 14

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:H{len(sessions) + 1}"

    ws.page_setup.orientation = "landscape"
    ws.page_setup.paperSize   = 9
    ws.page_setup.fitToWidth  = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins = PageMargins(left=0.4, right=0.4, top=0.6, bottom=0.6, header=0.3, footer=0.3)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()