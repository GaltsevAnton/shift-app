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


class ReportRequest(BaseModel):
    ym: str                        # "2026-05"
    hotelName: str = "ホテル・ヘリテイジ飯能sta．"
    department: Optional[str] = None   # для отчёта по отделу
    staff: list[StaffModel] = []