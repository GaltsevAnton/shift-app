import { useEffect, useMemo, useState } from "react";
import { api } from "../../../shared/api/api";
import styles from "./ManagerTable.module.css";

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

const JP_WD = ["日", "月", "火", "水", "木", "金", "土"];

function fmtWithDow(d) {
  const ymd = fmt(d);
  const wd = JP_WD[d.getDay()];
  return `${ymd} (${wd})`;
}

function isWeekend(d) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function isToday(d) {
  const t = new Date();
  return fmt(d) === fmt(t);
}

function displayShift(sh) {
  if (!sh?.startTime || !sh?.endTime) return "—";
  const br = Number(sh.breakMinutes || 0);
  return br > 0 ? `${sh.startTime}–${sh.endTime} (break ${br})` : `${sh.startTime}–${sh.endTime}`;
}

function startOfWeekMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun ... 1 Mon
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export default function ManagerTable({ onLogout }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [users, setUsers] = useState([]);
  const [shiftsMap, setShiftsMap] = useState(new Map()); // key: userId|date => shift
  const [dirty, setDirty] = useState(new Set()); // keys changed
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [mode, setMode] = useState("TABLE"); // "TABLE" | "CHANGE"
  const editable = mode === "CHANGE";

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = fmt(days[0]);
  const to = fmt(days[6]);

  function keyOf(userId, dateStr) {
    return `${userId}|${dateStr}`;
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const [u, s] = await Promise.all([api.managerUsers(), api.managerShifts(from, to)]);
      setUsers(u);

      const m = new Map();
      for (const sh of s) m.set(keyOf(sh.userId, sh.workDate), sh);
      setShiftsMap(m);
      setDirty(new Set());
    } catch (e) {
      setMsg(`Load error: ${e.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  function updateCell(userId, dateStr, patch) {
    const k = keyOf(userId, dateStr);
    const prev = shiftsMap.get(k);

    const next = {
      id: prev?.id ?? null,
      userId,
      userName: prev?.userName ?? users.find((x) => x.id === userId)?.fullName ?? "",
      workDate: dateStr,
      startTime: prev?.startTime ?? "",
      endTime: prev?.endTime ?? "",
      breakMinutes: prev?.breakMinutes ?? 0,
      status: prev?.status ?? "PLANNED",
      ...patch,
    };

    const newMap = new Map(shiftsMap);
    newMap.set(k, next);
    setShiftsMap(newMap);

    const newDirty = new Set(dirty);
    newDirty.add(k);
    setDirty(newDirty);
  }

  function clearCell(userId, dateStr) {
    const k = keyOf(userId, dateStr);
    const newMap = new Map(shiftsMap);
    newMap.delete(k);
    setShiftsMap(newMap);

    const newDirty = new Set(dirty);
    newDirty.add(k);
    setDirty(newDirty);
  }

  async function save() {
    setMsg(null);
    try {
      const payload = [];
      for (const k of dirty) {
        const sh = shiftsMap.get(k);
        if (!sh) continue;
        if (!sh.startTime || !sh.endTime) continue;

        payload.push({
          userId: sh.userId,
          workDate: sh.workDate,
          startTime: sh.startTime,
          endTime: sh.endTime,
          breakMinutes: Number(sh.breakMinutes || 0),
        });
      }

      if (payload.length === 0) {
        setMsg("Nothing to save");
        return;
      }

      await api.bulkShifts(payload);
      setMsg(`Saved: ${payload.length}`);
      await load();
    } catch (e) {
      setMsg(`Save error: ${e.message || String(e)}`);
    }
  }

  async function copyWeek() {
    setMsg(null);
    try {
      const src = fmt(days[0]);
      const dst = fmt(addDays(days[0], 7));
      const overwrite = true;

      const res = await api.copyWeek(src, dst, overwrite);
      setMsg(String(res));
      await load();
    } catch (e) {
      setMsg(`Copy error: ${e.message || String(e)}`);
    }
  }

  const msgTone =
    !msg ? "" : msg.toLowerCase().includes("error") ? styles.msgErr : styles.msgOk;

  return (
    <div className={styles.root}>
      <div className={styles.topRow}>
        <div className={styles.tabs}>
          <button
            type="button"
            onClick={() => setMode("TABLE")}
            className={`${styles.tab} ${mode === "TABLE" ? styles.tabActive : ""}`}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => setMode("CHANGE")}
            className={`${styles.tab} ${mode === "CHANGE" ? styles.tabActive : ""}`}
          >
            Change
          </button>
        </div>

        <div className={styles.actions}>
          <button className={styles.btn} onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ◀ Prev
          </button>
          <button className={styles.btn} onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>
            This week
          </button>
          <button className={styles.btn} onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Next ▶
          </button>
          <button className={styles.btn} onClick={copyWeek}>
            Copy to next week
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={save} disabled={!editable || dirty.size === 0}>
            Save
          </button>
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className={styles.meta}>
        Week: <b>{from}</b> ~ <b>{to}</b> <span className={styles.sep}>|</span> Dirty: <b>{dirty.size}</b>
        {editable ? <span className={styles.editOn}>EDIT</span> : <span className={styles.editOff}>VIEW</span>}
      </div>

      {msg && <div className={`${styles.msg} ${msgTone}`}>{msg}</div>}

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.stickyLeft}`}>Staff</th>
              {days.map((d) => (
                <th
                  key={fmt(d)}
                  className={[
                    styles.th,
                    isWeekend(d) ? styles.weekendTh : "",
                    isToday(d) ? styles.todayTh : "",
                  ].join(" ")}
                >
                  {fmtWithDow(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={styles.rowHover}>
                <td className={`${styles.td} ${styles.stickyLeft} ${styles.staffCell}`}>
                  {u.fullName}
                </td>

                {days.map((d) => {
                  const dateStr = fmt(d);
                  const k = keyOf(u.id, dateStr);
                  const sh = shiftsMap.get(k);

                  return (
                    <td
                      key={k}
                      className={[
                        styles.td,
                        isWeekend(d) ? styles.weekendTd : "",
                        isToday(d) ? styles.todayTd : "",
                      ].join(" ")}
                    >
                      {editable ? (
                        <div className={styles.cell}>
                          <div className={styles.timeLine}>
                            <input
                              type="time"
                              value={sh?.startTime ?? ""}
                              onChange={(e) => updateCell(u.id, dateStr, { startTime: e.target.value })}
                              className={styles.timeInput}
                              disabled={!editable}
                            />
                            <input
                              type="time"
                              value={sh?.endTime ?? ""}
                              onChange={(e) => updateCell(u.id, dateStr, { endTime: e.target.value })}
                              className={styles.timeInput}
                              disabled={!editable}
                            />
                          </div>

                          <div className={styles.breakLine}>
                            <span className={styles.breakLabel}>break</span>
                            <input
                              type="number"
                              min="0"
                              value={sh?.breakMinutes ?? 0}
                              onChange={(e) => updateCell(u.id, dateStr, { breakMinutes: e.target.value })}
                              className={styles.breakInput}
                              disabled={!editable}
                            />
                            <button
                              className={styles.clearBtn}
                              onClick={() => clearCell(u.id, dateStr)}
                              disabled={!editable}
                              title="Clear (not delete)"
                              type="button"
                            >
                              Clear
                            </button>
                          </div>

                          {dirty.has(k) && <div className={styles.edited}>edited</div>}
                        </div>
                      ) : (
                        <div className={styles.viewCell}>
                          <div className={styles.viewTime}>{displayShift(sh)}</div>
                          {dirty.has(k) && <div className={styles.edited}>edited</div>}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}

      <div className={styles.note}>
        Note: “Clear” сейчас просто убирает из UI. Удаление смены (DELETE) добавим отдельным endpoint’ом позже.
      </div>
    </div>
  );
}
