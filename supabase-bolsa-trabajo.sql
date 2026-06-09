-- =============================================
-- BOLSA DE TRABAJO - SOFI
-- =============================================

create table if not exists ofertas_trabajo (
  id           bigint generated always as identity primary key,
  puesto       text not null,
  descripcion  text not null,
  horario      text not null,
  salario      text default 'Según convenio',
  fecha_inicio date,
  estado       text not null default 'activa'
                 check (estado in ('activa','pausada','cerrada')),
  created_at   timestamptz not null default now()
);

create table if not exists candidaturas (
  id             bigint generated always as identity primary key,
  oferta_id      bigint references ofertas_trabajo(id) on delete set null,
  nombre         text not null,
  telefono       text not null,
  email          text not null,
  experiencia    text not null
                   check (experiencia in ('sin_experiencia','menos_1_año','1_3_años','mas_3_años')),
  disponibilidad text[] not null default '{}',
  tiene_vehiculo boolean not null default false,
  descripcion    text,
  estado         text not null default 'recibido'
                   check (estado in ('recibido','contactado','entrevista','contratado','descartado')),
  notas_proceso  text,
  interesante    boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Índices útiles
create index if not exists candidaturas_oferta_idx  on candidaturas(oferta_id);
create index if not exists candidaturas_estado_idx  on candidaturas(estado);
create index if not exists candidaturas_created_idx on candidaturas(created_at desc);

-- RLS: la tabla candidaturas se puede insertar sin autenticar (formulario público)
alter table ofertas_trabajo enable row level security;
alter table candidaturas    enable row level security;

-- Ofertas: lectura pública (activas), escritura solo autenticados
create policy "Leer ofertas activas" on ofertas_trabajo
  for select using (estado = 'activa');

create policy "Gestión ofertas autenticados" on ofertas_trabajo
  for all using (auth.role() = 'authenticated');

-- Candidaturas: inserción pública, lectura/modificación solo autenticados
create policy "Insertar candidatura pública" on candidaturas
  for insert with check (true);

create policy "Leer candidaturas autenticados" on candidaturas
  for select using (auth.role() = 'authenticated');

create policy "Modificar candidaturas autenticados" on candidaturas
  for update using (auth.role() = 'authenticated');

create policy "Eliminar candidaturas autenticados" on candidaturas
  for delete using (auth.role() = 'authenticated');
