-- V2: Слоты смен вместо полей в preferences

CREATE SEQUENCE IF NOT EXISTS shift_slots_id_seq;

CREATE TABLE IF NOT EXISTS shift_slots (
    id            BIGINT PRIMARY KEY DEFAULT nextval('shift_slots_id_seq'),
    preference_id BIGINT      NOT NULL REFERENCES preferences(id) ON DELETE CASCADE,
    slot_order    INTEGER     NOT NULL DEFAULT 0,
    start_time    TIME,
    end_time      TIME,
    is_last       BOOLEAN     NOT NULL DEFAULT FALSE,
    workplace     VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_shift_slots_preference_id ON shift_slots(preference_id);