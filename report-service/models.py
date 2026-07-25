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
    clockIn: Optional[str] = None
    clockOut: Optional[str] = None
    breakStart: Optional[str] = None
    breakEnd: Optional[str] = None
    breakMinutes: Optional[int] = None   # гибрид: факт, либо авто по 休憩ルール
    workMinutes: Optional[int] = None    # 実働 = (退勤-出勤) - breakMinutes


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

class SessionModel(BaseModel):
    userId: int
    userName: str
    workDate: str
    clockIn: Optional[str] = None
    clockOut: Optional[str] = None
    breakStart: Optional[str] = None
    breakEnd: Optional[str] = None
    shiftStart: Optional[str] = None
    shiftEnd: Optional[str] = None

class AttendanceSessionsRequest(BaseModel):
    hotelName: str = "ホテル・ヘリテイジ飯能sta．"
    fromDate: str
    toDate: str
    sessions: list[SessionModel] = []
class ReportRequest(BaseModel):
    ym: str                        # "2026-05"
    hotelName: str = "ホテル・ヘリテイジ飯能sta．"
    department: Optional[str] = None   # для отчёта по отделу
    staff: list[StaffModel] = []