-- Restaurants
create table restaurants (
  id bigserial primary key,
  name varchar(200) not null,
  timezone varchar(64) not null default 'Asia/Tokyo',
  created_at timestamptz not null default now()
);

-- Users
create table users (
  id bigserial primary key,
  restaurant_id bigint not null references restaurants(id),
  login varchar(100) not null,
  password_hash varchar(255) not null,
  role varchar(30) not null, -- STAFF, MANAGER, ADMIN
  full_name varchar(200) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (login)
);

-- Preferences (employee wishes)
create table preferences (
  id bigserial primary key,
  restaurant_id bigint not null references restaurants(id),
  user_id bigint not null references users(id),
  work_date date not null,
  start_time time not null,
  end_time time not null,
  status varchar(30) not null, -- DRAFT, SUBMITTED, APPROVED, REJECTED
  comment varchar(500),
  created_at timestamptz not null default now()
);

create index idx_preferences_rest_date on preferences(restaurant_id, work_date);
create index idx_preferences_user_date on preferences(user_id, work_date);

-- Shifts (approved schedule)
create table shifts (
  id bigserial primary key,
  restaurant_id bigint not null references restaurants(id),
  user_id bigint not null references users(id),
  work_date date not null,
  start_time time not null,
  end_time time not null,
  break_minutes int not null default 0,
  status varchar(30) not null, -- PLANNED, PUBLISHED, CANCELLED
  created_by bigint references users(id),
  updated_at timestamptz not null default now()
);

create index idx_shifts_rest_date on shifts(restaurant_id, work_date);
create index idx_shifts_user_date on shifts(user_id, work_date);

-- Audit log (минимальный)
create table audit_log (
  id bigserial primary key,
  restaurant_id bigint not null references restaurants(id),
  actor_user_id bigint references users(id),
  entity_type varchar(50) not null,
  entity_id bigint not null,
  action varchar(20) not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_rest_created on audit_log(restaurant_id, created_at desc);
