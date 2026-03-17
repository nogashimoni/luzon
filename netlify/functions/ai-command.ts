import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface Project {
  id: string
  title: string
  status: string
  project_type: string
  deadline: string | null
}

interface RequestBody {
  message: string
  projects: Project[]
  currentDate: string
}

export const handler = async (event: { httpMethod: string; body: string | null }) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { message, projects, currentDate }: RequestBody = JSON.parse(event.body ?? '{}')

    const projectList = projects
      .map((p) => `- "${p.title}" (id: ${p.id}, status: ${p.status}, type: ${p.project_type}${p.deadline ? `, deadline: ${p.deadline}` : ''})`)
      .join('\n')

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      output_config: { effort: 'low' },
      system: `You are an AI assistant for a project management app. Today is ${currentDate}.

Available projects:
${projectList || '(no projects yet)'}

The user will give you a natural language instruction. Call the execute_action tool with the appropriate structured action.

Supported actions:
- add_task: add a task/checklist item to a project
- complete_task: mark a task as done in a project
- set_deadline: set or remove a project deadline (date format: YYYY-MM-DD, or null to remove)
- update_note: update a project's notes
- change_status: change project status (in_progress | waiting_payment | completed)
- create_event: create a calendar event (infer date/time from natural language using today's date)
- change_type: change project type (retainer | one_time)
- message: when you can't determine a clear action, respond with a helpful message

Match project names case-insensitively and by partial match. For dates, interpret natural language like "tomorrow", "next Monday", "in 3 days" relative to today.`,
      tools: [
        {
          name: 'execute_action',
          description: 'Execute the requested project management action',
          input_schema: {
            type: 'object' as const,
            properties: {
              action: {
                type: 'string',
                enum: ['add_task', 'complete_task', 'set_deadline', 'update_note', 'change_status', 'create_event', 'change_type', 'message'],
                description: 'The type of action to perform',
              },
              project_id: { type: 'string', description: 'The project ID (for project-related actions)' },
              project_name: { type: 'string', description: 'The project name as referenced by the user' },
              task_text: { type: 'string', description: 'Task text (for add_task or complete_task)' },
              deadline_date: { type: ['string', 'null'], description: 'Deadline date in YYYY-MM-DD format, or null to remove' },
              note_content: { type: 'string', description: 'Note content (for update_note)' },
              status: { type: 'string', enum: ['in_progress', 'waiting_payment', 'completed'], description: 'New project status' },
              project_type: { type: 'string', enum: ['retainer', 'one_time'], description: 'New project type' },
              event_title: { type: 'string', description: 'Calendar event title' },
              event_date: { type: 'string', description: 'Event date in YYYY-MM-DD format' },
              event_start_time: { type: 'string', description: 'Event start time in HH:MM format (24h), or null for all-day' },
              event_end_time: { type: 'string', description: 'Event end time in HH:MM format (24h)' },
              event_all_day: { type: 'boolean', description: 'Whether this is an all-day event' },
              message: { type: 'string', description: 'Response message to show the user' },
            },
            required: ['action'],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'execute_action' },
      messages: [{ role: 'user', content: message }],
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'message', message: "I couldn't understand that. Try again." }),
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toolUse.input),
    }
  } catch (err) {
    console.error('ai-command error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'message', message: 'Something went wrong. Please try again.' }),
    }
  }
}
