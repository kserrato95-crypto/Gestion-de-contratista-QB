import React from 'react';

interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'md' }) => {
  const s = status.toLowerCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';

  if (s === 'activo' || s === 'aprobado' || s === 'al día' || s === 'pagado') {
    styles = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (s === 'radicado' || s === 'en trámite' || s === 'certificado por supervisión') {
    styles = 'bg-blue-50 text-blue-800 border-blue-200';
  } else if (s === 'en revisión' || s === 'pendiente' || s === 'pendiente certificación' || s === 'borrador') {
    styles = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (s === 'devuelto' || s === 'con observaciones' || s === 'en mora' || s === 'suspendido' || s === 'inactivo') {
    styles = 'bg-rose-50 text-rose-800 border-rose-200';
  } else if (s === 'finalizado') {
    styles = 'bg-slate-100 text-slate-700 border-slate-300';
  }

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${sizeClass} ${styles}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
};
