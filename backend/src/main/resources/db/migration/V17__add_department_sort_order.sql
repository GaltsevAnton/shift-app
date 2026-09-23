ALTER TABLE departments ADD COLUMN sort_order INT NOT NULL DEFAULT 0;

UPDATE departments SET sort_order = id;