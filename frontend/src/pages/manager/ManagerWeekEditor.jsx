import { useState, useEffect, useCallback } from "react";
import { api } from "../../../shared/api/api";
import styles from "./ManagerWeekEditor.module.css";

const WEEK_STATUS_LABELS = {
  RECEIVING: { ja: "受付中", color: "#4ade80", next: "DRAFTING", nextLabel: "作成中へ →" },
  DRAFTING:  { ja: "作成中", color: "#facc15", next: "CONFIRMED", nextLabel: "確定する →", prev: "RECEIVING", prevLabel: "← 受付中に戻す" },
  CONFIRMED: { ja: "確定",   color: "#60a5fa", prev: "DRAFTING",  prevLabel: "← 作成中に戻す" },
};

function getDaysOfWeek(weekStart) {
  const days = [];
  const start = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function formatDayHeader(dateStr) {
  const d = new Date(dateStr);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const wd = weekdays[d.getDay()];
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  return { label: `${d.getDate()}(${wd})`, isWeekend };
}

function TimeInput({ value, onChange, disabled }) {
  return (
    <input
      className={styles.timeInput}
      type="time"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
}

function DayCell({ day, onChange, disabled }) {
  const handleOffToggle = () => {
    onChange({ ...day, off: !day.off });
  };
  return (
    <td className={`${styles.dayCell} ${day.off ? styles.dayCellOff : ""}`}>
      <div className={styles.dayCellInner}>
        <label className={styles.offToggle}>
          <input
            type="checkbox"
            checked={!!day.off}
            onChange={handleOffToggle}
            disabled={disabled}
          />
          <span className={styles.offLabel}>休</span>
        </label>
        {!day.off && (
          <div className={styles.timeRange}>
            <TimeInput
              value={day.startTime}
              onChange={(v) => onChange({ ...day, startTime: v })}
              disabled={disabled}
            />
            <span className={styles.timeSep}>–</span>
            <TimeInput
              value={day.endTime}
              onChange={(v) => onChange({ ...day, endTime: v })}
              disabled={disabled}
            />
          </div>
        )}
      </div>
    </td>
  );
}

export default function ManagerWeekEditor({ weekStart, onClose }) {
  const [weekData, setWeekData] = useState(null); // { status, staff: [{userId, userName, days}] }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState({}); // { userId: true }
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState(null);

  const days = getDaysOfWeek(weekStart);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.managerWeek(weekStart);
      // data: { status, staff: [{userId, userName, days: [{date, off, startTime, endTime}]}] }
      setWeekData(data);
    } catch (e) {
      setError("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const handleDayChange = (userId, dateStr, newDay) => {
    setWeekData((prev) => ({
      ...prev,
      staff: prev.staff.map((row) =>
        row.userId === userId
          ? {
              ...row,
              days: row.days.map((d) => (d.date === dateStr ? newDay : d)),
            }
          : row
      ),
    }));
    setDirty((prev) => ({ ...prev, [userId]: true }));
  };

  const saveRow = async (userId) => {
    const row = weekData.staff.find((r) => r.userId === userId);
    if (!row) return;
    setSaving(true);
    try {
      await api.managerStaffWeekSave(userId, weekStart, row.days);
      setDirty((prev) => { const n = { ...prev }; delete n[userId]; return n; });
    } catch (e) {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const userId of Object.keys(dirty)) {
        const row = weekData.staff.find((r) => String(r.userId) === String(userId));
        if (row) await api.managerStaffWeekSave(userId, weekStart, row.days);
      }
      setDirty({});
    } catch (e) {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (newStatus) => {
    setStatusLoading(true);
    try {
      await api.setWeekStatus(weekStart, newStatus);
      setWeekData((prev) => ({ ...prev, status: newStatus }));
    } catch (e) {
      alert("ステータスの変更に失敗しました");
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) return <div className={styles.loading}>読み込み中...</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!weekData) return null;

  const status = weekData.status || "RECEIVING";
  const statusInfo = WEEK_STATUS_LABELS[status] || WEEK_STATUS_LABELS.RECEIVING;
  const hasDirty = Object.keys(dirty).length > 0;

  return (
    <div className={styles.container}>
      {/* Header bar */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={onClose}>← 戻る</button>
          <span className={styles.weekLabel}>
            {weekStart} 〜 {days[6]}
          </span>
        </div>
        <div className={styles.headerRight}>
          {/* Status badge + transition buttons */}
          <div className={styles.statusArea}>
            {statusInfo.prev && (
              <button
                className={`${styles.statusBtn} ${styles.statusBtnSecondary}`}
                onClick={() => changeStatus(statusInfo.prev)}
                disabled={statusLoading}
              >
                {statusInfo.prevLabel}
              </button>
            )}
            <span className={styles.statusBadge} style={{ background: statusInfo.color }}>
              {statusInfo.ja}
            </span>
            {statusInfo.next && (
              <button
                className={`${styles.statusBtn} ${styles.statusBtnPrimary}`}
                onClick={() => changeStatus(statusInfo.next)}
                disabled={statusLoading}
              >
                {statusInfo.nextLabel}
              </button>
            )}
          </div>

          {hasDirty && (
            <button
              className={styles.saveAllBtn}
              onClick={saveAll}
              disabled={saving}
            >
              {saving ? "保存中..." : `💾 まとめて保存 (${Object.keys(dirty).length}名)`}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.nameCol}>スタッフ</th>
              {days.map((d) => {
                const { label, isWeekend } = formatDayHeader(d);
                return (
                  <th
                    key={d}
                    className={`${styles.dayCol} ${isWeekend ? styles.dayColWeekend : ""}`}
                  >
                    {label}
                  </th>
                );
              })}
              <th className={styles.actionCol}></th>
            </tr>
          </thead>
          <tbody>
            {weekData.staff.map((row) => {
              const isDirty = !!dirty[row.userId];
              // Ensure days array is aligned with weekdays
              const dayMap = {};
              (row.days || []).forEach((d) => { dayMap[d.date] = d; });
              const alignedDays = days.map((d) => dayMap[d] || { date: d, off: false, startTime: "", endTime: "" });

              return (
                <tr key={row.userId} className={`${styles.staffRow} ${isDirty ? styles.staffRowDirty : ""}`}>
                  <td className={styles.nameCell}>
                    <span className={styles.staffName}>{row.userName}</span>
                    {isDirty && <span className={styles.dirtyDot} title="未保存の変更">●</span>}
                  </td>
                  {alignedDays.map((day) => (
                    <DayCell
                      key={day.date}
                      day={day}
                      onChange={(newDay) => handleDayChange(row.userId, day.date, newDay)}
                      disabled={saving}
                    />
                  ))}
                  <td className={styles.actionCell}>
                    {isDirty && (
                      <button
                        className={styles.saveRowBtn}
                        onClick={() => saveRow(row.userId)}
                        disabled={saving}
                        title="この行を保存"
                      >
                        保存
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {weekData.staff.length === 0 && (
              <tr>
                <td colSpan={days.length + 2} className={styles.emptyRow}>
                  スタッフが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}