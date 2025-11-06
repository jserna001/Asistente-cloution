
import { createBrowserClient } from '@supabase/ssr';

/**
 * Crea un cliente de Supabase para el lado del cliente (navegador).
 *
 * Esta función lee las variables de entorno públicas de Next.js para configurar el cliente.
 * Es esencial para interactuar con Supabase desde Client Components en React.
 *
 * @returns Una instancia del cliente de Supabase.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    // Aseguramos que las variables de entorno estén presentes.
    // Si no lo están, se lanzará un error, previniendo comportamientos inesperados.
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
