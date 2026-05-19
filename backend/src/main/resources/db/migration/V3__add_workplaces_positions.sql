-- V3: Справочники — рабочие места и должности

CREATE SEQUENCE IF NOT EXISTS workplaces_id_seq;
CREATE TABLE IF NOT EXISTS workplaces (
    id            BIGINT PRIMARY KEY DEFAULT nextval('workplaces_id_seq'),
    restaurant_id BIGINT       NOT NULL REFERENCES restaurants(id),
    name          VARCHAR(100) NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS positions_id_seq;
CREATE TABLE IF NOT EXISTS positions (
    id            BIGINT PRIMARY KEY DEFAULT nextval('positions_id_seq'),
    restaurant_id BIGINT       NOT NULL REFERENCES restaurants(id),
    name          VARCHAR(100) NOT NULL
);

-- Должность сотрудника (строка из справочника)
ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(100);