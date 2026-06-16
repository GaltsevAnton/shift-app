-- V9: Профиль сотрудника — имя/фамилия раздельно, адрес, дата рождения, пол, email, телефон

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name        VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name       VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name_kana   VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name_kana  VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email            VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone            VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code      VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS region           VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS municipality     VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS block_number     VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS building         VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date       DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender           VARCHAR(10) CHECK (gender IN ('MALE', 'FEMALE'));