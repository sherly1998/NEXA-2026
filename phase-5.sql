alter table players add column if not exists archived boolean not null default false;
alter table players add column if not exists partner_request text;
alter table players add column if not exists opponent_request text;

alter table attendance add column if not exists wait_started_at timestamptz;
update attendance
set wait_started_at = checked_in_at
where wait_started_at is null;

alter table sessions add column if not exists closed_at timestamptz;
alter table matches add column if not exists manual boolean not null default false;
