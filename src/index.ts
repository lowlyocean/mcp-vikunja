import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import TimeAgo from 'javascript-time-ago'
// Load locale-specific relative date/time formatting rules.
import en from 'javascript-time-ago/locale/en'
// Add locale-specific relative date/time formatting rules.
TimeAgo.addLocale(en)
// Create relative date/time formatter.
const timeAgo = new TimeAgo('en-US')

// Create server instance
const server = new McpServer({
  name: "vikunja",
  version: "1.0.0",
});

// Helper function to create Vikunja reminder
async function putVikunjaReminder<T>(url: string, title: string, due_date: string): Promise<T | null> {
    const headers = {
      Authorization: `Bearer ${process.env.CREATE_TASK_TOKEN}`,
      'Content-Type': 'application/json',
    };
    const body = { title, due_date };
    try {
      const response = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, message: ${ ((await response.json()) as FailedVikunjaResponse).message || ''}}`);
      }
      return `Your reminder is ${title}` as T;
    } catch (error) {
      console.error("Error setting Vikunja reminder:", error);
      return null;
    }
  }
  
// Helper function to get all Vikunja reminders during next hour
async function getVikunjaReminders<T>(url: string): Promise<T | null> {
    const headers = {
      Authorization: `Bearer ${process.env.GET_TASKS_TOKEN}`,
    };
    try {
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, message: ${ ((await response.json()) as FailedVikunjaResponse).message || ''}}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      console.error("Error getting Vikunja reminders:", error);
      return null;
    }
  }

  interface Reminder {
    title: string;
    due_date: string;
  }

  interface FailedVikunjaResponse {
    message: string;
  }

  interface RemindersResponse extends Array<Reminder>{}

    // Format reminder data
  function formatReminder(reminder: Reminder): string {
    return [
      `${reminder.title || "Unknown"} ${timeAgo.format(new Date(reminder.due_date)) || "Unknown"}`,
      "---",
    ].join("\n");
  }

  server.tool(
    "set-reminder-at-time",
    "Set a reminder at a specific time",
    {
        title: z.string().describe("Description of the reminder"),
        due_date: z.string().datetime({ local: true, offset: true }).describe(`ISO 8601 time, with seconds, in ${Intl.DateTimeFormat().resolvedOptions().timeZone} IANA time zone`)
    },
    async ({ title, due_date }) => {
      const setRemindUrl = `${process.env.VIKUNJA_API_BASE}/api/v1/projects/1/tasks`;
      let confirmation;
      try {
        confirmation = await putVikunjaReminder<string>(setRemindUrl, title, new Date(due_date).toISOString());
      } catch (error) {
        confirmation = null;
      }
  
      if (!confirmation) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to set reminder",
            },
          ],
        };
      }

      return {
        content: [
          {
              type: "text",
              text: confirmation,
          },
        ],
      };
    },
  );
  
  server.tool(
    "get-reminders",
    "Get all reminders scheduled within the next hour",
    {},
    async ({}) => {
      const timezoneOffset = new Date().getTimezoneOffset()/60;
      const fromDt = `now%2B${timezoneOffset}h`;
      const toDt = `now%2B${timezoneOffset+1}h`;
      const getRemindersUrl = `${process.env.VIKUNJA_API_BASE}/api/v1/projects/1/views/1/tasks?filter=done+%3D+false+%26%26+due_date+%3E%3D+${fromDt}+%26%26+due_date+%3C%3D+${toDt}&filter_include_nulls=false&filter_timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}&s=&expand=subtasks&page=1`;
      let remindersData;
      try {
        remindersData = await getVikunjaReminders<RemindersResponse>(getRemindersUrl);
      } catch (error) {
        remindersData = null;
      }
  
      if (!remindersData) {
        return {
          content: [
            {
              type: "text",
              text: 'Failed to get reminders.',
            },
          ],
        };
      }
      
      if (remindersData.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No reminders found.",
            },
          ],
        };
      }
  
      const formattedReminders = remindersData.map(formatReminder);
      const remindersText = `${formattedReminders.join("\n")}`;
  
      return {
        content: [
          {
            type: "text",
            text: remindersText,
          },
        ],
      };
    },
  );

  async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Vikunja MCP Server running on stdio");
  }
  
  main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });