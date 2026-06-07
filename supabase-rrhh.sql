-- Módulo RRHH: ejecutar en el SQL Editor de Supabase

create table if not exists empleados (
  id bigserial primary key,
  nombre text not null,
  puesto text not null default 'Sala',
  local_id bigint references locales(id),
  horas_contrato numeric not null default 40,
  salario_bruto numeric,
  coste_empresa_pct numeric not null default 1.31,
  fecha_inicio date,
  estado text not null default 'activo' check (estado in ('activo', 'baja', 'vacaciones')),
  iban text,
  nss text,
  email_acceso text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists turnos (
  id bigserial primary key,
  empleado_id bigint not null references empleados(id) on delete cascade,
  fecha date not null,
  tipo_turno text not null,
  hora_inicio time,
  hora_fin time,
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists fichajes (
  id bigserial primary key,
  empleado_id bigint not null references empleados(id) on delete cascade,
  fecha date not null,
  hora_entrada time,
  hora_salida time,
  horas_total numeric,
  horas_nocturnas numeric,
  horas_extra numeric,
  created_at timestamptz not null default now()
);

-- Empleados iniciales (ajusta si el nombre del local difiere)
insert into empleados (nombre, puesto, local_id, horas_contrato, estado) values
  ('Álvaro Torralbo Rete',     'Sala',   (select id from locales where nombre ilike '%pinomonotano%' limit 1), 24, 'baja'),
  ('Celeste Santos Garzón',    'Sala',   (select id from locales where nombre ilike '%pinomonotano%' limit 1), 38, 'baja'),
  ('Abdelkader Khedim',        'Cocina', (select id from locales where nombre ilike '%pinomonotano%' limit 1), 40, 'activo'),
  ('Eva María Caballero Costa','Sala',   (select id from locales where nombre ilike '%pinomonotano%' limit 1), 29, 'activo'),
  ('Sergio Hidalgo Lorca',     'Sala',   (select id from locales where nombre ilike '%pinomonotano%' limit 1), 30, 'activo'),
  ('Raúl Benavente Rossi',     'Sala',   (select id from locales where nombre ilike '%pinomonotano%' limit 1), 15, 'activo');

-- ──────────────────────────────────────────────────────────────
-- MIGRACIÓN: sin_restriccion_geo
-- ──────────────────────────────────────────────────────────────
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS sin_restriccion_geo BOOLEAN NOT NULL DEFAULT false;
