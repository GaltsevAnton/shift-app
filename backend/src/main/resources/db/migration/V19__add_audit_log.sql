CREATE TABLE audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(200) NOT NULL,
    action VARCHAR(20) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id BIGINT,
    target_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    target_user_name VARCHAR(200),
    summary TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_restaurant_created ON audit_log (restaurant_id, created_at DESC);
CREATE INDEX idx_audit_log_target_user ON audit_log (target_user_id);
CREATE INDEX idx_audit_log_entity_type ON audit_log (entity_type);