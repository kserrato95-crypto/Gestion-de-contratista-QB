const TOKEN_KEY = 'gestion_contratistas_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface RequestOptions extends RequestInit {
  data?: unknown;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  if (options.data) {
    config.body = JSON.stringify(options.data);
  }

  const response = await fetch(endpoint, config);

  let responseData: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    const errorMsg =
      responseData && typeof responseData === 'object' && responseData.error
        ? responseData.error
        : `Error en la solicitud: ${response.statusText} (${response.status})`;
    throw new Error(errorMsg);
  }

  if (endpoint.startsWith('/api/') && typeof responseData === 'string' && responseData.includes('<!doctype html>')) {
    throw new Error(`Ruta de API no encontrada o respuesta inválida para ${endpoint}`);
  }

  return responseData as T;
}

// Format currency as Colombian Pesos (COP)
export function formatCOP(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format readable dates in Spanish without UTC off-by-one-day shifts for YYYY-MM-DD strings
export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const clean = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-').map(Number);
      const utcDate = new Date(Date.UTC(y, m - 1, d));
      return utcDate.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
    }
    const d = new Date(clean);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Format date as DD/MM/YYYY (e.g., 28/09/2026) safely without timezone shift
export function formatDateDMY(dateStr?: string): string {
  if (!dateStr) return '—';
  const clean = dateStr.trim().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-');
    return `${d}/${m}/${y}`;
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('/');
    return `${d}/${m}/${y}`;
  }
  return clean;
}

export interface UploadedFileResponse {
  success: boolean;
  message: string;
  file: {
    id: string;
    url: string;
    downloadUrl: string;
    originalName: string;
    mimeType: string;
    size: number;
    tipo: 'fotografia' | 'soporte' | 'seguridad_social';
    obligacionId?: string;
    descripcion: string;
    createdAt: string;
  };
}

export async function uploadEvidenceFile(
  file: File,
  metadata: {
    contratoId?: string;
    obligacionId?: string;
    tipo?: 'fotografia' | 'soporte' | 'seguridad_social';
    descripcion?: string;
  } = {}
): Promise<UploadedFileResponse> {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append('file', file);
  if (metadata.contratoId) formData.append('contratoId', metadata.contratoId);
  if (metadata.obligacionId) formData.append('obligacionId', metadata.obligacionId);
  if (metadata.tipo) formData.append('tipo', metadata.tipo);
  if (metadata.descripcion) formData.append('descripcion', metadata.descripcion);

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/uploads', {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al subir el archivo');
  }
  return data;
}

export async function deleteUploadedFile(fileId: string): Promise<void> {
  await apiRequest(`/api/uploads/${fileId}`, { method: 'DELETE' });
}

