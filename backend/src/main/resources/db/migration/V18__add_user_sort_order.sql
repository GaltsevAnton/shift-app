ALTER TABLE users ADD COLUMN sort_order INT;

-- id глобально уникален по всей таблице users, поэтому безопасно как начальное значение
-- (не создаст конфликтов с уникальностью в рамках restaurant_id)
UPDATE users SET sort_order = id;

ALTER TABLE users ALTER COLUMN sort_order SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT uq_users_restaurant_sort_order UNIQUE (restaurant_id, sort_order);