-- One shift per user per date (per restaurant)
alter table shifts
add constraint uq_shifts_rest_user_date unique (restaurant_id, user_id, work_date);
