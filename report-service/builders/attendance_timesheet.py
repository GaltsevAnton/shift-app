"""
Табель учёта фактического времени (勤怠集計表・実績).
Каждая смена сотрудника за день — отдельный блок из 4 строк (出勤/退勤/実働/休憩),
блоки разделены жирной линией — как в календарном виде 勤怠管理 на экране.
Высота блока сотрудника = 4 × (макс. число смен в любом дне месяца у этого сотрудника).
実働・休憩 считаются гибридно (факт пробивки休憩, иначе — авто по 休憩ルール) —
все вычисления уже сделаны на бэкенде (ReportService), билдер только форматирует.
Колонки: 職種・役職 | 部署 | 氏名 | メタ | 1..31 | 合計時間
"""

import io
import calendar
from datetime import date, datetime, timedelta
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.page import PageMargins
from models import AttendanceReportRequest, AttendanceReportRangeRequest, AttendanceStaffModel, AttendanceDayModel

WD_JA     = ["日", "月", "火", "水", "木", "金", "土"]
FONT_NAME = "メイリオ"

C_SAT_BG     = "BDD7EE"
C_SUN_BG     = "FCE4D6"
C_WEEKDAY_BG = "DDEBF7"
C_OFF_FG     = "808080"
C_OFF_BG     = "F2F2F2"
C_ROW_ODD    = "FFFFFF"
C_LABEL_BG   = "D9D9D9"
C_GRID       = "AAAAAA"
C_LATE_BG    = "FEE2E2"   # опоздание — красноватый
C_GREEN_BG   = "DCFCE7"   # вовремя
C_YELLOW_BG  = "FEF9C3"   # ушёл раньше
C_NOPLAN_BG  = "F1F5F9"   # нет плана — серый

LABELS = ["出勤", "退勤", "実働", "休憩"]


def _thin(color=C_GRID):
    s = Side(style="thin", color=color)
    return Border(left=s, right=s, top=s, bottom=s)

def _fill(h): return PatternFill("solid", fgColor=h)

def _font(bold=False, color="000000", size=9, name=FONT_NAME):
    return Font(bold=bold, color=color, size=size, name=name)

def _align(h="center", v="center", wrap=True):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

def _weekday(ym, day):
    y, m = map(int, ym.split("-"))
    wd = date(y, m, day).weekday()
    return (wd + 1) % 7  # 0=日..6=土

def _day_data(staff: AttendanceStaffModel, day: int, ym: str) -> AttendanceDayModel:
    ds = f"{ym}-{day:02d}"
    for d in staff.days:
        if d.date == ds:
            return d
    return AttendanceDayModel(date=ds)

def _parse_hm(iso_dt: str | None):
    if not iso_dt:
        return None
    try:
        return datetime.fromisoformat(iso_dt).strftime("%H:%M")
    except Exception:
        return None

def _fmt_hm(mins):
    if mins is None:
        return ""
    h, m = divmod(mins, 60)
    return f"{h}:{m:02d}"

def _apply_outer_border(ws, min_row, max_row, min_col, max_col, color=C_GRID):
    thin = Side(style="thin", color=color)
    no   = Side(style=None)
    for row in range(min_row, max_row + 1):
        for col in range(min_col, max_col + 1):
            c = ws.cell(row=row, column=col)
            top    = thin if row == min_row else no
            bottom = thin if row == max_row else no
            left   = thin if col == min_col else no
            right  = thin if col == max_col else no
            c.border = Border(top=top, bottom=bottom, left=left, right=right)

def _max_sessions_for_staff(s: AttendanceStaffModel, days, ym: str) -> int:
    m = 1
    for day in days:
        cnt = len(_day_data(s, day, ym).sessions or [])
        if cnt > m:
            m = cnt
    return m

def _date_range(from_str: str, to_str: str) -> list[str]:
    y1, m1, d1 = map(int, from_str.split("-"))
    y2, m2, d2 = map(int, to_str.split("-"))
    cur = date(y1, m1, d1)
    end = date(y2, m2, d2)
    out = []
    while cur <= end:
        out.append(cur.isoformat())
        cur += timedelta(days=1)
    return out

def _weekday_from_iso(date_str: str) -> int:
    y, m, d = map(int, date_str.split("-"))
    wd = date(y, m, d).weekday()
    return (wd + 1) % 7  # 0=日..6=土

def _day_data_range(staff: AttendanceStaffModel, date_str: str) -> AttendanceDayModel:
    for d in staff.days:
        if d.date == date_str:
            return d
    return AttendanceDayModel(date=date_str)

def _max_sessions_for_staff_range(s: AttendanceStaffModel, dates: list[str]) -> int:
    m = 1
    for ds in dates:
        cnt = len(_day_data_range(s, ds).sessions or [])
        if cnt > m:
            m = cnt
    return m

def build(req: AttendanceReportRequest) -> bytes:
    ym    = req.ym
    y, m  = map(int, ym.split("-"))
    total = calendar.monthrange(y, m)[1]
    days  = list(range(1, total + 1))
    staff = req.staff

    wb = Workbook()
    ws = wb.active
    ws.title = f"{y}年{m}月_勤怠集計"

    ws.column_dimensions["A"].width = 6
    ws.column_dimensions["B"].width = 8
    ws.column_dimensions["C"].width = 12
    ws.column_dimensions["D"].width = 5
    for i, _ in enumerate(days):
        col = get_column_letter(5 + i)
        ws.column_dimensions[col].width = 7
    ws.column_dimensions[get_column_letter(5 + total)].width = 7  # 合計時間

    ws.row_dimensions[1].height = 6

    last_col = get_column_letter(4 + total)
    ws.merge_cells(f"A2:{last_col}2")
    c = ws["A2"]
    c.value     = f"{req.hotelName}勤怠集計表（実績）（{y}年{m}月1日～{m}月{total}日）"
    c.font      = _font(bold=True, size=12)
    c.alignment = _align(h="center")
    ws.row_dimensions[2].height = 18
    ws.row_dimensions[3].height = 5

    for col_idx, label in [(1, "職種・役職"), (2, "部署"), (3, "氏名"), (4, "日\n曜日")]:
        ws.merge_cells(f"{get_column_letter(col_idx)}4:{get_column_letter(col_idx)}5")
        c = ws.cell(row=4, column=col_idx)
        c.value     = label
        c.font      = _font(size=8)
        c.alignment = _align()
        c.border    = _thin()
        _apply_outer_border(ws, 4, 5, col_idx, col_idx)

    ws.row_dimensions[4].height = 16
    ws.row_dimensions[5].height = 16

    for i, day in enumerate(days):
        col = 5 + i
        wd  = _weekday(ym, day)
        c = ws.cell(row=4, column=col); c.value = day; c.font = _font(size=8); c.alignment = _align(); c.border = _thin()
        c = ws.cell(row=5, column=col); c.value = WD_JA[wd]; c.font = _font(size=8); c.alignment = _align(); c.border = _thin()

    ws.merge_cells(f"{get_column_letter(5 + total)}4:{get_column_letter(5 + total)}5")
    c = ws.cell(row=4, column=5 + total)
    c.value     = "合計\n時間"
    c.font      = _font(size=7)
    c.alignment = _align()
    c.border    = _thin()
    _apply_outer_border(ws, 4, 5, 5 + total, 5 + total)

    base_row = 6
    current_row = base_row

    for staff_idx, s in enumerate(staff):
        max_sessions = _max_sessions_for_staff(s, days, ym)
        rows_per_staff = 4 * max_sessions
        r = current_row
        row_bg = C_ROW_ODD

        ws.merge_cells(f"A{r}:A{r+rows_per_staff-1}")
        c = ws[f"A{r}"]; c.value = s.position or ""; c.font = _font(size=8, color="555555")
        c.fill = _fill(row_bg); c.alignment = _align(h="center"); c.border = _thin()
        _apply_outer_border(ws, r, r+rows_per_staff-1, 1, 1)

        ws.merge_cells(f"B{r}:B{r+rows_per_staff-1}")
        c = ws[f"B{r}"]; c.value = "、".join(s.departments); c.font = _font(size=8, color="555555")
        c.fill = _fill(row_bg); c.alignment = _align(h="center"); c.border = _thin()
        _apply_outer_border(ws, r, r+rows_per_staff-1, 2, 2)

        ws.merge_cells(f"C{r}:C{r+rows_per_staff-1}")
        c = ws[f"C{r}"]; c.value = s.userName; c.font = _font(bold=True, size=9)
        c.fill = _fill(row_bg); c.alignment = _align(h="center"); c.border = _thin()
        _apply_outer_border(ws, r, r+rows_per_staff-1, 3, 3)

        # Метки 出勤/退勤/実働/休憩 — повторяются на каждый блок-смену
        for session_idx in range(max_sessions):
            block_r = r + session_idx * 4
            for sub, label in enumerate(LABELS):
                c = ws.cell(row=block_r + sub, column=4)
                c.value = label; c.font = _font(size=7, color="333333")
                c.fill = _fill(C_LABEL_BG); c.alignment = _align(); c.border = _thin()
                ws.row_dimensions[block_r + sub].height = 14

        total_work_minutes = 0
        for i, day in enumerate(days):
            col = 5 + i
            d = _day_data(s, day, ym)
            sessions = d.sessions or []

            if not sessions:
                ws.merge_cells(f"{get_column_letter(col)}{r}:{get_column_letter(col)}{r+rows_per_staff-1}")
                c = ws.cell(row=r, column=col)
                c.value = "―"; c.font = _font(color=C_OFF_FG, size=10)
                c.fill = _fill(C_OFF_BG); c.alignment = _align(); c.border = _thin()
                _apply_outer_border(ws, r, r+rows_per_staff-1, col, col)
                continue

            day_work_min = sum(sess.workMinutes or 0 for sess in sessions)
            total_work_minutes += day_work_min

            for session_idx in range(max_sessions):
                block_r = r + session_idx * 4
                sess = sessions[session_idx] if session_idx < len(sessions) else None

                if sess is None:
                    # У этого дня меньше смен, чем максимум по сотруднику — оставляем пусто
                    for sub in range(4):
                        c = ws.cell(row=block_r + sub, column=col)
                        c.value = ""
                        c.fill = _fill(row_bg)
                        c.alignment = _align(h="center", v="center")
                        c.border = _thin()
                        c.font = _font(size=9)
                    continue

                in_time    = _parse_hm(sess.officialClockIn) or ""
                out_time   = _parse_hm(sess.officialClockOut) or ""
                work_time  = _fmt_hm(sess.workMinutes)
                break_time = _fmt_hm(sess.officialBreakMinutes)

                if not sess.officialClockIn:
                    in_bg = row_bg
                elif not sess.hasPlan:
                    in_bg = C_NOPLAN_BG
                else:
                    in_bg = C_LATE_BG if sess.lateIn else C_GREEN_BG

                if not sess.officialClockOut:
                    out_bg = row_bg
                elif not sess.hasPlan:
                    out_bg = C_NOPLAN_BG
                else:
                    out_bg = C_YELLOW_BG if sess.earlyOut else C_GREEN_BG

                row_bgs = [in_bg, out_bg, row_bg, row_bg]

                for sub, (val, bg) in enumerate(zip([in_time, out_time, work_time, break_time], row_bgs)):
                    c = ws.cell(row=block_r + sub, column=col)
                    c.value = val; c.fill = _fill(bg)
                    c.alignment = _align(h="center", v="center"); c.border = _thin()
                    if sub == 2:
                        c.font = _font(size=9, bold=True, color="0369A1")
                    elif sub == 3:
                        c.font = _font(size=8, color="777777")
                    else:
                        c.font = _font(size=9)

        off_col = 5 + total
        ws.merge_cells(f"{get_column_letter(off_col)}{r}:{get_column_letter(off_col)}{r+rows_per_staff-1}")
        c = ws.cell(row=r, column=off_col)
        c.value = _fmt_hm(total_work_minutes); c.font = _font(bold=True, size=9)
        c.alignment = _align(); c.border = _thin()
        _apply_outer_border(ws, r, r+rows_per_staff-1, off_col, off_col)

        # Разделитель между блоками смен (жирная линия) + внешняя рамка строки сотрудника
        thick = Side(style="medium", color="000000")
        no    = Side(style=None)
        is_first = staff_idx == 0
        for sub_row in range(r, r + rows_per_staff):
            is_session_divider = (sub_row - r + 1) % 4 == 0 and sub_row != r + rows_per_staff - 1
            for col_idx in range(1, 5 + total):
                c = ws.cell(row=sub_row, column=col_idx)
                top    = thick if (sub_row == r and is_first) else no
                bottom = thick if (sub_row == r + rows_per_staff - 1 or is_session_divider) else no
                left   = thick if col_idx == 1 else no
                right  = thick if col_idx == 4 + total else no
                if any([top != no, bottom != no, left != no, right != no]):
                    existing = c.border
                    c.border = Border(
                        top=top if top != no else existing.top,
                        bottom=bottom if bottom != no else existing.bottom,
                        left=left if left != no else existing.left,
                        right=right if right != no else existing.right,
                    )

        current_row += rows_per_staff

    last_data_row = current_row - 1
    last_data_col = 5 + total
    thick = Side(style="medium", color="000000")
    no    = Side(style=None)
    for row in range(4, last_data_row + 1):
        for col in range(1, last_data_col + 1):
            c = ws.cell(row=row, column=col)
            top    = thick if row == 4 else no
            bottom = thick if row == last_data_row else no
            left   = thick if col == 1 else no
            right  = thick if col == last_data_col else no
            if any([top, bottom, left, right]):
                existing = c.border
                c.border = Border(
                    top=top if top != no else existing.top,
                    bottom=bottom if bottom != no else existing.bottom,
                    left=left if left != no else existing.left,
                    right=right if right != no else existing.right,
                )

    ws.freeze_panes = "E6"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.paperSize   = 9
    ws.page_setup.fitToPage   = True
    ws.page_setup.fitToWidth  = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins = PageMargins(left=0.25, right=0.25, top=0.75, bottom=0.75, header=0.3, footer=0.3)
    ws.page_setup.copies = 1

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()

# ── 勤怠集計表（期間）— выгрузка «как на экране» ─────────────────────────
# Строки блока смены — в том же порядке, что на экране
ROW_DEFS = [
    ("in",    "出勤"),
    ("out",   "退勤"),
    ("gross", "拘束"),
    ("break", "休憩"),
    ("work",  "実働"),
]
# Необязательные колонки слева (ключ, заголовок, ширина) — 氏名 и метки показываются всегда
COL_DEFS = [
    ("number",     "№",         4),
    ("position",   "職種・役職", 6),
    ("department", "部署",       8),
]


def _minutes_between_iso(a, b):
    if not a or not b:
        return None
    try:
        mins = round((datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds() / 60)
        return mins if mins > 0 else 0
    except Exception:
        return None


def _session_minutes(sess):
    """拘束/休憩/実働 — та же формула, что на экране:
    拘束 = 退勤（丸め）− 出勤（丸め）; 休憩 = факт пробивки, иначе officialBreakMinutes; 実働 = 拘束 − 休憩"""
    gross = _minutes_between_iso(sess.officialClockIn, sess.officialClockOut)
    raw_brk = _minutes_between_iso(sess.breakStart, sess.breakEnd)
    brk = raw_brk if raw_brk is not None else (sess.officialBreakMinutes or 0)
    work = max(gross - brk, 0) if gross is not None else None
    return gross, brk, work


def _merge_v(ws, col, r1, r2):
    if r2 > r1:
        ws.merge_cells(f"{get_column_letter(col)}{r1}:{get_column_letter(col)}{r2}")


def build_range(req: AttendanceReportRangeRequest) -> bytes:
    dates = _date_range(req.fromDate, req.toDate)
    total = len(dates)
    staff = req.staff

    # ── Настройки отображения (None = всё) ──
    col_keys = set(req.columns) if req.columns is not None else {k for k, _, _ in COL_DEFS}
    row_keys = set(req.rows) if req.rows is not None else ({k for k, _ in ROW_DEFS} | {"note"})
    block_keys = [k for k, _ in ROW_DEFS if k in row_keys]
    show_note = "note" in row_keys
    if not block_keys and not show_note:          # защита от «всё выключено»
        block_keys = [k for k, _ in ROW_DEFS]
        show_note = True
    per_block = len(block_keys)
    block_labels = dict(ROW_DEFS)
    show_colors = req.showColors

    fixed = [(k, label, w) for k, label, w in COL_DEFS if k in col_keys]
    fixed.append(("name", "氏名", 12))
    fixed.append(("meta", "日\n曜日", 5))
    n_fixed       = len(fixed)
    meta_col      = n_fixed
    first_day_col = n_fixed + 1
    last_day_col  = n_fixed + total
    total_col     = last_day_col + 1

    wb = Workbook()
    ws = wb.active
    ws.title = f"{req.fromDate}〜{req.toDate}_勤怠集計"[:31]

    for idx, (_, _, w) in enumerate(fixed, start=1):
        ws.column_dimensions[get_column_letter(idx)].width = w
    for i in range(total):
        ws.column_dimensions[get_column_letter(first_day_col + i)].width = 7
    ws.column_dimensions[get_column_letter(total_col)].width = 7  # 合計時間

    ws.row_dimensions[1].height = 6

    ws.merge_cells(f"A2:{get_column_letter(last_day_col)}2")
    c = ws["A2"]
    c.value     = f"{req.hotelName}勤怠集計表（実績）（{req.fromDate}～{req.toDate}）"
    c.font      = _font(bold=True, size=12)
    c.alignment = _align(h="center")
    ws.row_dimensions[2].height = 18
    ws.row_dimensions[3].height = 5

    for col_idx, (_, label, _) in enumerate(fixed, start=1):
        ws.merge_cells(f"{get_column_letter(col_idx)}4:{get_column_letter(col_idx)}5")
        c = ws.cell(row=4, column=col_idx)
        c.value     = label
        c.font      = _font(size=8)
        c.alignment = _align()
        c.border    = _thin()
        _apply_outer_border(ws, 4, 5, col_idx, col_idx)

    ws.row_dimensions[4].height = 16
    ws.row_dimensions[5].height = 16

    for i, ds in enumerate(dates):
        col = first_day_col + i
        wd  = _weekday_from_iso(ds)
        dd  = int(ds[8:10])
        c = ws.cell(row=4, column=col); c.value = dd; c.font = _font(size=8); c.alignment = _align(); c.border = _thin()
        c = ws.cell(row=5, column=col); c.value = WD_JA[wd]; c.font = _font(size=8); c.alignment = _align(); c.border = _thin()

    ws.merge_cells(f"{get_column_letter(total_col)}4:{get_column_letter(total_col)}5")
    c = ws.cell(row=4, column=total_col)
    c.value     = "合計\n時間"
    c.font      = _font(size=7)
    c.alignment = _align()
    c.border    = _thin()
    _apply_outer_border(ws, 4, 5, total_col, total_col)

    current_row = 6

    for staff_idx, s in enumerate(staff):
        max_sessions   = _max_sessions_for_staff_range(s, dates)
        session_rows   = per_block * max_sessions
        rows_per_staff = session_rows + (1 if show_note else 0)
        r        = current_row
        last_r   = r + rows_per_staff - 1
        note_row = r + session_rows
        row_bg   = C_ROW_ODD

        # ── Фиксированные колонки (№ / 職種・役職 / 部署 / 氏名) ──
        fixed_values = {
            "number":     s.sortOrder if s.sortOrder is not None else "",
            "position":   s.position or "",
            "department": "、".join(s.departments),
            "name":       s.userName,
        }
        for col_idx, (key, _, _) in enumerate(fixed, start=1):
            if key == "meta":
                continue
            _merge_v(ws, col_idx, r, last_r)
            c = ws.cell(row=r, column=col_idx)
            c.value = fixed_values[key]
            c.font = _font(bold=True, size=9) if key == "name" else _font(size=8, color="555555")
            c.fill = _fill(row_bg); c.alignment = _align(h="center"); c.border = _thin()
            _apply_outer_border(ws, r, last_r, col_idx, col_idx)

        # ── Метки строк ──
        for session_idx in range(max_sessions):
            block_r = r + session_idx * per_block
            for sub, key in enumerate(block_keys):
                c = ws.cell(row=block_r + sub, column=meta_col)
                c.value = block_labels[key]; c.font = _font(size=7, color="333333")
                c.fill = _fill(C_LABEL_BG); c.alignment = _align(); c.border = _thin()
                ws.row_dimensions[block_r + sub].height = 14
        if show_note:
            c = ws.cell(row=note_row, column=meta_col)
            c.value = "状況"; c.font = _font(size=7, color="333333")
            c.fill = _fill(C_LABEL_BG); c.alignment = _align(); c.border = _thin()
            ws.row_dimensions[note_row].height = 16

        total_work_minutes = 0
        for i, ds in enumerate(dates):
            col = first_day_col + i
            d = _day_data_range(s, ds)
            sessions = d.sessions or []

            # 合計 считается всегда, даже если строки 実働 скрыты
            for sess in sessions:
                _, _, work = _session_minutes(sess)
                if work is not None:
                    total_work_minutes += work

            # 状況 — заполняется и в дни без 打刻
            if show_note:
                c = ws.cell(row=note_row, column=col)
                c.value = d.note or ""
                c.font = _font(size=8, color="1E293B")
                c.fill = _fill("FFFFFF"); c.alignment = _align(); c.border = _thin()

            if session_rows == 0:
                continue

            if not sessions:
                # «―» объединяем только по блокам смен, строку 状況 не захватываем
                _merge_v(ws, col, r, r + session_rows - 1)
                c = ws.cell(row=r, column=col)
                c.value = "―"; c.font = _font(color=C_OFF_FG, size=10)
                c.fill = _fill(C_OFF_BG); c.alignment = _align(); c.border = _thin()
                _apply_outer_border(ws, r, r + session_rows - 1, col, col)
                continue

            for session_idx in range(max_sessions):
                block_r = r + session_idx * per_block
                sess = sessions[session_idx] if session_idx < len(sessions) else None

                if sess is None:
                    for sub in range(per_block):
                        c = ws.cell(row=block_r + sub, column=col)
                        c.value = ""; c.fill = _fill(row_bg)
                        c.alignment = _align(h="center", v="center"); c.border = _thin()
                        c.font = _font(size=9)
                    continue

                gross, brk, work = _session_minutes(sess)
                values = {
                    "in":    _parse_hm(sess.officialClockIn) or "",
                    "out":   _parse_hm(sess.officialClockOut) or "",
                    "gross": _fmt_hm(gross),
                    "break": _fmt_hm(brk),
                    "work":  _fmt_hm(work),
                }

                in_bg = out_bg = row_bg
                if show_colors:
                    if sess.officialClockIn:
                        in_bg = C_NOPLAN_BG if not sess.hasPlan else (C_LATE_BG if sess.lateIn else C_GREEN_BG)
                    if sess.officialClockOut:
                        out_bg = C_NOPLAN_BG if not sess.hasPlan else (C_YELLOW_BG if sess.earlyOut else C_GREEN_BG)
                bgs = {"in": in_bg, "out": out_bg}

                for sub, key in enumerate(block_keys):
                    c = ws.cell(row=block_r + sub, column=col)
                    c.value = values[key]
                    c.fill = _fill(bgs.get(key, row_bg))
                    c.alignment = _align(h="center", v="center"); c.border = _thin()
                    if key == "work":
                        c.font = _font(size=9, bold=True, color="0369A1")
                    elif key == "break":
                        c.font = _font(size=8, color="777777")
                    elif key == "gross":
                        c.font = _font(size=8, color="475569")
                    else:
                        c.font = _font(size=9)

        # ── 合計時間 ──
        _merge_v(ws, total_col, r, last_r)
        c = ws.cell(row=r, column=total_col)
        c.value = _fmt_hm(total_work_minutes); c.font = _font(bold=True, size=9)
        c.alignment = _align(); c.border = _thin()
        _apply_outer_border(ws, r, last_r, total_col, total_col)

        # ── Жирные линии: между сменами и вокруг сотрудника; над 状況 — тонкая ──
        thick = Side(style="medium", color="000000")
        no    = Side(style=None)
        is_first = staff_idx == 0
        for sub_row in range(r, last_r + 1):
            is_session_divider = (
                per_block > 0
                and sub_row < r + session_rows - 1
                and (sub_row - r + 1) % per_block == 0
            )
            for col_idx in range(1, last_day_col + 1):
                c = ws.cell(row=sub_row, column=col_idx)
                top    = thick if (sub_row == r and is_first) else no
                bottom = thick if (sub_row == last_r or is_session_divider) else no
                left   = thick if col_idx == 1 else no
                right  = thick if col_idx == last_day_col else no
                if any([top != no, bottom != no, left != no, right != no]):
                    existing = c.border
                    c.border = Border(
                        top=top if top != no else existing.top,
                        bottom=bottom if bottom != no else existing.bottom,
                        left=left if left != no else existing.left,
                        right=right if right != no else existing.right,
                    )

        current_row += rows_per_staff

    last_data_row = current_row - 1
    thick = Side(style="medium", color="000000")
    no    = Side(style=None)
    for row in range(4, last_data_row + 1):
        for col in range(1, total_col + 1):
            c = ws.cell(row=row, column=col)
            top    = thick if row == 4 else no
            bottom = thick if row == last_data_row else no
            left   = thick if col == 1 else no
            right  = thick if col == total_col else no
            if any([top, bottom, left, right]):
                existing = c.border
                c.border = Border(
                    top=top if top != no else existing.top,
                    bottom=bottom if bottom != no else existing.bottom,
                    left=left if left != no else existing.left,
                    right=right if right != no else existing.right,
                )

    ws.freeze_panes = f"{get_column_letter(first_day_col)}6"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.paperSize   = 9
    ws.page_setup.fitToPage   = True
    ws.page_setup.fitToWidth  = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins = PageMargins(left=0.25, right=0.25, top=0.75, bottom=0.75, header=0.3, footer=0.3)
    ws.page_setup.copies = 1

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()