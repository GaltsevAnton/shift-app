-- 勤務状況リスト（справочник）
CREATE TABLE attendance_statuses (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT       NOT NULL REFERENCES restaurants(id),
    name          VARCHAR(100) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_attendance_statuses_rest_name
    ON attendance_statuses (restaurant_id, lower(name));

-- Пометки в 勤怠管理: одна на сотрудника в день.
-- label — копия названия на момент выбора (остаётся при переименовании/удалении пункта)
CREATE TABLE attendance_day_notes (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT       NOT NULL REFERENCES restaurants(id),
    user_id       BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_date     DATE         NOT NULL,
    status_id     BIGINT       REFERENCES attendance_statuses(id) ON DELETE SET NULL,
    label         VARCHAR(100) NOT NULL,
    updated_by    BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ux_attendance_day_notes_user_date UNIQUE (user_id, work_date)
);
CREATE INDEX ix_attendance_day_notes_rest_date
    ON attendance_day_notes (restaurant_id, work_date);

-- Начальные пункты для каждого ресторана
INSERT INTO attendance_statuses (restaurant_id, name)
SELECT r.id, v.name
FROM restaurants r
CROSS JOIN (VALUES (1, '日時調整'), (2, '有給'), (3, '欠勤'), (4, 'その他')) AS v(ord, name)
ORDER BY r.id, v.ord;

-- Новые права — роли «フルアクセス»
INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p.perm
FROM roles r
CROSS JOIN (VALUES ('ATTENDANCE_STATUS_VIEW'), ('ATTENDANCE_STATUS_CREATE'),
                   ('ATTENDANCE_STATUS_EDIT'), ('ATTENDANCE_STATUS_DELETE')) AS p(perm)
WHERE r.name = 'フルアクセス'
ON CONFLICT DO NOTHING;