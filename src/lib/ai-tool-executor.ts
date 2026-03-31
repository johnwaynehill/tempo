import type { AddTodoInput, TodosContextValue } from '@/context/TodosContext'
import type { EnergyLevel, TodoSize } from '@/types'

// The subset of context methods the AI tool executor needs
export interface ToolContext {
  addTodo: TodosContextValue['addTodo']
  updateTodo: TodosContextValue['updateTodo']
  completeTodo: TodosContextValue['completeTodo']
  pinToToday: TodosContextValue['pinToToday']
  deferTodo: TodosContextValue['deferTodo']
  moveToBacklog: TodosContextValue['moveToBacklog']
  dismissFromToday: TodosContextValue['dismissFromToday']
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
        const id = await ctx.addTodo(addInput)
        return {
          success: true,
          message: `Created todo "${addInput.title}" (id: ${id}, status: ${addInput.status ?? 'inbox'})`,
        }
      }

      case 'update_todo': {
        const todoId = input.todo_id as string
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
          message: `Updated todo ${todoId}: ${Object.keys(updates).join(', ')}`,
        }
      }

      case 'complete_todo': {
        await ctx.completeTodo(input.todo_id as string)
        return { success: true, message: `Completed todo ${input.todo_id}` }
      }

      case 'pin_to_today': {
        await ctx.pinToToday(input.todo_id as string)
        return { success: true, message: `Pinned todo ${input.todo_id} to Today` }
      }

      case 'defer_todo': {
        const until = input.until
          ? new Date((input.until as string) + 'T09:00:00')
          : undefined
        await ctx.deferTodo(input.todo_id as string, until)
        return {
          success: true,
          message: `Deferred todo ${input.todo_id}${until ? ` until ${input.until}` : ' until tomorrow'}`,
        }
      }

      case 'move_to_backlog': {
        await ctx.moveToBacklog(input.todo_id as string)
        return { success: true, message: `Moved todo ${input.todo_id} to Backlog` }
      }

      case 'dismiss_from_today': {
        await ctx.dismissFromToday(input.todo_id as string)
        return {
          success: true,
          message: `Dismissed todo ${input.todo_id} from Today`,
        }
      }

      default:
        return { success: false, message: `Unknown tool: ${toolName}` }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, message: `Error executing ${toolName}: ${msg}` }
  }
}
