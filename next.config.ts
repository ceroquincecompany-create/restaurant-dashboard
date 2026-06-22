import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/rrhh/turnos',     destination: '/rrhh/planificacion?tab=turnos',    permanent: false },
      { source: '/rrhh/presencia',  destination: '/rrhh/planificacion?tab=presencia', permanent: false },
      { source: '/rrhh/fichajes',   destination: '/rrhh/planificacion?tab=fichajes',  permanent: false },
      { source: '/rrhh/firmas',     destination: '/rrhh/documentos?tab=firmas',       permanent: false },
      { source: '/rrhh/sanciones',  destination: '/rrhh/equipo',                      permanent: false },
      { source: '/rrhh/incentivos', destination: '/rrhh/equipo',                      permanent: false },
      { source: '/rrhh/vacaciones', destination: '/rrhh/equipo',                      permanent: false },
      { source: '/rrhh/mi-ficha',   destination: '/rrhh/equipo',                      permanent: false },
    ]
  },
};

export default nextConfig;
