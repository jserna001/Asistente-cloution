-- =====================================================
-- SEED: Catálogo de Plantillas de Notion
-- =====================================================
-- Ejecuta este script en el SQL Editor de Supabase
-- para poblar la tabla notion_template_catalog con las 5 plantillas predeterminadas

-- Limpiar datos existentes (opcional - comentar si quieres mantener datos previos)
-- DELETE FROM notion_template_catalog;

-- =====================================================
-- 1. PLANTILLA: ESTUDIANTE
-- =====================================================

INSERT INTO notion_template_catalog (
  template_pack_id,
  name,
  description,
  icon,
  target_audience,
  display_order,
  is_active,
  template_structure,
  default_rag_queries,
  suggested_preferences
) VALUES (
  'student',
  '📚 Estudiante',
  'Organiza tus clases, tareas y proyectos académicos con facilidad',
  '📚',
  ARRAY['Estudiantes', 'Cursos online', 'Universitarios'],
  1,
  true,
  '{
    "databases": [
      {
        "name": "Task Manager",
        "icon": "✅",
        "description": "Gestiona tus tareas y entregas académicas",
        "properties": {
          "Name": { "title": {} },
          "Subject": {
            "select": {
              "options": [
                { "name": "Matemáticas", "color": "blue" },
                { "name": "Historia", "color": "red" },
                { "name": "Ciencias", "color": "green" },
                { "name": "Literatura", "color": "purple" },
                { "name": "Inglés", "color": "yellow" }
              ]
            }
          },
          "Status": {
            "select": {
              "options": [
                { "name": "Por hacer", "color": "red" },
                { "name": "En progreso", "color": "yellow" },
                { "name": "Completada", "color": "green" }
              ]
            }
          },
          "Priority": {
            "select": {
              "options": [
                { "name": "Alta", "color": "red" },
                { "name": "Media", "color": "yellow" },
                { "name": "Baja", "color": "gray" }
              ]
            }
          },
          "Due Date": { "date": {} },
          "Type": {
            "select": {
              "options": [
                { "name": "Tarea", "color": "blue" },
                { "name": "Examen", "color": "red" },
                { "name": "Proyecto", "color": "purple" }
              ]
            }
          }
        },
        "views": [
          { "name": "All Tasks", "type": "table" },
          { "name": "By Subject", "type": "board", "group_by": "Subject" },
          { "name": "Calendar", "type": "calendar" }
        ]
      },
      {
        "name": "Class Notes",
        "icon": "📝",
        "description": "Apuntes organizados por materia",
        "properties": {
          "Title": { "title": {} },
          "Subject": {
            "select": {
              "options": [
                { "name": "Matemáticas", "color": "blue" },
                { "name": "Historia", "color": "red" },
                { "name": "Ciencias", "color": "green" }
              ]
            }
          },
          "Date": { "date": {} },
          "Tags": {
            "multi_select": {
              "options": [
                { "name": "Importante", "color": "red" },
                { "name": "Examen", "color": "yellow" },
                { "name": "Resumen", "color": "blue" }
              ]
            }
          }
        }
      },
      {
        "name": "Study Resources",
        "icon": "📖",
        "description": "Libros, links y recursos de estudio",
        "properties": {
          "Name": { "title": {} },
          "Type": {
            "select": {
              "options": [
                { "name": "Libro", "color": "blue" },
                { "name": "Video", "color": "red" },
                { "name": "Artículo", "color": "green" },
                { "name": "Link", "color": "purple" }
              ]
            }
          },
          "Subject": {
            "select": {
              "options": [{ "name": "General", "color": "gray" }]
            }
          },
          "URL": { "url": {} }
        }
      }
    ],
    "pages": [
      {
        "name": "Weekly Schedule",
        "icon": "📅",
        "content": [
          {
            "type": "heading_2",
            "heading_2": {
              "rich_text": [{ "text": { "content": "Mi Horario Semanal" } }]
            }
          },
          {
            "type": "paragraph",
            "paragraph": {
              "rich_text": [{ "text": { "content": "Agrega aquí tu horario de clases semanal." } }]
            }
          }
        ]
      }
    ]
  }'::jsonb,
  '{
    "notion": [
      "¿Qué tareas tengo pendientes para esta semana?",
      "¿Hay exámenes próximos?",
      "Muéstrame mis proyectos en progreso"
    ],
    "gmail": [
      "Correos de profesores sobre entregas",
      "Notificaciones de plataformas académicas"
    ],
    "calendar": [
      "Clases y eventos académicos de hoy"
    ]
  }'::jsonb,
  '{
    "summary_length": "balanced",
    "summary_tone": "friendly",
    "use_emojis": true,
    "group_by_category": true,
    "include_action_items": true
  }'::jsonb
) ON CONFLICT (template_pack_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  target_audience = EXCLUDED.target_audience,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  template_structure = EXCLUDED.template_structure,
  default_rag_queries = EXCLUDED.default_rag_queries,
  suggested_preferences = EXCLUDED.suggested_preferences,
  updated_at = NOW();

-- =====================================================
-- 2. PLANTILLA: PROFESIONAL
-- =====================================================

INSERT INTO notion_template_catalog (
  template_pack_id,
  name,
  description,
  icon,
  target_audience,
  display_order,
  is_active,
  template_structure,
  default_rag_queries,
  suggested_preferences
) VALUES (
  'professional',
  '💼 Profesional',
  'Productividad laboral con proyectos, reuniones y knowledge base',
  '💼',
  ARRAY['Empleados', 'Project managers', 'Equipos remotos'],
  2,
  true,
  '{
    "databases": [
      {
        "name": "Task & Projects Manager",
        "icon": "✅",
        "description": "Gestiona tareas y proyectos laborales",
        "properties": {
          "Task": { "title": {} },
          "Project": {
            "select": {
              "options": [
                { "name": "Proyecto A", "color": "blue" },
                { "name": "Proyecto B", "color": "green" },
                { "name": "Personal", "color": "gray" }
              ]
            }
          },
          "Status": {
            "select": {
              "options": [
                { "name": "Backlog", "color": "gray" },
                { "name": "To Do", "color": "red" },
                { "name": "In Progress", "color": "yellow" },
                { "name": "Done", "color": "green" }
              ]
            }
          },
          "Priority": {
            "select": {
              "options": [
                { "name": "🔴 Urgente", "color": "red" },
                { "name": "🟡 Alta", "color": "yellow" },
                { "name": "🟢 Normal", "color": "green" }
              ]
            }
          },
          "Deadline": { "date": {} },
          "Category": {
            "select": {
              "options": [
                { "name": "Desarrollo", "color": "blue" },
                { "name": "Diseño", "color": "purple" },
                { "name": "Reunión", "color": "yellow" },
                { "name": "Documentación", "color": "gray" }
              ]
            }
          }
        },
        "views": [
          { "name": "My Tasks Today", "type": "table" },
          { "name": "Kanban by Project", "type": "board", "group_by": "Project" },
          { "name": "Timeline", "type": "timeline" }
        ]
      },
      {
        "name": "Meeting Notes",
        "icon": "📝",
        "description": "Notas de reuniones con action items",
        "properties": {
          "Title": { "title": {} },
          "Date": { "date": {} },
          "Participants": {
            "multi_select": {
              "options": [{ "name": "Team", "color": "blue" }]
            }
          },
          "Project": {
            "select": {
              "options": [{ "name": "General", "color": "gray" }]
            }
          }
        }
      }
    ],
    "pages": [
      {
        "name": "Weekly Dashboard",
        "icon": "📊",
        "content": [
          {
            "type": "heading_1",
            "heading_1": {
              "rich_text": [{ "text": { "content": "Dashboard Semanal" } }]
            }
          }
        ]
      }
    ]
  }'::jsonb,
  '{
    "notion": [
      "¿Qué tareas urgentes tengo hoy?",
      "Muéstrame las reuniones de esta semana con sus action items",
      "¿Cuál es el estado de mis proyectos?"
    ],
    "gmail": [
      "Correos de mi jefe o manager",
      "Emails marcados como urgentes",
      "Notificaciones de herramientas de trabajo"
    ],
    "calendar": [
      "Reuniones de hoy y preparación necesaria"
    ]
  }'::jsonb,
  '{
    "summary_length": "balanced",
    "summary_tone": "professional",
    "use_emojis": false,
    "group_by_category": true,
    "include_action_items": true
  }'::jsonb
) ON CONFLICT (template_pack_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  target_audience = EXCLUDED.target_audience,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  template_structure = EXCLUDED.template_structure,
  default_rag_queries = EXCLUDED.default_rag_queries,
  suggested_preferences = EXCLUDED.suggested_preferences,
  updated_at = NOW();

-- =====================================================
-- 3. PLANTILLA: EMPRENDEDOR
-- =====================================================

INSERT INTO notion_template_catalog (
  template_pack_id,
  name,
  description,
  icon,
  target_audience,
  display_order,
  is_active,
  template_structure,
  default_rag_queries,
  suggested_preferences
) VALUES (
  'entrepreneur',
  '🚀 Emprendedor',
  'Gestión completa de negocio: OKRs, CRM, finanzas y roadmap',
  '🚀',
  ARRAY['Fundadores', 'Startups', 'Negocios pequeños'],
  3,
  true,
  '{
    "databases": [
      {
        "name": "OKRs & Goals",
        "icon": "🎯",
        "description": "Objetivos y resultados clave",
        "properties": {
          "Objective": { "title": {} },
          "Quarter": {
            "select": {
              "options": [
                { "name": "Q1", "color": "blue" },
                { "name": "Q2", "color": "green" },
                { "name": "Q3", "color": "yellow" },
                { "name": "Q4", "color": "red" }
              ]
            }
          },
          "Progress": {
            "number": {
              "format": "percent"
            }
          }
        }
      },
      {
        "name": "CRM - Clients & Leads",
        "icon": "👥",
        "description": "Gestión de clientes y oportunidades",
        "properties": {
          "Name": { "title": {} },
          "Company": { "rich_text": {} },
          "Status": {
            "select": {
              "options": [
                { "name": "Lead", "color": "gray" },
                { "name": "Prospecto", "color": "yellow" },
                { "name": "Cliente", "color": "green" },
                { "name": "Inactivo", "color": "red" }
              ]
            }
          },
          "Stage": {
            "select": {
              "options": [
                { "name": "Contacto inicial", "color": "blue" },
                { "name": "Propuesta", "color": "yellow" },
                { "name": "Negociación", "color": "orange" },
                { "name": "Cerrado", "color": "green" }
              ]
            }
          },
          "Potential Value": {
            "number": {
              "format": "dollar"
            }
          },
          "Next Follow-up": { "date": {} }
        },
        "views": [
          { "name": "All Contacts", "type": "table" },
          { "name": "Sales Pipeline", "type": "board", "group_by": "Stage" }
        ]
      }
    ],
    "pages": []
  }'::jsonb,
  '{
    "notion": [
      "¿Qué clientes requieren seguimiento esta semana?",
      "Muéstrame el progreso de mis OKRs del trimestre",
      "¿Cuáles son las oportunidades de negocio activas?"
    ],
    "gmail": [
      "Correos de clientes o leads",
      "Oportunidades de negocio",
      "Facturas o pagos pendientes"
    ],
    "calendar": [
      "Calls con clientes y eventos de networking"
    ]
  }'::jsonb,
  '{
    "summary_length": "detailed",
    "summary_tone": "motivational",
    "use_emojis": true,
    "group_by_category": true,
    "include_action_items": true
  }'::jsonb
) ON CONFLICT (template_pack_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  target_audience = EXCLUDED.target_audience,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  template_structure = EXCLUDED.template_structure,
  default_rag_queries = EXCLUDED.default_rag_queries,
  suggested_preferences = EXCLUDED.suggested_preferences,
  updated_at = NOW();

-- =====================================================
-- 4. PLANTILLA: FREELANCER
-- =====================================================

INSERT INTO notion_template_catalog (
  template_pack_id,
  name,
  description,
  icon,
  target_audience,
  display_order,
  is_active,
  template_structure,
  default_rag_queries,
  suggested_preferences
) VALUES (
  'freelancer',
  '🎨 Freelancer',
  'Proyectos, clientes, time tracking y facturación',
  '🎨',
  ARRAY['Freelancers', 'Consultores', 'Trabajadores independientes'],
  4,
  true,
  '{
    "databases": [
      {
        "name": "Projects",
        "icon": "💼",
        "description": "Gestión de proyectos freelance",
        "properties": {
          "Project Name": { "title": {} },
          "Client": {
            "select": {
              "options": [{ "name": "New Client", "color": "gray" }]
            }
          },
          "Status": {
            "select": {
              "options": [
                { "name": "Prospecto", "color": "gray" },
                { "name": "En curso", "color": "blue" },
                { "name": "Entregado", "color": "green" },
                { "name": "Facturado", "color": "purple" }
              ]
            }
          },
          "Start Date": { "date": {} },
          "Due Date": { "date": {} },
          "Amount": {
            "number": {
              "format": "dollar"
            }
          },
          "Hours Estimated": { "number": {} },
          "Hours Worked": { "number": {} }
        },
        "views": [
          { "name": "Active Projects", "type": "table" },
          { "name": "By Due Date", "type": "calendar" }
        ]
      },
      {
        "name": "Clients",
        "icon": "👥",
        "description": "Base de datos de clientes",
        "properties": {
          "Name": { "title": {} },
          "Company": { "rich_text": {} },
          "Email": { "email": {} },
          "Phone": { "phone_number": {} }
        }
      }
    ],
    "pages": []
  }'::jsonb,
  '{
    "notion": [
      "¿Qué proyectos tengo activos y cuáles son sus deadlines?",
      "¿Hay facturas pendientes de pago?",
      "¿Cuántas horas he trabajado esta semana?"
    ],
    "gmail": [
      "Correos de clientes con solicitudes",
      "Notificaciones de pagos",
      "Nuevas oportunidades de trabajo"
    ],
    "calendar": [
      "Reuniones con clientes y deadlines de proyectos"
    ]
  }'::jsonb,
  '{
    "summary_length": "balanced",
    "summary_tone": "friendly",
    "use_emojis": true,
    "group_by_category": true,
    "include_action_items": true
  }'::jsonb
) ON CONFLICT (template_pack_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  target_audience = EXCLUDED.target_audience,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  template_structure = EXCLUDED.template_structure,
  default_rag_queries = EXCLUDED.default_rag_queries,
  suggested_preferences = EXCLUDED.suggested_preferences,
  updated_at = NOW();

-- =====================================================
-- 5. PLANTILLA: BÁSICO
-- =====================================================

INSERT INTO notion_template_catalog (
  template_pack_id,
  name,
  description,
  icon,
  target_audience,
  display_order,
  is_active,
  template_structure,
  default_rag_queries,
  suggested_preferences
) VALUES (
  'basic',
  '🌱 Básico',
  'Lo esencial para empezar: tareas, notas y lista de compras',
  '🌱',
  ARRAY['Todos', 'Principiantes en Notion'],
  5,
  true,
  '{
    "databases": [
      {
        "name": "My Tasks",
        "icon": "✅",
        "description": "Lista simple de tareas",
        "properties": {
          "Task": { "title": {} },
          "Done": { "checkbox": {} },
          "Date": { "date": {} },
          "Priority": {
            "select": {
              "options": [
                { "name": "High", "color": "red" },
                { "name": "Medium", "color": "yellow" },
                { "name": "Low", "color": "gray" }
              ]
            }
          }
        }
      },
      {
        "name": "Quick Notes",
        "icon": "📝",
        "description": "Notas rápidas",
        "properties": {
          "Title": { "title": {} },
          "Date": { "date": {} },
          "Tags": {
            "multi_select": {
              "options": [
                { "name": "Idea", "color": "yellow" },
                { "name": "Importante", "color": "red" },
                { "name": "Personal", "color": "blue" }
              ]
            }
          }
        }
      }
    ],
    "pages": [
      {
        "name": "Shopping List",
        "icon": "🛒",
        "content": [
          {
            "type": "heading_2",
            "heading_2": {
              "rich_text": [{ "text": { "content": "Lista de Compras" } }]
            }
          },
          {
            "type": "to_do",
            "to_do": {
              "rich_text": [{ "text": { "content": "Añade tus items aquí" } }],
              "checked": false
            }
          }
        ]
      }
    ]
  }'::jsonb,
  '{
    "notion": [
      "¿Qué tareas tengo pendientes?",
      "Muéstrame mis notas recientes"
    ],
    "gmail": [
      "Correos importantes"
    ],
    "calendar": [
      "Eventos de hoy"
    ]
  }'::jsonb,
  '{
    "summary_length": "brief",
    "summary_tone": "friendly",
    "use_emojis": true,
    "group_by_category": false,
    "include_action_items": false
  }'::jsonb
) ON CONFLICT (template_pack_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  target_audience = EXCLUDED.target_audience,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  template_structure = EXCLUDED.template_structure,
  default_rag_queries = EXCLUDED.default_rag_queries,
  suggested_preferences = EXCLUDED.suggested_preferences,
  updated_at = NOW();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver todas las plantillas insertadas
SELECT
  template_pack_id,
  name,
  is_active,
  display_order,
  created_at
FROM notion_template_catalog
ORDER BY display_order;

-- Contar plantillas activas
SELECT COUNT(*) as total_templates FROM notion_template_catalog WHERE is_active = true;
