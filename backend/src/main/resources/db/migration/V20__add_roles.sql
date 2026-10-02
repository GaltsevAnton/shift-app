CREATE TABLE roles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (restaurant_id, name)
);

CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission VARCHAR(50) NOT NULL,
    PRIMARY KEY (role_id, permission)
);

ALTER TABLE users ADD COLUMN custom_role_id BIGINT REFERENCES roles(id) ON DELETE SET NULL;

-- 既存レストランごとに「フルアクセス」ロールを作成し、既存のMANAGERを全員割り当てる
-- （これがないと、このマイグレーション適用直後に既存マネージャー全員がロール未設定で
--   何もできなくなってしまう — 後方互換のための必須ステップ）
DO $$
DECLARE
    r RECORD;
    new_role_id BIGINT;
BEGIN
    FOR r IN SELECT DISTINCT restaurant_id FROM users WHERE role = 'MANAGER' LOOP
        INSERT INTO roles (restaurant_id, name) VALUES (r.restaurant_id, 'フルアクセス')
        RETURNING id INTO new_role_id;

        INSERT INTO role_permissions (role_id, permission)
        SELECT new_role_id, p FROM unnest(ARRAY[
            'SHIFT_VIEW',
            'ATTENDANCE_VIEW','ATTENDANCE_EDIT','ATTENDANCE_DELETE',
            'EMPLOYEE_VIEW','EMPLOYEE_CREATE','EMPLOYEE_EDIT','EMPLOYEE_DELETE',
            'WORKPLACE_VIEW','WORKPLACE_CREATE','WORKPLACE_EDIT','WORKPLACE_DELETE',
            'POSITION_VIEW','POSITION_CREATE','POSITION_EDIT','POSITION_DELETE',
            'DEPARTMENT_VIEW','DEPARTMENT_CREATE','DEPARTMENT_EDIT','DEPARTMENT_DELETE',
            'BREAK_RULE_VIEW','BREAK_RULE_CREATE','BREAK_RULE_EDIT','BREAK_RULE_DELETE',
            'NOTIFICATION_VIEW','NOTIFICATION_EDIT',
            'LOGGING_VIEW'
        ]) AS p;

        UPDATE users SET custom_role_id = new_role_id
        WHERE restaurant_id = r.restaurant_id AND role = 'MANAGER';
    END LOOP;
END $$;