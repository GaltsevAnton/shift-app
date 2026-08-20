"""
勤怠リスト（セッション単位） — одна строка на одну смену (clock-in→clock-out).
Порядок колонок соответствует экрану リスト:
申請者 | 日付 | 出勤予定 | 出勤時刻 | 退勤予定 | 退勤時刻 | 休憩開始 | 休憩終了 |
予定休憩 | 休憩時刻 | 勤務時間 | 実際に働いた時間 | シフト予定
"""

import io
from datetime import date, datetime
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.page import PageMargins
from models import AttendanceSessionsRequest

WD_JA       = ["日", "月", "火", "水", "木", "金", "土"]
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

def _fmt_plan_time(hhmmss):
    """LocalTime.toString() из Java — 'HH:MM' или 'HH:MM:SS'"""
    if not hhmmss:
        return "―"
    return hhmmss[:5]

def _fmt_date_wd(ds):
    try:
        y, m, d = map(int, ds.split("-"))
        wd = WD_JA[(date(y, m, d).weekday() + 1) % 7]
        return f"{ds}（{wd}）"
    except Exception:
        return ds

def _fmt_hm(mins):
    if mins is None:
        return "―"
    h, m = divmod(mins, 60)
    return f"{h}時間{m}分"

def _raw_break_minutes(s):
    bs, be = _parse_dt(s.breakStart), _parse_dt(s.breakEnd)
    if not bs or not be:
        return None
    mins = int((be - bs).total_seconds() / 60)
    return mins if mins > 0 else 0

def _raw_actual_worked_minutes(s):
    ci, co = _parse_dt(s.clockIn), _parse_dt(s.clockOut)
    if not ci or not co:
        return None
    mins = int((co - ci).total_seconds() / 60)
    brk = _raw_break_minutes(s)
    if brk:
        mins -= brk
    return mins if mins > 0 else 0


def build(req: AttendanceSessionsRequest) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "勤怠リスト"

    headers = [
        "申請者", "日付", "出勤予定", "出勤時刻", "退勤予定", "退勤時刻",
        "休憩開始", "休憩終了", "予定休憩", "休憩時刻",
        "勤務時間", "実際に働いた時間", "シフト予定",
    ]
    ws.append(headers)
    for col in range(1, len(headers) + 1):
        c = ws.cell(row=1, column=col)
        c.font      = _font(bold=True, color=C_HEADER_FG, size=10)
        c.fill      = _fill(C_HEADER_BG)
        c.alignment = _align()
        c.border    = _thin()

    # Сортировка: дата (убыв.) → 氏名
    sessions = sorted(req.sessions, key=lambda s: s.userName)
    sessions.sort(key=lambda s: s.workDate, reverse=True)

    for i, s in enumerate(sessions):
        ci = _parse_dt(s.clockIn)
        co = _parse_dt(s.clockOut)
        bs = _parse_dt(s.breakStart)
        be = _parse_dt(s.breakEnd)

        shift_plan = "―"
        if s.scheduledClockIn and s.scheduledClockOut:
            shift_plan = f"{_fmt_plan_time(s.scheduledClockIn)}〜{_fmt_plan_time(s.scheduledClockOut)}"

        raw_break = _raw_break_minutes(s)
        break_display = raw_break if raw_break is not None else s.officialBreakMinutes

        row = [
            s.userName,
            _fmt_date_wd(s.workDate),
            _fmt_plan_time(s.scheduledClockIn),
            _fmt_time(ci),
            _fmt_plan_time(s.scheduledClockOut),
            _fmt_time(co),
            _fmt_time(bs) if bs else "―",
            _fmt_time(be) if be else "―",
            _fmt_hm(s.scheduledBreakMinutes),
            _fmt_hm(break_display),
            _fmt_hm(s.workMinutes),
            _fmt_hm(_raw_actual_worked_minutes(s)),
            shift_plan,
        ]

        r = i + 2
        for col, val in enumerate(row, start=1):
            c = ws.cell(row=r, column=col)
            c.value     = val
            bold = col == 11  # 勤務時間
            color = "0369A1" if col in (11, 12, 13) else ("94A3A8" if col in (9, 10) else "000000")
            c.font      = _font(bold=bold, color=color)
            c.alignment = _align(h="left" if col in (1,) else "center")
            c.border    = _thin()
            if i % 2 == 1:
                c.fill = _fill(C_ROW_EVEN)

    widths = [14, 15, 10, 10, 10, 10, 10, 10, 10, 10, 12, 16, 14]
    for idx, w in enumerate(widths, start=1):
        ws.column_dimensions[ws.cell(row=1, column=idx).column_letter].width = w

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{ws.cell(row=1, column=len(headers)).column_letter}{len(sessions) + 1}"

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