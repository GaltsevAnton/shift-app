ALTER TABLE month_status ADD COLUMN half INT NOT NULL DEFAULT 1;
ALTER TABLE month_status DROP CONSTRAINT month_status_restaurant_id_year_month_key;
ALTER TABLE month_status ADD CONSTRAINT month_status_unique UNIQUE(restaurant_id, year_month, half);