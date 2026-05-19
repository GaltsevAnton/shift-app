-- V4: Отделы и связь many-to-many с сотрудниками

CREATE SEQUENCE IF NOT EXISTS departments_id_seq;
CREATE TABLE IF NOT EXISTS departments (
    id            BIGINT PRIMARY KEY DEFAULT nextval('departments_id_seq'),
    restaurant_id BIGINT       NOT NULL REFERENCES restaurants(id),
    name          VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_departments (
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, department_id)
);

-- Удаляем старое строковое поле если было
ALTER TABLE users DROP COLUMN IF EXISTS department;