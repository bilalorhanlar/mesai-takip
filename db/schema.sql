-- =====================================================================
-- Iron Lounge — Mesai Takip  ·  PostgreSQL şeması
-- Backend yok: tüm iş mantığı bu SQL fonksiyonlarında.
-- Frontend, PostgREST üzerinden yalnızca bu fonksiyonları çağırır.
-- Tablolar dışarıya tamamen kapalıdır (RLS açık + yetki yok).
--
-- Kurulum: psql "$DATABASE_URL" -f db/schema.sql
-- Admin şifresi yoktur. Kurulumdan sonra veritabanında (psql) bir kez çalıştırın:
--   select set_admin_password('güçlü-bir-şifre');
-- Dosya tekrar çalıştırılabilir (veriler silinmez, eski sürümden otomatik taşınır).
-- =====================================================================

create extension if not exists pgcrypto;

-- PostgREST rolleri: anon (internetten gelen her istek bu rolle çalışır).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

-- ---------------------------------------------------------------------
-- Tablolar
-- ---------------------------------------------------------------------
create table if not exists settings (
  id             int primary key default 1 check (id = 1),
  admin_password text,
  lat            double precision not null,
  lng            double precision not null,
  radius         int not null default 50
);
-- Şifre boş başlar (bilinen bir varsayılan şifre yok); set_admin_password ile veritabanından belirlenir
alter table settings alter column admin_password drop not null;
insert into settings (id, admin_password, lat, lng, radius)
values (1, null, 41.018374, 29.089090, 50)
on conflict (id) do nothing;

-- Vardiya tanımları (istenildiği kadar)
create table if not exists shifts (
  id          bigserial primary key,
  name        text not null,
  start_time  time not null,
  end_time    time not null,
  deleted     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists staff (
  id          bigserial primary key,
  name        text not null,
  code        text,
  deleted     boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index if not exists staff_code_active on staff (code) where not deleted;
-- Haftalık izin günleri (ISO: 1=Pazartesi … 7=Pazar)
alter table staff add column if not exists off_days int[] not null default '{}';
-- Varsayılan vardiya ve saatlik ücret
alter table staff add column if not exists shift_id bigint references shifts (id);
alter table staff add column if not exists hourly_rate numeric(10, 2) not null default 0;

-- Belirli bir gün için vardiya değişikliği (varsayılan vardiyanın yerine geçer)
create table if not exists shift_days (
  staff_id bigint not null references staff (id),
  day      date not null,
  shift_id bigint not null references shifts (id),
  primary key (staff_id, day)
);

-- Tarih bazlı izinler (yıllık izin, rapor vb.)
create table if not exists leaves (
  staff_id bigint not null references staff (id),
  day      date not null,
  primary key (staff_id, day)
);

create table if not exists records (
  id        bigserial primary key,
  staff_id  bigint not null references staff (id),
  check_in  timestamptz not null default now(),
  check_out timestamptz,
  lat       double precision,
  lng       double precision,
  accuracy  double precision,
  distance  int,
  late      int not null default 0,
  manual    boolean not null default false
);
-- Kayıt anındaki vardiya ve ücret saklanır: sonradan değişse de geçmiş bozulmaz
alter table records add column if not exists shift_id    bigint references shifts (id);
alter table records add column if not exists shift_name  text;
alter table records add column if not exists shift_start time;
alter table records add column if not exists shift_end   time;
alter table records add column if not exists hourly_rate numeric(10, 2) not null default 0;
alter table records add column if not exists edited      boolean not null default false;
create index if not exists records_check_in on records (check_in desc);
create index if not exists records_staff on records (staff_id, check_in);
-- Bir personelin aynı anda tek açık mesaisi olabilir
create unique index if not exists records_one_open on records (staff_id) where check_out is null;

create table if not exists admin_sessions (
  token      text primary key,
  expires_at timestamptz not null
);

create table if not exists failed_attempts (
  key text not null,
  at  timestamptz not null default now()
);
create index if not exists failed_attempts_key on failed_attempts (key, at);

-- Eski sürümden taşıma: personel üzerindeki sabit vardiya saatleri -> vardiya tablosu
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'staff' and column_name = 'shift_start') then
    insert into shifts (name, start_time, end_time)
    select distinct to_char(shift_start, 'HH24:MI') || '–' || to_char(shift_end, 'HH24:MI'), shift_start, shift_end
    from staff s
    where not exists (select 1 from shifts x where x.start_time = s.shift_start and x.end_time = s.shift_end and not x.deleted);

    update staff s set shift_id = x.id from shifts x
    where s.shift_id is null and x.start_time = s.shift_start and x.end_time = s.shift_end and not x.deleted;

    update records r set shift_id = s.shift_id, shift_name = x.name, shift_start = x.start_time, shift_end = x.end_time
    from staff s join shifts x on x.id = s.shift_id
    where r.staff_id = s.id and r.shift_start is null;

    alter table staff drop column shift_start;
    alter table staff drop column shift_end;
  end if;
end $$;

-- Hiç vardiya yoksa bir tane hazır olsun
insert into shifts (name, start_time, end_time)
select 'Gündüz', '09:00', '18:00' where not exists (select 1 from shifts);

-- Tablolar dışarıya kapalı: sadece aşağıdaki fonksiyonlar erişir
alter table settings        enable row level security;
alter table shifts          enable row level security;
alter table staff           enable row level security;
alter table shift_days      enable row level security;
alter table records         enable row level security;
alter table admin_sessions  enable row level security;
alter table failed_attempts enable row level security;
alter table leaves          enable row level security;
revoke all on settings, shifts, staff, shift_days, records, admin_sessions, failed_attempts, leaves from public, anon, authenticated;

-- Eski sürüm fonksiyonları (imzası değişenler)
drop function if exists admin_add_staff(text, text, time, time);
drop function if exists admin_add_staff(text, text, time, time, int[]);
drop function if exists admin_update_staff(text, bigint, text, time, time);
drop function if exists admin_update_staff(text, bigint, text, time, time, int[]);
drop function if exists _staff_json(staff);
drop function if exists _record_json(records);
drop function if exists _on_leave(staff, date);
drop function if exists _too_many_fails(text);
drop function if exists admin_regen_code(text, bigint);
drop function if exists admin_add_staff(text, text, bigint, numeric, int[]);

-- ---------------------------------------------------------------------
-- Yardımcı (dahili) fonksiyonlar
-- ---------------------------------------------------------------------
-- İstemci IP'si. Önünde duran web sunucusu (Caddyfile) gerçek IP'yi X-Client-IP başlığına yazar ve
-- istemcinin gönderdiği aynı adlı başlığı ezer. X-Forwarded-For'un en soldaki değeri istemcinin kendi
-- yazdığı (sahte olabilir) değerdir; yedek olarak güvenilen proxy'nin eklediği en sağdaki değer kullanılır.
create or replace function _client_key() returns text
language plpgsql stable as $$
declare h json; xff text[];
begin
  h := nullif(current_setting('request.headers', true), '')::json;
  if h is null then return 'global'; end if;
  if nullif(h ->> 'x-client-ip', '') is not null then return h ->> 'x-client-ip'; end if;
  xff := string_to_array(replace(coalesce(h ->> 'x-forwarded-for', ''), ' ', ''), ',');
  return coalesce(nullif(xff[array_length(xff, 1)], ''), 'global');
end $$;

create or replace function _too_many_fails(p_key text, p_limit int default 8) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select count(*) >= p_limit from failed_attempts where key = p_key and at > now() - interval '15 minutes'
$$;

create or replace function _register_fail(p_key text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from failed_attempts where at < now() - interval '1 day';
  insert into failed_attempts (key) values (p_key);
$$;

create or replace function _distance_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create or replace function _ist_date(t timestamptz) returns date
language sql immutable as $$ select (t at time zone 'Europe/Istanbul')::date $$;

-- Vardiya başlangıcına göre geç kalma (dk), İstanbul saatiyle
create or replace function _late_minutes(p_start time, p_at timestamptz) returns int
language plpgsql immutable as $$
declare d int;
begin
  if p_start is null or p_at is null then return 0; end if;
  d := (extract(epoch from ((p_at at time zone 'Europe/Istanbul')::time - p_start)) / 60)::int;
  if d < -720 then d := d + 1440; end if;
  if d > 720 then d := d - 1440; end if;
  return greatest(d, 0);
end $$;

create or replace function _gen_code() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare c text;
begin
  for i in 1..10000 loop
    c := lpad((floor(random() * 10000))::int::text, 4, '0');
    if not exists (select 1 from staff where code = c and not deleted) then return c; end if;
  end loop;
  raise exception 'Kullanılabilir kod kalmadı';
end $$;

-- Elle girilen kodu doğrula; boşsa otomatik üret
create or replace function _pick_code(p_code text, p_staff bigint default null) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare c text := nullif(trim(coalesce(p_code, '')), '');
begin
  if c is null then return _gen_code(); end if;
  if c !~ '^[0-9]{4}$' then raise exception 'Kod 4 haneli rakam olmalı'; end if;
  if exists (select 1 from staff where code = c and not deleted and id is distinct from p_staff) then
    raise exception 'Bu kod başka bir personelde kullanılıyor';
  end if;
  return c;
end $$;

create or replace function _assert_admin(p_token text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_token is null or not exists (select 1 from admin_sessions where token = p_token and expires_at > now()) then
    raise exception 'AUTH_REQUIRED';
  end if;
end $$;

-- Personelin o günkü vardiyası: gün bazlı değişiklik varsa o, yoksa varsayılan vardiya
create or replace function _shift_for(p_staff bigint, p_day date) returns shifts
language sql stable security definer set search_path = public, extensions as $$
  select x.* from shifts x
  where x.id = coalesce(
    (select d.shift_id from shift_days d where d.staff_id = p_staff and d.day = p_day),
    (select s.shift_id from staff s where s.id = p_staff))
$$;

-- Personel o gün izinli mi? (haftalık izin günü ya da tarih bazlı izin)
create or replace function _on_leave(p_staff bigint, d date) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from staff s where s.id = p_staff and extract(isodow from d)::int = any (s.off_days))
      or exists (select 1 from leaves l where l.staff_id = p_staff and l.day = d)
$$;

-- Çalışılan dakika (açık mesai için şu ana kadar)
create or replace function _minutes(r records) returns int
language sql stable as $$
  select greatest(0, round(extract(epoch from (coalesce(r.check_out, now()) - r.check_in)) / 60))::int
$$;

create or replace function _record_json(r records) returns json
language sql stable security definer set search_path = public, extensions as $$
  select json_build_object(
    'id', r.id, 'staffId', r.staff_id, 'staffName', s.name,
    'checkIn', r.check_in, 'checkOut', r.check_out, 'day', _ist_date(r.check_in),
    'distance', r.distance, 'late', r.late, 'manual', r.manual, 'edited', r.edited,
    'shiftId', r.shift_id, 'shiftName', r.shift_name,
    'shiftStart', to_char(r.shift_start, 'HH24:MI'), 'shiftEnd', to_char(r.shift_end, 'HH24:MI'),
    'hourlyRate', r.hourly_rate, 'minutes', _minutes(r),
    'earning', round(_minutes(r) / 60.0 * r.hourly_rate, 2))
  from staff s where s.id = r.staff_id
$$;

create or replace function _shift_json(x shifts) returns json
language sql stable as $$
  select case when x.id is null then null else json_build_object(
    'id', x.id, 'name', x.name,
    'start', to_char(x.start_time, 'HH24:MI'), 'end', to_char(x.end_time, 'HH24:MI')) end
$$;

create or replace function _staff_json(s staff) returns json
language sql stable security definer set search_path = public, extensions as $$
  select json_build_object('id', s.id, 'name', s.name, 'code', s.code, 'offDays', s.off_days,
    'shiftId', s.shift_id, 'hourlyRate', s.hourly_rate)
$$;

-- Kaydın vardiya bilgisini (anlık görüntü) doldurur ve geç kalmayı hesaplar
create or replace function _apply_shift(r inout records, p_shift bigint) returns records
language plpgsql stable security definer set search_path = public, extensions as $$
declare x shifts;
begin
  if p_shift is null then x := _shift_for(r.staff_id, _ist_date(r.check_in));
  else select * into x from shifts where id = p_shift; end if;
  r.shift_id := x.id; r.shift_name := x.name; r.shift_start := x.start_time; r.shift_end := x.end_time;
  r.late := _late_minutes(x.start_time, r.check_in);
end $$;

-- ---------------------------------------------------------------------
-- PERSONEL fonksiyonları (anon)
-- Hepsi {status, ...} döner; status 200 dışı ise {error} içerir.
-- ---------------------------------------------------------------------
create or replace function staff_status(p_code text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s staff; r records; x shifts; today date := _ist_date(now()); k text := 'staff:' || _client_key();
begin
  if _too_many_fails(k) then return json_build_object('status', 429, 'error', 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.'); end if;
  select * into s from staff where code = p_code and not deleted;
  if not found then
    perform _register_fail(k);
    return json_build_object('status', 404, 'error', 'Kod bulunamadı');
  end if;
  select * into r from records where staff_id = s.id and check_out is null;
  x := _shift_for(s.id, today);
  return json_build_object('status', 200, 'name', s.name,
    'shiftName', x.name, 'shiftStart', to_char(x.start_time, 'HH24:MI'), 'shiftEnd', to_char(x.end_time, 'HH24:MI'),
    'onShift', r.id is not null, 'checkIn', r.check_in,
    'onLeave', _on_leave(s.id, today));
end $$;

create or replace function staff_checkin(p_code text, p_lat float8, p_lng float8, p_accuracy float8 default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s staff; st settings; r records; dist float8; k text := 'staff:' || _client_key();
begin
  if _too_many_fails(k) then return json_build_object('status', 429, 'error', 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.'); end if;
  select * into s from staff where code = p_code and not deleted;
  if not found then
    perform _register_fail(k);
    return json_build_object('status', 404, 'error', 'Kod bulunamadı');
  end if;
  if p_lat is null or p_lng is null then return json_build_object('status', 400, 'error', 'Konum alınamadı'); end if;

  select * into st from settings where id = 1;
  dist := _distance_m(p_lat, p_lng, st.lat, st.lng);
  if dist > st.radius then
    return json_build_object('status', 403, 'distance', round(dist),
      'error', format('İşyerine uzaksınız (%s m). Giriş için %s m içinde olmalısınız.', round(dist), st.radius));
  end if;

  select * into r from records where staff_id = s.id and check_out is null;
  if found then return json_build_object('status', 409, 'error', 'Zaten mesaidesiniz', 'name', s.name, 'checkIn', r.check_in); end if;

  r := null;
  r.staff_id := s.id; r.check_in := now();
  r := _apply_shift(r, null);
  insert into records (staff_id, check_in, lat, lng, accuracy, distance, late, shift_id, shift_name, shift_start, shift_end, hourly_rate)
  values (s.id, r.check_in, p_lat, p_lng, p_accuracy, round(dist), r.late, r.shift_id, r.shift_name, r.shift_start, r.shift_end, s.hourly_rate)
  returning * into r;
  return json_build_object('status', 200, 'name', s.name, 'checkIn', r.check_in, 'late', r.late);
end $$;

-- ---------------------------------------------------------------------
-- ADMIN fonksiyonları (token ile)
-- ---------------------------------------------------------------------
create or replace function _new_admin_session() returns json
language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(gen_random_bytes(32), 'hex');
begin
  delete from admin_sessions where expires_at < now();
  insert into admin_sessions values (t, now() + interval '12 hours');
  return json_build_object('token', t);
end $$;

-- Admin şifresi henüz belirlenmemiş mi? (ilk kurulum ekranı için)
create or replace function admin_needs_setup() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select admin_password is null from settings where id = 1
$$;

drop function if exists admin_setup(text);

-- YALNIZCA veritabanından (psql, sahibi olarak) çalıştırılır; internete açık DEĞİLDİR.
-- İlk kurulumda şifre belirler, şifre unutulursa sıfırlar; tüm oturumları ve kilitleri temizler.
create or replace function set_admin_password(p_password text) returns text
language plpgsql security definer set search_path = public, extensions as $$
begin
  if length(coalesce(p_password, '')) < 8 then raise exception 'Şifre en az 8 karakter olmalı'; end if;
  update settings set admin_password = crypt(p_password, gen_salt('bf')) where id = 1;
  delete from admin_sessions;
  delete from failed_attempts where key like 'admin:%';
  return 'Admin şifresi ayarlandı';
end $$;

-- YALNIZCA veritabanından: admin giriş kilidini kaldırır
create or replace function admin_unlock() returns text
language sql security definer set search_path = public, extensions as $$
  delete from failed_attempts where key like 'admin:%';
  select 'Admin giriş kilidi kaldırıldı';
$$;

-- Hata durumunda exception değil {error} döner: exception işlemi geri alır ve
-- hatalı deneme kaydı da silinirdi (kaba kuvvet koruması çalışmazdı).
create or replace function admin_login(p_password text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare k text := 'admin:' || _client_key();
begin
  -- IP başına 8 hatalı deneme / 15 dk. Dağıtık saldırıya karşı: 15 dk içinde 50 FARKLI IP'den
  -- hatalı deneme gelirse giriş geçici kapanır (tek kişi bunu tetikleyemez).
  -- Kilit kalmazsa veritabanında: select admin_unlock();
  if _too_many_fails(k) or (select count(distinct key) >= 50 from failed_attempts
                            where key like 'admin:%' and at > now() - interval '15 minutes') then
    return json_build_object('error', 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');
  end if;
  if admin_needs_setup() then return json_build_object('error', 'SETUP_REQUIRED'); end if;
  if not exists (select 1 from settings where id = 1 and admin_password = crypt(p_password, admin_password)) then
    perform _register_fail(k);
    return json_build_object('error', 'Şifre hatalı');
  end if;
  return _new_admin_session();
end $$;

create or replace function admin_logout(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from admin_sessions where token = p_token;
$$;

create or replace function admin_state(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare today date := _ist_date(now());
begin
  perform _assert_admin(p_token);
  return json_build_object(
    'shifts', coalesce((
      select json_agg(json_build_object(
        'id', x.id, 'name', x.name, 'start', to_char(x.start_time, 'HH24:MI'), 'end', to_char(x.end_time, 'HH24:MI'),
        'staffCount', (select count(*) from staff s where s.shift_id = x.id and not s.deleted))
        order by x.start_time, x.name)
      from shifts x where not x.deleted), '[]'),
    'staff', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'name', s.name, 'code', s.code, 'offDays', s.off_days, 'onLeave', _on_leave(s.id, today),
        'shiftId', s.shift_id, 'hourlyRate', s.hourly_rate, 'todayShift', _shift_json(_shift_for(s.id, today)),
        'onShift', r.id is not null, 'openRecordId', r.id, 'checkIn', r.check_in, 'late', coalesce(r.late, 0))
        order by s.name)
      from staff s left join records r on r.staff_id = s.id and r.check_out is null
      where not s.deleted), '[]'),
    'today', coalesce((
      select json_agg(_record_json(r) order by r.check_in desc) from records r
      where _ist_date(r.check_in) = today or r.check_out is null), '[]'),
    'settings', (select json_build_object('lat', lat, 'lng', lng, 'radius', radius) from settings where id = 1));
end $$;

create or replace function admin_records(p_token text, p_from date default null, p_to date default null, p_staff bigint default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_token);
  return coalesce((
    select json_agg(_record_json(r) order by r.check_in desc) from records r
    where (p_from is null or _ist_date(r.check_in) >= p_from)
      and (p_to   is null or _ist_date(r.check_in) <= p_to)
      and (p_staff is null or r.staff_id = p_staff)), '[]');
end $$;

-- ---- Vardiyalar ----
create or replace function admin_save_shift(p_token text, p_id bigint, p_name text, p_start time, p_end time) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare x shifts;
begin
  perform _assert_admin(p_token);
  if coalesce(trim(p_name), '') = '' then raise exception 'Vardiya adı gerekli'; end if;
  if p_start is null or p_end is null then raise exception 'Başlangıç ve bitiş saati gerekli'; end if;
  if p_start = p_end then raise exception 'Başlangıç ve bitiş aynı olamaz'; end if;
  if p_id is null then
    insert into shifts (name, start_time, end_time) values (trim(p_name), p_start, p_end) returning * into x;
  else
    update shifts set name = trim(p_name), start_time = p_start, end_time = p_end
    where id = p_id and not deleted returning * into x;
    if not found then raise exception 'Vardiya bulunamadı'; end if;
  end if;
  return _shift_json(x);
end $$;

create or replace function admin_delete_shift(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  perform _assert_admin(p_token);
  select count(*) into n from staff where shift_id = p_id and not deleted;
  if n > 0 then raise exception 'Bu vardiyada % personel var. Önce personelin vardiyasını değiştirin.', n; end if;
  delete from shift_days where shift_id = p_id and day >= _ist_date(now());
  update shifts set deleted = true where id = p_id; -- geçmiş kayıtlar korunur
end $$;

-- Belirli bir gün için vardiya değiştir (p_shift null: varsayılana dön)
create or replace function admin_set_day_shift(p_token text, p_staff bigint, p_day date, p_shift bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_token);
  if not exists (select 1 from staff where id = p_staff and not deleted) then raise exception 'Personel bulunamadı'; end if;
  if p_shift is null or p_shift = (select shift_id from staff where id = p_staff) then
    delete from shift_days where staff_id = p_staff and day = p_day;
  else
    if not exists (select 1 from shifts where id = p_shift and not deleted) then raise exception 'Vardiya bulunamadı'; end if;
    insert into shift_days (staff_id, day, shift_id) values (p_staff, p_day, p_shift)
    on conflict (staff_id, day) do update set shift_id = excluded.shift_id;
  end if;
end $$;

-- ---- Personel ----
create or replace function admin_add_staff(p_token text, p_name text, p_shift bigint, p_hourly_rate numeric default 0, p_off_days int[] default '{}', p_code text default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s staff;
begin
  perform _assert_admin(p_token);
  if coalesce(trim(p_name), '') = '' then raise exception 'İsim gerekli'; end if;
  if not exists (select 1 from shifts where id = p_shift and not deleted) then raise exception 'Vardiya seçin'; end if;
  if coalesce(p_hourly_rate, 0) < 0 then raise exception 'Saatlik ücret negatif olamaz'; end if;
  if exists (select 1 from unnest(p_off_days) d where d not between 1 and 7) then raise exception 'Geçersiz izin günü'; end if;
  insert into staff (name, code, shift_id, hourly_rate, off_days)
  values (trim(p_name), _pick_code(p_code), p_shift, coalesce(p_hourly_rate, 0),
          coalesce((select array_agg(distinct d order by d) from unnest(p_off_days) d), '{}'))
  returning * into s;
  return _staff_json(s);
end $$;

create or replace function admin_update_staff(p_token text, p_id bigint, p_name text, p_shift bigint, p_hourly_rate numeric, p_off_days int[] default '{}') returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s staff;
begin
  perform _assert_admin(p_token);
  if coalesce(trim(p_name), '') = '' then raise exception 'İsim gerekli'; end if;
  if not exists (select 1 from shifts where id = p_shift and not deleted) then raise exception 'Vardiya seçin'; end if;
  if coalesce(p_hourly_rate, 0) < 0 then raise exception 'Saatlik ücret negatif olamaz'; end if;
  if exists (select 1 from unnest(p_off_days) d where d not between 1 and 7) then raise exception 'Geçersiz izin günü'; end if;
  update staff set name = trim(p_name), shift_id = p_shift, hourly_rate = coalesce(p_hourly_rate, 0),
    off_days = coalesce((select array_agg(distinct d order by d) from unnest(p_off_days) d), '{}')
  where id = p_id and not deleted returning * into s;
  if not found then raise exception 'Personel bulunamadı'; end if;
  -- Ücret değişikliği hâlâ açık olan mesaiye de uygulanır
  update records set hourly_rate = s.hourly_rate where staff_id = s.id and check_out is null;
  return _staff_json(s);
end $$;

create or replace function admin_delete_staff(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_token);
  update records set check_out = now() where staff_id = p_id and check_out is null;
  update staff set deleted = true, code = null where id = p_id; -- geçmiş kayıtlar korunur
end $$;

-- Kodu değiştir: p_code boşsa rastgele yeni kod üretilir
create or replace function admin_set_code(p_token text, p_id bigint, p_code text default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare s staff;
begin
  perform _assert_admin(p_token);
  update staff set code = _pick_code(p_code, p_id) where id = p_id and not deleted returning * into s;
  if not found then raise exception 'Personel bulunamadı'; end if;
  return _staff_json(s);
end $$;

-- ---- Giriş / çıkış kayıtları ----
-- Konum şartı olmadan admin girişi (şu an)
create or replace function admin_manual_checkin(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s staff; r records;
begin
  perform _assert_admin(p_token);
  select * into s from staff where id = p_id and not deleted;
  if not found then raise exception 'Personel bulunamadı'; end if;
  if exists (select 1 from records where staff_id = p_id and check_out is null) then raise exception 'Zaten mesaide'; end if;
  r.staff_id := s.id; r.check_in := now();
  r := _apply_shift(r, null);
  insert into records (staff_id, check_in, late, manual, shift_id, shift_name, shift_start, shift_end, hourly_rate)
  values (s.id, r.check_in, r.late, true, r.shift_id, r.shift_name, r.shift_start, r.shift_end, s.hourly_rate);
end $$;

create or replace function admin_checkout(p_token text, p_record bigint, p_time timestamptz default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare r records; t timestamptz := coalesce(p_time, now());
begin
  perform _assert_admin(p_token);
  select * into r from records where id = p_record;
  if not found then raise exception 'Kayıt bulunamadı'; end if;
  if r.check_out is not null then raise exception 'Çıkış zaten yapılmış'; end if;
  if r.check_in - t >= interval '1 minute' then raise exception 'Çıkış saati girişten önce olamaz'; end if;
  update records set check_out = greatest(t, r.check_in) where id = p_record;
end $$;

-- Kayıt ekle (p_id null) veya düzenle. Geç kalma, seçilen vardiyaya göre yeniden hesaplanır.
-- p_shift null ise o günün vardiyası kullanılır; p_hourly_rate null ise personelin ücreti.
create or replace function admin_save_record(p_token text, p_id bigint, p_staff bigint, p_check_in timestamptz,
  p_check_out timestamptz default null, p_shift bigint default null, p_hourly_rate numeric default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare r records; s staff;
begin
  perform _assert_admin(p_token);
  if p_check_in is null then raise exception 'Giriş saati gerekli'; end if;
  if p_check_out is not null and p_check_out <= p_check_in then raise exception 'Çıkış saati girişten sonra olmalı'; end if;
  if p_check_in > now() + interval '1 minute' then raise exception 'Giriş saati ileri bir zaman olamaz'; end if;
  if coalesce(p_hourly_rate, 0) < 0 then raise exception 'Saatlik ücret negatif olamaz'; end if;

  if p_id is null then
    select * into s from staff where id = p_staff and not deleted;
    if not found then raise exception 'Personel bulunamadı'; end if;
    r.staff_id := s.id; r.manual := true; r.hourly_rate := coalesce(p_hourly_rate, s.hourly_rate);
  else
    select * into r from records where id = p_id;
    if not found then raise exception 'Kayıt bulunamadı'; end if;
    r.hourly_rate := coalesce(p_hourly_rate, r.hourly_rate);
    r.edited := true;
  end if;

  if p_check_out is null and exists (select 1 from records where staff_id = r.staff_id and check_out is null and id is distinct from p_id) then
    raise exception 'Personelin zaten açık bir mesaisi var. Çıkış saatini girin.';
  end if;
  if exists (select 1 from records x where x.staff_id = r.staff_id and x.id is distinct from p_id
             and tstzrange(x.check_in, coalesce(x.check_out, 'infinity')) && tstzrange(p_check_in, coalesce(p_check_out, 'infinity'))) then
    raise exception 'Bu saatler personelin başka bir kaydıyla çakışıyor';
  end if;

  -- Aynı gün düzenlenen kayıtta, vardiya seçilmediyse kayıttaki vardiya (anlık görüntü) korunur
  if p_id is not null and p_shift is null and r.shift_start is not null and _ist_date(p_check_in) = _ist_date(r.check_in) then
    r.check_in := p_check_in; r.check_out := p_check_out;
    r.late := _late_minutes(r.shift_start, r.check_in);
  else
    r.check_in := p_check_in; r.check_out := p_check_out;
    r := _apply_shift(r, p_shift);
  end if;

  if p_id is null then
    insert into records (staff_id, check_in, check_out, late, manual, shift_id, shift_name, shift_start, shift_end, hourly_rate)
    values (r.staff_id, r.check_in, r.check_out, r.late, true, r.shift_id, r.shift_name, r.shift_start, r.shift_end, r.hourly_rate)
    returning * into r;
  else
    update records set check_in = r.check_in, check_out = r.check_out, late = r.late, edited = true,
      shift_id = r.shift_id, shift_name = r.shift_name, shift_start = r.shift_start, shift_end = r.shift_end, hourly_rate = r.hourly_rate
    where id = p_id returning * into r;
  end if;
  return _record_json(r);
end $$;

create or replace function admin_delete_record(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_token);
  delete from records where id = p_id;
end $$;

-- ---- Ayarlar ----
create or replace function admin_update_settings(p_token text, p_lat float8, p_lng float8, p_radius int) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_token);
  if p_lat is null or p_lng is null or p_radius not between 10 and 5000 then raise exception 'Geçersiz konum ayarı'; end if;
  update settings set lat = p_lat, lng = p_lng, radius = p_radius where id = 1;
end $$;

create or replace function admin_change_password(p_token text, p_current text, p_next text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_token);
  if not exists (select 1 from settings where id = 1 and admin_password = crypt(p_current, admin_password)) then
    raise exception 'Mevcut şifre hatalı';
  end if;
  if length(coalesce(p_next, '')) < 8 then raise exception 'Yeni şifre en az 8 karakter olmalı'; end if;
  update settings set admin_password = crypt(p_next, gen_salt('bf')) where id = 1;
  delete from admin_sessions where token <> p_token; -- diğer oturumları kapat
end $$;

-- ---- İzin & takvim ----
-- Tarih bazlı izin ver / kaldır (true: izin verildi, false: kaldırıldı)
create or replace function admin_toggle_leave(p_token text, p_staff bigint, p_day date) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _assert_admin(p_token);
  if not exists (select 1 from staff where id = p_staff and not deleted) then raise exception 'Personel bulunamadı'; end if;
  delete from leaves where staff_id = p_staff and day = p_day;
  if found then return false; end if;
  insert into leaves (staff_id, day) values (p_staff, p_day);
  return true;
end $$;

-- Takvim: ayın her günü için personel bazında durum, vardiya ve hakediş
-- status: ok (zamanında) | late (geç) | absent (gelmedi) | leave (izinli) | off (haftalık izin)
--         | open (mesaide) | pending (bugün, henüz gelmedi) | future | before (işe başlamadan önce)
create or replace function admin_calendar(p_token text, p_month date) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  m0 date := date_trunc('month', p_month)::date;
  m1 date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  now_ist timestamp := now() at time zone 'Europe/Istanbul';
  today date := now_ist::date;
begin
  perform _assert_admin(p_token);
  return json_build_object(
    'from', m0, 'to', m1, 'today', today,
    'staff', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'name', s.name, 'offDays', s.off_days, 'shiftId', s.shift_id, 'hourlyRate', s.hourly_rate,
        'days', (
          select json_agg(json_build_object(
            'day', d.day, 'status', d.status, 'late', d.late, 'leave', d.is_leave,
            'shift', d.shift, 'shiftOverride', d.override,
            'recordId', d.record_id, 'checkIn', d.check_in, 'checkOut', d.check_out, 'manual', d.manual, 'edited', d.edited,
            'records', d.n_records, 'minutes', d.minutes, 'earning', d.earning) order by d.day)
          from (
            select g.day, fr.id as record_id, fr.late, fr.check_in, fr.check_out, fr.manual, fr.edited,
              agg.n_records, agg.minutes, agg.earning,
              exists (select 1 from leaves l where l.staff_id = s.id and l.day = g.day) as is_leave,
              exists (select 1 from shift_days sd where sd.staff_id = s.id and sd.day = g.day) as override,
              case when fr.id is not null
                then json_build_object('id', fr.shift_id, 'name', fr.shift_name, 'start', to_char(fr.shift_start, 'HH24:MI'), 'end', to_char(fr.shift_end, 'HH24:MI'))
                else _shift_json(x) end as shift,
              case
                when fr.id is not null and agg.open then 'open'
                when fr.id is not null and fr.late > 0 then 'late'
                when fr.id is not null then 'ok'
                when exists (select 1 from leaves l where l.staff_id = s.id and l.day = g.day) then 'leave'
                when extract(isodow from g.day)::int = any (s.off_days) then 'off'
                when g.day < _ist_date(s.created_at) then 'before'
                when g.day > today then 'future'
                when g.day = today and (x.end_time <= x.start_time or now_ist::time < x.end_time) then 'pending'
                else 'absent'
              end as status
            from (select gs::date as day from generate_series(m0, m1, interval '1 day') gs) g
            cross join lateral (select * from _shift_for(s.id, g.day)) x
            left join lateral (
              select * from records r
              where r.staff_id = s.id and _ist_date(r.check_in) = g.day
              order by r.check_in limit 1) fr on true
            left join lateral (
              select count(*)::int as n_records, sum(_minutes(r))::int as minutes,
                     round(sum(_minutes(r) / 60.0 * r.hourly_rate), 2) as earning,
                     bool_or(r.check_out is null) as open
              from records r where r.staff_id = s.id and _ist_date(r.check_in) = g.day) agg on true
          ) d)
      ) order by s.name)
      from staff s where not s.deleted), '[]'));
end $$;

-- ---------------------------------------------------------------------
-- Yetkiler: dışarıya yalnızca public API fonksiyonları açık
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  staff_status(text),
  staff_checkin(text, float8, float8, float8),
  admin_needs_setup(),
  admin_login(text),
  admin_logout(text),
  admin_state(text),
  admin_records(text, date, date, bigint),
  admin_save_shift(text, bigint, text, time, time),
  admin_delete_shift(text, bigint),
  admin_set_day_shift(text, bigint, date, bigint),
  admin_add_staff(text, text, bigint, numeric, int[], text),
  admin_update_staff(text, bigint, text, bigint, numeric, int[]),
  admin_delete_staff(text, bigint),
  admin_set_code(text, bigint, text),
  admin_manual_checkin(text, bigint),
  admin_checkout(text, bigint, timestamptz),
  admin_save_record(text, bigint, bigint, timestamptz, timestamptz, bigint, numeric),
  admin_delete_record(text, bigint),
  admin_update_settings(text, float8, float8, int),
  admin_change_password(text, text, text),
  admin_toggle_leave(text, bigint, date),
  admin_calendar(text, date)
to anon, authenticated;

-- PostgREST şema önbelleğini yenile
notify pgrst, 'reload schema';
