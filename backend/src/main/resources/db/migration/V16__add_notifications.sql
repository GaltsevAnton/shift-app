CREATE TABLE notification_preferences (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id            BIGINT NOT NULL,
    notification_type  VARCHAR(50) NOT NULL,
    enabled            BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (user_id, notification_type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE notification_settings (
    id                            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id                 BIGINT NOT NULL UNIQUE,
    forgot_clockout_check_time    TIME NOT NULL DEFAULT '00:00:00',
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);