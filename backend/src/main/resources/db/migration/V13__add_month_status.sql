CREATE TABLE month_status (
    id            BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    year_month    VARCHAR(7) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'RECEIVING',
    updated_by    BIGINT REFERENCES users(id),
    updated_at    TIMESTAMP,
    UNIQUE(restaurant_id, year_month)
);