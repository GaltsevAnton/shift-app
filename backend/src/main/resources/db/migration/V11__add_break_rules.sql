CREATE TABLE break_rules (
    id            BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    name          VARCHAR(100) NOT NULL,
    threshold_minutes INT NOT NULL,
    break_minutes     INT NOT NULL
);