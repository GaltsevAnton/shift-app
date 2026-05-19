-- V5: Оптимистичная блокировка для предотвращения конфликтов при одновременном редактировании

ALTER TABLE preferences ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;