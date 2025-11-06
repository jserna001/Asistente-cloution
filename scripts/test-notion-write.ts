
import { addNotionTodo } from '../lib/notionActions';

// --- 1. Configuración de Prueba ---
// !! IMPORTANTE: Reemplaza este valor con el ID de la página de Notion donde quieres añadir la tarea.
const testPageId = '2a1b6781ca4a80f9a481ea7a4d0d4ca6'; 
const testTodoText = 'Tarea de prueba desde el asistente de IA';

if (testPageId === 'PAGE_ID_PLACEHOLDER') {
  console.error("Error: Por favor, reemplaza 'PAGE_ID_PLACEHOLDER' con el ID de tu página de Notion en scripts/test-notion-write.ts");
  process.exit(1);
}

/**
 * Función principal para ejecutar la prueba de escritura en Notion.
 */
async function main() {
  console.log("Iniciando prueba de escritura en Notion...");
  const result = await addNotionTodo(testPageId, testTodoText);

  if (result.success) {
    console.log("Prueba de escritura en Notion completada exitosamente.");
  } else {
    console.error("La prueba de escritura en Notion falló:", result.error);
    process.exit(1);
  }
}

// --- 3. Ejecutar Script ---
main().catch(error => {
  console.error("Ocurrió un error fatal durante la ejecución del script de prueba:", error);
  process.exit(1);
});
