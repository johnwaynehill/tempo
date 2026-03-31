import type { AddTodoInput, TodosContextValue } from '@/context/TodosContext'
import type { EnergyLevel, Todo, TodoSize } from '@/types'

// The subset of context methods the AI tool executor needs
export interface ToolContext {
  todos: Todo[]
  addTodo: TodosContextValue['addTodo']
  updateTodo: TodosContextValue['updateTodo']
  completeTodo: TodosContextValue['completeTodo']
  pinToToday: TodosContextValue['pinToToday']
  deferTodo: TodosContextValue['deferTodo']
  moveToBacklog: TodosContextValue['moveToBacklog']
  dismissFromToday: TodosContextValue['dismissFromToday']
}

function todoTitle(ctx: ToolContext, id: string): string {
  const todo = ctx.todos.find((t) => t.id === id)
  return todo ? `"${todo.title}"` : id.slice(0, 8)
}

export interface ToolResult {
  success: boolean
  message: string
}

export async function executeToolCall(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'create_todo': {
        const addInput: AddTodoInput = {
          title: input.title as string,
          status: (input.status as AddTodoInput['status']) ?? 'inbox',
          project: input.project as string | undefined,
          energy_level: input.energy_level as EnergyLevel | undefined,
          size: input.size as TodoSize | undefined,
          impact: input.impact as number | undefined,
          due_date: input.due_date
            ? new Date((input.due_date as string) + 'T00:00:00')
            : undefined,
        }
        await ctx.addTodo(addInput)
        return {
          success: true,
          message: `Created "${addInput.title}"`,
        }
      }

      case 'update_todo': {
        const todoId = input.todo_id as string
        const name = todoTitle(ctx, todoId)
        const updates: Record<string, unknown> = {}
        if (input.title !== undefined) updates.title = input.title
        if (input.project !== undefined) updates.project = input.project
        if (input.energy_level !== undefined) updates.energy_level = input.energy_level
        if (input.size !== undefined) updates.size = input.size
        if (input.impact !== undefined) updates.impact = input.impact
        if (input.due_date !== undefined) {
          updates.due_date = new Date((input.due_date as string) + 'T00:00:00')
        }
        await ctx.updateTodo(todoId, updates)
        return {
          success: true,
          message: `Updated ${name}`,
        }
      }

      case 'complete_todo': {
        const name = todoTitle(ctx, input.todo_id as string)
        await ctx.completeTodo(input.todo_id as string)
        return { success: true, message: `Done: ${name}` }
      }

      case 'pin_to_today': {
        const name = todoTitle(ctx, input.todo_id as string)
        await ctx.pinToToday(input.todo_id as string)
        return { success: true, message: `Pinned: ${name}` }
      }

      case 'defer_todo': {
        const name = todoTitle(ctx, input.todo_id as string)
        const until = input.until
          ? new Date((input.until as string) + 'T09:00:00')
          : undefined
        await ctx.deferTodo(input.todo_id as string, until)
        return { success: true, message: `Deferred: ${name}` }
      }

      case 'move_to_backlog': {
        const name = todoTitle(ctx, input.todo_id as string)
        await ctx.moveToBacklog(input.todo_id as string)
        return { success: true, message: `Backlogged: ${name}` }
      }

      case 'dismiss_from_today': {
        const name = todoTitle(ctx, input.todo_id as string)
        await ctx.dismissFromToday(input.todo_id as string)
        return { success: true, message: `Dismissed: ${name}` }
      }

      default:
        return { success: false, message: `Unknown tool: ${toolName}` }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, message: `Error executing ${toolName}: ${msg}` }
  }
}
