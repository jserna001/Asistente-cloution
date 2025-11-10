/**
 * Script para poblar el catálogo de plantillas de Notion
 *
 * Uso:
 *   npx tsx scripts/seed-template-catalog.ts
 *
 * Este script inserta las 5 plantillas predeterminadas en la tabla
 * notion_template_catalog para que estén disponibles durante el onboarding.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: './.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan variables de entorno requeridas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =====================================================
// DEFINICIÓN DE PLANTILLAS
// =====================================================

const TEMPLATES = [
  {
    template_pack_id: 'student',
    name: '📚 Estudiante',
    description: 'Organiza tus clases, tareas y proyectos académicos con facilidad',
    icon: '📚',
    target_audience: ['Estudiantes', 'Cursos online', 'Universitarios'],
    display_order: 1,
    template_structure: {
      databases: [
        {
          name: 'Task Manager',
          icon: '✅',
          description: 'Gestiona tus tareas y entregas académicas',
          properties: {
            Name: {
              title: {}
            },
            Subject: {
              select: {
                options: [
                  { name: 'Matemáticas', color: 'blue' },
                  { name: 'Historia', color: 'red' },
                  { name: 'Ciencias', color: 'green' },
                  { name: 'Literatura', color: 'purple' },
                  { name: 'Inglés', color: 'yellow' }
                ]
              }
            },
            Status: {
              select: {
                options: [
                  { name: 'Por hacer', color: 'red' },
                  { name: 'En progreso', color: 'yellow' },
                  { name: 'Completada', color: 'green' }
                ]
              }
            },
            Priority: {
              select: {
                options: [
                  { name: 'Alta', color: 'red' },
                  { name: 'Media', color: 'yellow' },
                  { name: 'Baja', color: 'gray' }
                ]
              }
            },
            'Due Date': {
              date: {}
            },
            Type: {
              select: {
                options: [
                  { name: 'Tarea', color: 'blue' },
                  { name: 'Examen', color: 'red' },
                  { name: 'Proyecto', color: 'purple' }
                ]
              }
            }
          },
          views: [
            { name: 'All Tasks', type: 'table' },
            { name: 'By Subject', type: 'board', group_by: 'Subject' },
            { name: 'Calendar', type: 'calendar' }
          ]
        },
        {
          name: 'Class Notes',
          icon: '📝',
          description: 'Apuntes organizados por materia',
          properties: {
            Title: {
              title: {}
            },
            Subject: {
              select: {
                options: [
                  { name: 'Matemáticas', color: 'blue' },
                  { name: 'Historia', color: 'red' },
                  { name: 'Ciencias', color: 'green' }
                ]
              }
            },
            Date: {
              date: {}
            },
            Tags: {
              multi_select: {
                options: [
                  { name: 'Importante', color: 'red' },
                  { name: 'Examen', color: 'yellow' },
                  { name: 'Resumen', color: 'blue' }
                ]
              }
            }
          }
        },
        {
          name: 'Study Resources',
          icon: '📖',
          description: 'Libros, links y recursos de estudio',
          properties: {
            Name: {
              title: {}
            },
            Type: {
              select: {
                options: [
                  { name: 'Libro', color: 'blue' },
                  { name: 'Video', color: 'red' },
                  { name: 'Artículo', color: 'green' },
                  { name: 'Link', color: 'purple' }
                ]
              }
            },
            Subject: {
              select: {
                options: [{ name: 'General', color: 'gray' }]
              }
            },
            URL: {
              url: {}
            }
          }
        }
      ],
      pages: [
        {
          name: 'Weekly Schedule',
          icon: '📅',
          content: [
            {
              type: 'heading_2',
              heading_2: {
                rich_text: [{ text: { content: 'Mi Horario Semanal' } }]
              }
            },
            {
              type: 'paragraph',
              paragraph: {
                rich_text: [{
                  text: { content: 'Agrega aquí tu horario de clases semanal.' }
                }]
              }
            }
          ]
        }
      ]
    },
    default_rag_queries: {
      notion: [
        '¿Qué tareas tengo pendientes para esta semana?',
        '¿Hay exámenes próximos?',
        'Muéstrame mis proyectos en progreso'
      ],
      gmail: [
        'Correos de profesores sobre entregas',
        'Notificaciones de plataformas académicas'
      ],
      calendar: [
        'Clases y eventos académicos de hoy'
      ]
    },
    suggested_preferences: {
      summary_length: 'balanced',
      summary_tone: 'friendly',
      use_emojis: true,
      group_by_category: true,
      include_action_items: true
    }
  },

  {
    template_pack_id: 'professional',
    name: '💼 Profesional',
    description: 'Productividad laboral con proyectos, reuniones y knowledge base',
    icon: '💼',
    target_audience: ['Empleados', 'Project managers', 'Equipos remotos'],
    display_order: 2,
    template_structure: {
      databases: [
        {
          name: 'Task & Projects Manager',
          icon: '✅',
          description: 'Gestiona tareas y proyectos laborales',
          properties: {
            Task: {
              title: {}
            },
            Project: {
              select: {
                options: [
                  { name: 'Proyecto A', color: 'blue' },
                  { name: 'Proyecto B', color: 'green' },
                  { name: 'Personal', color: 'gray' }
                ]
              }
            },
            Status: {
              select: {
                options: [
                  { name: 'Backlog', color: 'gray' },
                  { name: 'To Do', color: 'red' },
                  { name: 'In Progress', color: 'yellow' },
                  { name: 'Done', color: 'green' }
                ]
              }
            },
            Priority: {
              select: {
                options: [
                  { name: '🔴 Urgente', color: 'red' },
                  { name: '🟡 Alta', color: 'yellow' },
                  { name: '🟢 Normal', color: 'green' }
                ]
              }
            },
            Deadline: {
              date: {}
            },
            Category: {
              select: {
                options: [
                  { name: 'Desarrollo', color: 'blue' },
                  { name: 'Diseño', color: 'purple' },
                  { name: 'Reunión', color: 'yellow' },
                  { name: 'Documentación', color: 'gray' }
                ]
              }
            }
          },
          views: [
            { name: 'My Tasks Today', type: 'table' },
            { name: 'Kanban by Project', type: 'board', group_by: 'Project' },
            { name: 'Timeline', type: 'timeline' }
          ]
        },
        {
          name: 'Meeting Notes',
          icon: '📝',
          description: 'Notas de reuniones con action items',
          properties: {
            Title: {
              title: {}
            },
            Date: {
              date: {}
            },
            Participants: {
              multi_select: {
                options: [{ name: 'Team', color: 'blue' }]
              }
            },
            Project: {
              select: {
                options: [{ name: 'General', color: 'gray' }]
              }
            }
          }
        }
      ],
      pages: [
        {
          name: 'Weekly Dashboard',
          icon: '📊',
          content: [
            {
              type: 'heading_1',
              heading_1: {
                rich_text: [{ text: { content: 'Dashboard Semanal' } }]
              }
            }
          ]
        }
      ]
    },
    default_rag_queries: {
      notion: [
        '¿Qué tareas urgentes tengo hoy?',
        'Muéstrame las reuniones de esta semana con sus action items',
        '¿Cuál es el estado de mis proyectos?'
      ],
      gmail: [
        'Correos de mi jefe o manager',
        'Emails marcados como urgentes',
        'Notificaciones de herramientas de trabajo'
      ],
      calendar: [
        'Reuniones de hoy y preparación necesaria'
      ]
    },
    suggested_preferences: {
      summary_length: 'balanced',
      summary_tone: 'professional',
      use_emojis: false,
      group_by_category: true,
      include_action_items: true
    }
  },

  {
    template_pack_id: 'entrepreneur',
    name: '🚀 Emprendedor',
    description: 'Gestión completa de negocio: OKRs, CRM, finanzas y roadmap',
    icon: '🚀',
    target_audience: ['Fundadores', 'Startups', 'Negocios pequeños'],
    display_order: 3,
    template_structure: {
      databases: [
        {
          name: 'OKRs & Goals',
          icon: '🎯',
          description: 'Objetivos y resultados clave',
          properties: {
            Objective: {
              title: {}
            },
            Quarter: {
              select: {
                options: [
                  { name: 'Q1', color: 'blue' },
                  { name: 'Q2', color: 'green' },
                  { name: 'Q3', color: 'yellow' },
                  { name: 'Q4', color: 'red' }
                ]
              }
            },
            Progress: {
              number: {
                format: 'percent'
              }
            }
          }
        },
        {
          name: 'CRM - Clients & Leads',
          icon: '👥',
          description: 'Gestión de clientes y oportunidades',
          properties: {
            Name: {
              title: {}
            },
            Company: {
              rich_text: {}
            },
            Status: {
              select: {
                options: [
                  { name: 'Lead', color: 'gray' },
                  { name: 'Prospecto', color: 'yellow' },
                  { name: 'Cliente', color: 'green' },
                  { name: 'Inactivo', color: 'red' }
                ]
              }
            },
            Stage: {
              select: {
                options: [
                  { name: 'Contacto inicial', color: 'blue' },
                  { name: 'Propuesta', color: 'yellow' },
                  { name: 'Negociación', color: 'orange' },
                  { name: 'Cerrado', color: 'green' }
                ]
              }
            },
            'Potential Value': {
              number: {
                format: 'dollar'
              }
            },
            'Next Follow-up': {
              date: {}
            }
          },
          views: [
            { name: 'All Contacts', type: 'table' },
            { name: 'Sales Pipeline', type: 'board', group_by: 'Stage' }
          ]
        }
      ],
      pages: []
    },
    default_rag_queries: {
      notion: [
        '¿Qué clientes requieren seguimiento esta semana?',
        'Muéstrame el progreso de mis OKRs del trimestre',
        '¿Cuáles son las oportunidades de negocio activas?'
      ],
      gmail: [
        'Correos de clientes o leads',
        'Oportunidades de negocio',
        'Facturas o pagos pendientes'
      ],
      calendar: [
        'Calls con clientes y eventos de networking'
      ]
    },
    suggested_preferences: {
      summary_length: 'detailed',
      summary_tone: 'motivational',
      use_emojis: true,
      group_by_category: true,
      include_action_items: true
    }
  },

  {
    template_pack_id: 'freelancer',
    name: '🎨 Freelancer',
    description: 'Proyectos, clientes, time tracking y facturación',
    icon: '🎨',
    target_audience: ['Freelancers', 'Consultores', 'Trabajadores independientes'],
    display_order: 4,
    template_structure: {
      databases: [
        {
          name: 'Projects',
          icon: '💼',
          description: 'Gestión de proyectos freelance',
          properties: {
            'Project Name': {
              title: {}
            },
            Client: {
              select: {
                options: [{ name: 'New Client', color: 'gray' }]
              }
            },
            Status: {
              select: {
                options: [
                  { name: 'Prospecto', color: 'gray' },
                  { name: 'En curso', color: 'blue' },
                  { name: 'Entregado', color: 'green' },
                  { name: 'Facturado', color: 'purple' }
                ]
              }
            },
            'Start Date': {
              date: {}
            },
            'Due Date': {
              date: {}
            },
            'Amount': {
              number: {
                format: 'dollar'
              }
            },
            'Hours Estimated': {
              number: {}
            },
            'Hours Worked': {
              number: {}
            }
          },
          views: [
            { name: 'Active Projects', type: 'table' },
            { name: 'By Due Date', type: 'calendar' }
          ]
        },
        {
          name: 'Clients',
          icon: '👥',
          description: 'Base de datos de clientes',
          properties: {
            Name: {
              title: {}
            },
            Company: {
              rich_text: {}
            },
            Email: {
              email: {}
            },
            Phone: {
              phone_number: {}
            }
          }
        }
      ],
      pages: []
    },
    default_rag_queries: {
      notion: [
        '¿Qué proyectos tengo activos y cuáles son sus deadlines?',
        '¿Hay facturas pendientes de pago?',
        '¿Cuántas horas he trabajado esta semana?'
      ],
      gmail: [
        'Correos de clientes con solicitudes',
        'Notificaciones de pagos',
        'Nuevas oportunidades de trabajo'
      ],
      calendar: [
        'Reuniones con clientes y deadlines de proyectos'
      ]
    },
    suggested_preferences: {
      summary_length: 'balanced',
      summary_tone: 'friendly',
      use_emojis: true,
      group_by_category: true,
      include_action_items: true
    }
  },

  {
    template_pack_id: 'basic',
    name: '🌱 Básico',
    description: 'Lo esencial para empezar: tareas, notas y lista de compras',
    icon: '🌱',
    target_audience: ['Todos', 'Principiantes en Notion'],
    display_order: 5,
    template_structure: {
      databases: [
        {
          name: 'My Tasks',
          icon: '✅',
          description: 'Lista simple de tareas',
          properties: {
            Task: {
              title: {}
            },
            Done: {
              checkbox: {}
            },
            Date: {
              date: {}
            },
            Priority: {
              select: {
                options: [
                  { name: 'High', color: 'red' },
                  { name: 'Medium', color: 'yellow' },
                  { name: 'Low', color: 'gray' }
                ]
              }
            }
          }
        },
        {
          name: 'Quick Notes',
          icon: '📝',
          description: 'Notas rápidas',
          properties: {
            Title: {
              title: {}
            },
            Date: {
              date: {}
            },
            Tags: {
              multi_select: {
                options: [
                  { name: 'Idea', color: 'yellow' },
                  { name: 'Importante', color: 'red' },
                  { name: 'Personal', color: 'blue' }
                ]
              }
            }
          }
        }
      ],
      pages: [
        {
          name: 'Shopping List',
          icon: '🛒',
          content: [
            {
              type: 'heading_2',
              heading_2: {
                rich_text: [{ text: { content: 'Lista de Compras' } }]
              }
            },
            {
              type: 'to_do',
              to_do: {
                rich_text: [{ text: { content: 'Añade tus items aquí' } }],
                checked: false
              }
            }
          ]
        }
      ]
    },
    default_rag_queries: {
      notion: [
        '¿Qué tareas tengo pendientes?',
        'Muéstrame mis notas recientes'
      ],
      gmail: [
        'Correos importantes'
      ],
      calendar: [
        'Eventos de hoy'
      ]
    },
    suggested_preferences: {
      summary_length: 'brief',
      summary_tone: 'friendly',
      use_emojis: true,
      group_by_category: false,
      include_action_items: false
    }
  }
];

// =====================================================
// FUNCIÓN PRINCIPAL
// =====================================================

async function seedTemplateCatalog() {
  console.log('🌱 Iniciando seed del catálogo de plantillas...\n');

  for (const template of TEMPLATES) {
    try {
      console.log(`Procesando: ${template.name}...`);

      const { data, error } = await supabase
        .from('notion_template_catalog')
        .upsert(template, {
          onConflict: 'template_pack_id'
        })
        .select();

      if (error) {
        console.error(`  ❌ Error: ${error.message}`);
      } else {
        console.log(`  ✅ Insertado/actualizado exitosamente`);
      }
    } catch (err: any) {
      console.error(`  ❌ Error inesperado:`, err.message);
    }
  }

  console.log('\n🎉 Seed completado!\n');

  // Verificar
  const { data: allTemplates, error: countError } = await supabase
    .from('notion_template_catalog')
    .select('template_pack_id, name, is_active')
    .order('display_order');

  if (countError) {
    console.error('Error verificando plantillas:', countError);
  } else {
    console.log('📋 Plantillas en el catálogo:');
    allTemplates?.forEach(t => {
      console.log(`  - ${t.name} (${t.template_pack_id}) ${t.is_active ? '✓' : '✗'}`);
    });
  }
}

// Ejecutar
seedTemplateCatalog()
  .then(() => {
    console.log('\n✨ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });
