from pydantic import BaseModel
from typing import Optional


class SlotModel(BaseModel):
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    last: bool = False
    workplace: Optional[str] = None


class DayModel(BaseModel):
    date: str          # "2026-05-01"
    off: bool = False
    slots: list[SlotModel] = []


class StaffModel(BaseModel):
    userId: int
    userName: str
    position: Optional[str] = None
    departments: list[str] = []
    days: list[DayModel] = []

class DaySessionModel(BaseModel):
    # факт (сырые пробивки) — используется в 打刻一覧
    clockIn: Optional[str] = None
    clockOut: Optional[str] = None
    breakStart: Optional[str] = None
    breakEnd: Optional[str] = None
    # официальные значения (округление по плану 出勤/退勤/休憩) — используется в 勤怠集計表（実績）
    hasPlan: bool = False
    officialClockIn: Optional[str] = None
    officialClockOut: Optional[str] = None
    officialBreakMinutes: Optional[int] = None
    workMinutes: Optional[int] = None
    lateIn: bool = False
    earlyOut: bool = False

class AttendanceDayModel(BaseModel):
    date: str                       # "2026-05-01"
    sessions: list[DaySessionModel] = []   # несколько смен в день — несколько элементов
    hasShift: bool = False
    shiftStart: Optional[str] = None   # "09:00" — из плановой смены, для сравнения
    shiftEnd: Optional[str] = None

class AttendanceStaffModel(BaseModel):
    userId: int
    userName: str
    position: Optional[str] = None
    departments: list[str] = []
    days: list[AttendanceDayModel] = []


class AttendanceReportRequest(BaseModel):
    ym: str
    hotelName: str = "ホテル・ヘリテイジ飯能sta．"
    staff: list[AttendanceStaffModel] = []
    
class AttendanceReportRangeRequest(BaseModel):
    hotelName: str = "ホテル・ヘリテイジ飯能sta．"
    fromDate: str                       # "2026-08-01"
    toDate: str                         # "2026-08-23"
    staff: list[AttendanceStaffModel] = []

class SessionModel(BaseModel):
    userId: int
    userName: str
    workDate: str
    # факт (сырые пробивки)
    clockIn: Optional[str] = None
    clockOut: Optional[str] = None
    breakStart: Optional[str] = None
    breakEnd: Optional[str] = None
    # план (сырые значения слота, без округления)
    scheduledClockIn: Optional[str] = None
    scheduledClockOut: Optional[str] = None
    scheduledBreakMinutes: Optional[int] = None
    nextDay: bool = False   # 退勤予定が翌日にまたがるスロットか（退勤日付（予定）の計算に使用）
    # официальные (округлённые по плану) значения — только для 勤務時間
    hasPlan: bool = False
    officialClockIn: Optional[str] = None
    officialClockOut: Optional[str] = None
    officialBreakMinutes: Optional[int] = None
    workMinutes: Optional[int] = None
    lateIn: bool = False
    earlyOut: bool = False
    # 残業時間 = (実際の正味労働時間) − (予定の正味労働時間)。予定がない/未退勤なら null
    overtimeMinutes: Optional[int] = None

class AttendanceSessionsRequest(BaseModel):
    hotelName: str = "ホテル・ヘリテイジ飯能sta．"
    fromDate: str
    toDate: str
    sessions: list[SessionModel] = []
    visibleColumns: list[str] = []   # 空 = 全列表示。画面の表示列トグルと同じキー
class BreakRuleModel(BaseModel):
    thresholdMinutes: int
    breakMinutes: int

class ReportRequest(BaseModel):
    ym: str                        # "2026-05"
    hotelName: str = "ホテル・ヘリテイジ飯能sta．"
    department: Optional[str] = None   # для отчёта по отделу
    staff: list[StaffModel] = []
    breakRules: list[BreakRuleModel] = []

class ReportRangeRequest(BaseModel):
    fromDate: str                       # "2026-08-01"
    toDate: str                         # "2026-08-23"
    hotelName: str = "ホテル・ヘリテイジ飯能sta．"
    department: Optional[str] = None
    staff: list[StaffModel] = []
    breakRules: list[BreakRuleModel] = []