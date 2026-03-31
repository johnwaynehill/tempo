import type Anthropic from '@anthropic-ai/sdk'

export type ToolDefinition = Anthropic.Tool

export const AI_TOOLS: ToolDefinition[] = [
  {
    name: 'create_todo',
    description:
      'Create a new todo. Use this to break tasks into smaller steps, add new items to the backlog, or capture quick tasks. Each todo is a standalone top-level item (not a sub-task).',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'The title of the todo',
        },
        status: {
          type: 'string',
          enum: ['inbox', 'today_pinned', 'backlog'],
          description:
            'Where to place the todo. Use "inbox" for unsorted, "today_pinned" for today, "backlog" for later. Defaults to inbox.',
        },
        project: {
          type: 'string',
          description: 'Optional project name to group the todo under',
        },
        energy_level: {
          type: 'string',
          enum: ['low', 'medium_low', 'medium', 'high'],
          description: 'Energy required for this todo',
        },
        size: {
          type: 'string',
          enum: ['small', 'medium', 'large'],
          description: 'Estimated effort size',
        },
        impact: {
          type: 'number',
          minimum: 1,
          maximum: 5,
          description: 'Impact score from 1 (low) to 5 (high)',
        },
        due_date: {
          type: 'string',
          description: 'Due date in ISO format (YYYY-MM-DD)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_todo',
    description:
      'Update an existing todo. Use this to change title, project, energy, size, impact, or due date.',
    input_schema: {
      type: 'object' as const,
      properties: {
        todo_id: {
          type: 'string',
          description: 'The ID of the todo to update',
        },
        title: { type: 'string' },
        project: { type: 'string' },
        energy_level: {
          type: 'string',
          enum: ['low', 'medium_low', 'medium', 'high'],
        },
        size: { type: 'string', enum: ['small', 'medium', 'large'] },
        impact: { type: 'number', minimum: 1, maximum: 5 },
        due_date: { type: 'string', description: 'ISO date (YYYY-MM-DD)' },
      },
      required: ['todo_id'],
    },
  },
  {
    name: 'complete_todo',
    description: 'Mark a todo as done.',
    input_schema: {
      type: 'object' as const,
      properties: {
        todo_id: {
          type: 'string',
          description: 'The ID of the todo to complete',
        },
      },
      required: ['todo_id'],
    },
  },
  {
    name: 'pin_to_today',
    description:
      'Pin a todo to the Today list so the user sees it today.',
    input_schema: {
      type: 'object' as const,
      properties: {
        todo_id: {
          type: 'string',
          description: 'The ID of the todo to pin to today',
        },
      },
      required: ['todo_id'],
    },
  },
  {
    name: 'defer_todo',
    description:
      'Defer a todo to a future date. Removes it from today and sets a defer-until date.',
    input_schema: {
      type: 'object' as const,
      properties: {
        todo_id: {
          type: 'string',
          description: 'The ID of the todo to defer',
        },
        until: {
          type: 'string',
          description: 'Defer until this date (ISO YYYY-MM-DD). Defaults to tomorrow.',
        },
      },
      required: ['todo_id'],
    },
  },
  {
    name: 'move_to_backlog',
    description: 'Move a todo to the Backlog.',
    input_schema: {
      type: 'object' as const,
      properties: {
        todo_id: {
          type: 'string',
          description: 'The ID of the todo to move to backlog',
        },
      },
      required: ['todo_id'],
    },
  },
  {
    name: 'dismiss_from_today',
    description:
      'Dismiss a todo from the Today list without completing or deferring it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        todo_id: {
          type: 'string',
          description: 'The ID of the todo to dismiss from today',
        },
      },
      required: ['todo_id'],
    },
  },
]
