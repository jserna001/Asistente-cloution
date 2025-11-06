import Fastify from 'fastify';
import { chromium } from 'playwright';
import { randomUUID } from 'crypto';

const fastify = Fastify({ logger: true });
const port = process.env.PORT || 3001;

// --- Gestión de Estado (En Memoria) ---
// El plan indica que este servicio es 'stateful'.
// Usamos un Map para almacenar el contexto del navegador por sessionId.
// Map<sessionId, BrowserContext>
const sessions = new Map();
let browser; // Instancia de navegador global



// --- Endpoints de la API ---

/**
 * Crea una nueva sesión de navegador (BrowserContext).
 */
fastify.post('/session/create', async (request, reply) => {
  try {
    // Usamos un UUID, que coincide con el tipo de la PK en Supabase
    const sessionId = randomUUID(); 
    
    // El plan menciona crear un BrowserContext
    // Agregar opciones para evitar ser detectado como bot
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'es-ES',
      timezoneId: 'America/Bogota',
    }); 
    
    sessions.set(sessionId, context);
    fastify.log.info(`Sesión creada: ${sessionId}`);
    
    reply.send({ sessionId });
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: 'Failed to create session' });
  }
});

/**
 * Ejecuta una acción en una sesión existente.
 * Esta es la implementación de "POST /session/execute"
 */
fastify.post('/session/execute', async (request, reply) => {
  // sessionId, action, params
  const { sessionId, action, params } = request.body;

  if (!sessionId || !sessions.has(sessionId)) {
    return reply.status(404).send({ error: 'Session not found' });
  }
  if (!action || !params) {
    return reply.status(400).send({ error: 'Action and params required' });
  }

  const context = sessions.get(sessionId);
  let result;

  try {
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    let observation; // La "Observación" que se devuelve al agente

    switch (action) {
      case 'browse_web':
        fastify.log.info(`[browse_web] Navegando a: ${params.url}`);
        await page.goto(params.url, { waitUntil: 'networkidle' });
        fastify.log.info(`[browse_web] ✓ Página cargada: ${page.url()}`);

        // Agregar delay para simular que el humano está leyendo la página
        await page.waitForTimeout(1000);
        observation = {
          success: true,
          url: page.url(),
          // Fusión: Devuelve el contexto semántico inmediatamente
          semantic_context: await getSemanticContext(page, fastify.log),
        };
        break;

      case 'type_text':
        fastify.log.info(`[type_text] Intentando llenar selector: "${params.selector}" con texto: "${params.text}"`);

        try {
          // Verificar si el elemento existe y es visible antes de intentar llenar
          const elementHandle = await page.$(params.selector);
          if (!elementHandle) {
            // Si no se encuentra, hacer diagnóstico
            fastify.log.error(`[type_text] ❌ Elemento NO encontrado con selector: "${params.selector}"`);

            // Log de diagnóstico: contar cuántos elementos coinciden
            const matchCount = await page.$$(params.selector).then(els => els.length);
            fastify.log.error(`[type_text] Coincidencias encontradas con ese selector: ${matchCount}`);

            // Log de diagnóstico: mostrar todos los inputs disponibles
            const allInputs = await page.$$('input, textarea');
            fastify.log.error(`[type_text] Total de inputs/textarea en la página: ${allInputs.length}`);

            for (let i = 0; i < Math.min(10, allInputs.length); i++) {
              const name = await allInputs[i].getAttribute('name');
              const type = await allInputs[i].getAttribute('type');
              const placeholder = await allInputs[i].getAttribute('placeholder');
              const isVisible = await allInputs[i].isVisible().catch(() => false);
              fastify.log.error(`  [${i}] name="${name}" type="${type}" placeholder="${placeholder}" visible=${isVisible}`);
            }

            throw new Error(`Elemento no encontrado: ${params.selector}`);
          }

          const isVisible = await elementHandle.isVisible().catch(() => false);
          const isEditable = await elementHandle.isEditable().catch(() => false);
          fastify.log.info(`[type_text] Elemento encontrado - isVisible: ${isVisible}, isEditable: ${isEditable}`);

          if (!isVisible) {
            throw new Error(`Elemento no visible: ${params.selector}`);
          }
          if (!isEditable) {
            throw new Error(`Elemento no editable: ${params.selector}`);
          }

          // Intentar llenar con un timeout más explícito
          fastify.log.info(`[type_text] ✓ Procediendo a llenar el campo...`);
          await page.fill(params.selector, params.text, { timeout: 10000 });
          fastify.log.info(`[type_text] ✓✓ Campo llenado exitosamente`);

          // Agregar un pequeño delay para simular comportamiento humano (especialmente importante para Google)
          await page.waitForTimeout(500);

        } catch (fillError) {
          fastify.log.error(`[type_text] ❌ Error al llenar el campo: ${fillError.message}`);
          throw fillError;
        }

        observation = {
          success: true,
          selector: params.selector,
          semantic_context: await getSemanticContext(page, fastify.log),
        };
        break;

      case 'click_element':
        fastify.log.info(`[click_element] Intentando hacer clic en: "${params.selector}"`);

        try {
          // Verificar si el elemento existe antes de hacer clic
          const elementHandle = await page.$(params.selector);
          if (!elementHandle) {
            fastify.log.error(`[click_element] ❌ Elemento NO encontrado con selector: "${params.selector}"`);
            throw new Error(`Elemento no encontrado: ${params.selector}`);
          }

          const isVisible = await elementHandle.isVisible().catch(() => false);
          fastify.log.info(`[click_element] Elemento encontrado - isVisible: ${isVisible}`);

          if (!isVisible) {
            throw new Error(`Elemento no visible: ${params.selector}`);
          }

          await page.click(params.selector, { timeout: 10000 });
          fastify.log.info(`[click_element] ✓ Clic exitoso`);

          // Agregar delay para simular comportamiento humano
          await page.waitForTimeout(500);
        } catch (clickError) {
          fastify.log.error(`[click_element] ❌ Error al hacer clic: ${clickError.message}`);
          throw clickError;
        }

        // Espera a que la navegación (si la hay) termine
        await page.waitForLoadState('networkidle');
        fastify.log.info(`[click_element] ✓ Navegación completada`);

        observation = {
          success: true,
          selector: params.selector,
          semantic_context: await getSemanticContext(page, fastify.log),
        };
        break;

      case 'get_semantic_context':
        // Esta herramienta ahora es redundante, pero la dejamos por si acaso
        observation = {
          semantic_context: await getSemanticContext(page, fastify.log),
        };
        break;

      default:
        return reply.status(400).send({ error: 'Unknown action' });
    }

    // Devolvemos el objeto de Observación completo
    reply.send(observation);

  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: `Action failed: ${error.message}` });
  }
});

/**
 * Destruye una sesión
 */
fastify.post('/session/destroy', async (request, reply) => {
    const { sessionId } = request.body;
    if (sessions.has(sessionId)) {
        const context = sessions.get(sessionId);
        await context.close(); // Cierra el contexto del navegador
        sessions.delete(sessionId); // Lo elimina del mapa
        fastify.log.info(`Sesión destruida: ${sessionId}`);
        reply.send({ success: true, sessionId });
    } else {
        reply.status(404).send({ error: 'Session not found' });
    }
});

// --- Arranque del Servidor ---
const start = async () => {
  try {
    // Lanzamos una única instancia del navegador al iniciar el servidor
    browser = await chromium.launch();
    fastify.log.info('Navegador Chromium lanzado.');
    
    // Escuchar en 0.0.0.0 para ser accesible desde fuera del contenedor Docker
    await fastify.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
/**
 * Parsea un nodo del árbol de accesibilidad y lo convierte en Markdown semántico.
 * Esto implementa la Acción 4 del Sprint X
 * @param {object} node - El nodo del árbol A11y de Playwright.
 * @returns {string} - Una cadena de Markdown semántico.
 */
function parseAccessibilityNode(node) {
  let markdown = '';
  const role = node.role;
  const name = node.name.trim();

  // Solo nos interesan los elementos interactivos o semánticos con nombre
  if (!name) {
    // Recorrer hijos incluso si el nodo actual no tiene nombre
    if (node.children) {
      for (const child of node.children) {
        markdown += parseAccessibilityNode(child);
      }
    }
    return markdown;
  }

  // Mapear roles a Markdown Semántico
  switch (role) {
    case 'heading':
      markdown = `[Heading ${node.level || 1}: "${name}"]\n`;
      break;
    case 'link':
      markdown = `[Link: "${name}"]\n`;
      break;
    case 'button':
      markdown = `[Button: "${name}"]\n`;
      break;
    case 'textbox':
    case 'searchbox':
      markdown = `[Input: "${name}"]\n`;
      break;
    case 'label':
      // A menudo los labels están separados de los inputs, esto los captura
      markdown = `[Label: "${name}"]\n`;
      break;
    case 'paragraph':
      // Omitimos párrafos para mantener el contexto conciso
      break;
    // Añadir más roles según sea necesario
  }

  // Recorrer hijos
  if (node.children) {
    for (const child of node.children) {
      markdown += parseAccessibilityNode(child);
    }
  }

  return markdown;
}

/**
 * Obtiene el snapshot A11y de una página y lo convierte en Markdown semántico CON SELECTORES.
 * Implementa la Acción 4 del Sprint X + Parche 13 (Sprint Z)
 * @param {import('playwright').Page} page - La instancia de la página de Playwright.
 * @param {object} logger - El logger de Fastify (fastify.log).
 * @returns {Promise<string>} - El contexto semántico en Markdown con selectores CSS.
 */
async function getSemanticContext(page, logger) {
  try {
    logger.info('[getSemanticContext] Iniciando extracción de contexto semántico...');
    // Espera a que la página esté estable antes de extraer elementos
    await page.waitForLoadState('networkidle');

    let semanticContext = '';
    let inputCount = 0, buttonCount = 0, linkCount = 0, headingCount = 0;

    // Extraer elementos interactivos REALMENTE ACCIONABLES
    // 1. INPUTS - solo incluir los que Playwright puede realmente llenar
    try {
      // Primero, buscar inputs con placeholder (más específicos)
      const inputsWithPlaceholder = await page.$$('input[placeholder]:not([type="hidden"]):not([disabled]), textarea[placeholder]:not([disabled])');
      logger.info(`Encontrados ${inputsWithPlaceholder.length} inputs con placeholder`);

      for (const input of inputsWithPlaceholder) {
        try {
          // Test más estricto: verificar que sea editable (enabled, visible, no readonly)
          const isEditable = await input.isEditable().catch(() => false);
          const isVisible = await input.isVisible().catch(() => false);
          const placeholder = await input.getAttribute('placeholder');

          logger.info(`Input placeholder="${placeholder}": isEditable=${isEditable}, isVisible=${isVisible}`);

          if (isEditable && isVisible) {
            if (placeholder && placeholder.trim()) {
              // Filtrar inputs de donaciones o campos de configuración
              const name = await input.getAttribute('name');
              if (!name || (!name.includes('amount') && !name.includes('monthly') && !name.includes('pref-'))) {
                // Usar [placeholder="..."] en lugar de input[placeholder="..."] para más compatibilidad
                const selector = `[placeholder="${placeholder}"]`;
                semanticContext += `INPUT: ${selector} (${placeholder})\n`;
                inputCount++;
                logger.info(`✓ Añadido al contexto: ${selector}`);
              }
            }
          }
        } catch (e) {
          logger.warn(`Error procesando input: ${e.message}`);
          continue;
        }
      }

      // Solo si no encontramos inputs con placeholder, buscar por name
      if (!semanticContext.includes('INPUT:')) {
        const inputsWithName = await page.$$('input[name]:not([type="hidden"]):not([disabled]), textarea[name]:not([disabled])');
        for (const input of inputsWithName) {
          try {
            const isEditable = await input.isEditable().catch(() => false);
            if (isEditable) {
              const name = await input.getAttribute('name');
              // Filtrar: configs, arrays, donaciones
              if (name && !name.includes('[') && !name.includes('pref-') && !name.includes('amount') && !name.includes('monthly')) {
                // Usar [name="..."] en lugar de input[name="..."] para más compatibilidad
                const selector = `[name="${name}"]`;
                semanticContext += `INPUT: ${selector} (${name})\n`;
                inputCount++;
              }
            }
          } catch (e) { continue; }
        }
      }
    } catch (e) {
      logger.warn(`Error extrayendo inputs: ${e.message}`);
    }

    // 2. BUTTONS
    const buttons = await page.$$('button:visible, input[type="submit"]:visible');
    for (const button of buttons) {
      const text = (await button.textContent())?.trim() || await button.getAttribute('value') || '';
      const id = await button.getAttribute('id');
      const ariaLabel = await button.getAttribute('aria-label');

      let selector = '';
      if (id) {
        selector = `#${id}`;
      } else if (text) {
        // Usar texto como locator (Playwright soporta text=)
        selector = `text="${text}"`;
      } else {
        selector = 'button';
      }

      const label = ariaLabel || text || 'Button';
      semanticContext += `BUTTON: ${selector} (${label})\n`;
      buttonCount++;
    }

    // 3. LINKS
    const links = await page.$$('a:visible');
    for (const link of links) {
      if (linkCount >= 20) break; // Limitar a 20 enlaces para no saturar
      const text = (await link.textContent())?.trim() || '';
      const href = await link.getAttribute('href');

      if (text) {
        // Limpiar saltos de línea y espacios múltiples para evitar confusión en selectores
        const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        semanticContext += `LINK: text="${cleanText}" (${href || '#'})\n`;
        linkCount++;
      }
    }

    // 4. HEADINGS
    const headings = await page.$$('h1:visible, h2:visible, h3:visible');
    for (const heading of headings) {
      const text = (await heading.textContent())?.trim() || '';
      const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
      if (text) {
        semanticContext += `HEADING_${tagName.toUpperCase()}: "${text}"\n`;
        headingCount++;
      }
    }

    logger.info(`[getSemanticContext] ✓ Contexto generado - Inputs: ${inputCount}, Buttons: ${buttonCount}, Links: ${linkCount}, Headings: ${headingCount} (${semanticContext.length} caracteres)`);
    return semanticContext || "No se encontraron elementos interactivos.";
  } catch (error) {
    logger.error(`Error en getSemanticContext: ${error.message}`);
    return `Error al obtener contexto: ${error.message}`;
  }
}

start();