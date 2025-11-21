/**
 * Calendar Provider Abstraction Layer
 * Supports multiple calendar providers: Google, Outlook, Calendly
 */

export type CalendarProvider = "google" | "outlook" | "calendly";

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  htmlLink?: string;
}

export interface CalendarConnection {
  id: string;
  business_id: string;
  program_id: string | null;
  provider: CalendarProvider;
  calendar_id: string;
  email: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
  provider_config?: any;
  api_key?: string | null;
  external_calendar_url?: string | null;
}

export interface CalendarProviderAdapter {
  refreshToken(connection: CalendarConnection): Promise<string>;
  createEvent(connection: CalendarConnection, event: CalendarEvent): Promise<CalendarEvent>;
  getEvent(connection: CalendarConnection, eventId: string): Promise<CalendarEvent>;
  updateEvent(connection: CalendarConnection, eventId: string, event: CalendarEvent): Promise<CalendarEvent>;
  deleteEvent(connection: CalendarConnection, eventId: string): Promise<void>;
  checkAvailability(
    connection: CalendarConnection,
    startTime: Date,
    endTime: Date
  ): Promise<{ available: boolean; conflictingEvents: CalendarEvent[] }>;
  listEvents(
    connection: CalendarConnection,
    timeMin: Date,
    timeMax: Date
  ): Promise<CalendarEvent[]>;
}

// Google Calendar Provider
class GoogleCalendarProvider implements CalendarProviderAdapter {
  async refreshToken(connection: CalendarConnection): Promise<string> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: connection.refresh_token!,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to refresh Google token: ${error.error_description || error.error}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async createEvent(connection: CalendarConnection, event: CalendarEvent): Promise<CalendarEvent> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create Google event: ${error.error?.message || JSON.stringify(error)}`);
    }

    return await response.json();
  }

  async getEvent(connection: CalendarConnection, eventId: string): Promise<CalendarEvent> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events/${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get Google event: ${error.error?.message || JSON.stringify(error)}`);
    }

    return await response.json();
  }

  async updateEvent(
    connection: CalendarConnection,
    eventId: string,
    event: CalendarEvent
  ): Promise<CalendarEvent> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events/${eventId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to update Google event: ${error.error?.message || JSON.stringify(error)}`);
    }

    return await response.json();
  }

  async deleteEvent(connection: CalendarConnection, eventId: string): Promise<void> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events/${eventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      throw new Error(`Failed to delete Google event: ${error.error?.message || JSON.stringify(error)}`);
    }
  }

  async checkAvailability(
    connection: CalendarConnection,
    startTime: Date,
    endTime: Date
  ): Promise<{ available: boolean; conflictingEvents: CalendarEvent[] }> {
    const events = await this.listEvents(connection, startTime, endTime);
    return {
      available: events.length === 0,
      conflictingEvents: events,
    };
  }

  async listEvents(
    connection: CalendarConnection,
    timeMin: Date,
    timeMax: Date
  ): Promise<CalendarEvent[]> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${connection.calendar_id}/events?` +
        `timeMin=${encodeURIComponent(timeMin.toISOString())}&` +
        `timeMax=${encodeURIComponent(timeMax.toISOString())}&` +
        `singleEvents=true&` +
        `orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to list Google events: ${error.error?.message || JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.items || [];
  }
}

// Outlook Calendar Provider
class OutlookCalendarProvider implements CalendarProviderAdapter {
  async refreshToken(connection: CalendarConnection): Promise<string> {
    // Outlook uses Microsoft Graph API
    const tenantId = connection.provider_config?.tenant_id || "common";
    const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID!,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
        refresh_token: connection.refresh_token!,
        grant_type: "refresh_token",
        scope: "https://graph.microsoft.com/Calendars.ReadWrite",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to refresh Outlook token: ${error.error_description || error.error}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async createEvent(connection: CalendarConnection, event: CalendarEvent): Promise<CalendarEvent> {
    // Microsoft Graph API format
    const graphEvent = {
      subject: event.summary,
      body: {
        contentType: "HTML",
        content: event.description,
      },
      start: {
        dateTime: event.start.dateTime,
        timeZone: event.start.timeZone,
      },
      end: {
        dateTime: event.end.dateTime,
        timeZone: event.end.timeZone,
      },
    };

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendars/${connection.calendar_id}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(graphEvent),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create Outlook event: ${error.error?.message || JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      summary: data.subject,
      description: data.body?.content || "",
      start: data.start,
      end: data.end,
      htmlLink: data.webLink,
    };
  }

  async getEvent(connection: CalendarConnection, eventId: string): Promise<CalendarEvent> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendars/${connection.calendar_id}/events/${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get Outlook event: ${error.error?.message || JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      summary: data.subject,
      description: data.body?.content || "",
      start: data.start,
      end: data.end,
      htmlLink: data.webLink,
    };
  }

  async updateEvent(
    connection: CalendarConnection,
    eventId: string,
    event: CalendarEvent
  ): Promise<CalendarEvent> {
    const graphEvent = {
      subject: event.summary,
      body: {
        contentType: "HTML",
        content: event.description,
      },
      start: {
        dateTime: event.start.dateTime,
        timeZone: event.start.timeZone,
      },
      end: {
        dateTime: event.end.dateTime,
        timeZone: event.end.timeZone,
      },
    };

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendars/${connection.calendar_id}/events/${eventId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(graphEvent),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to update Outlook event: ${error.error?.message || JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      summary: data.subject,
      description: data.body?.content || "",
      start: data.start,
      end: data.end,
      htmlLink: data.webLink,
    };
  }

  async deleteEvent(connection: CalendarConnection, eventId: string): Promise<void> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendars/${connection.calendar_id}/events/${eventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      throw new Error(`Failed to delete Outlook event: ${error.error?.message || JSON.stringify(error)}`);
    }
  }

  async checkAvailability(
    connection: CalendarConnection,
    startTime: Date,
    endTime: Date
  ): Promise<{ available: boolean; conflictingEvents: CalendarEvent[] }> {
    const events = await this.listEvents(connection, startTime, endTime);
    return {
      available: events.length === 0,
      conflictingEvents: events,
    };
  }

  async listEvents(
    connection: CalendarConnection,
    timeMin: Date,
    timeMax: Date
  ): Promise<CalendarEvent[]> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendars/${connection.calendar_id}/calendarView?` +
        `startDateTime=${encodeURIComponent(timeMin.toISOString())}&` +
        `endDateTime=${encodeURIComponent(timeMax.toISOString())}`,
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to list Outlook events: ${error.error?.message || JSON.stringify(error)}`);
    }

    const data = await response.json();
    return (data.value || []).map((item: any) => ({
      id: item.id,
      summary: item.subject,
      description: item.body?.content || "",
      start: item.start,
      end: item.end,
      htmlLink: item.webLink,
    }));
  }
}

// Calendly Provider (uses Calendly API)
class CalendlyProvider implements CalendarProviderAdapter {
  async refreshToken(connection: CalendarConnection): Promise<string> {
    // Calendly uses API keys, not OAuth tokens
    // If using OAuth, implement token refresh here
    if (!connection.api_key) {
      throw new Error("Calendly API key not found");
    }
    return connection.api_key;
  }

  async createEvent(connection: CalendarConnection, event: CalendarEvent): Promise<CalendarEvent> {
    // Calendly doesn't support direct event creation via API
    // Instead, we create a scheduling link or use webhooks
    // For now, we'll use the external_calendar_url if available
    throw new Error(
      "Calendly doesn't support direct event creation. Use scheduling links instead."
    );
  }

  async getEvent(connection: CalendarConnection, eventId: string): Promise<CalendarEvent> {
    // Calendly API endpoint
    const response = await fetch(`https://api.calendly.com/scheduled_events/${eventId}`, {
      headers: {
        Authorization: `Bearer ${connection.api_key!}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get Calendly event: ${error.message || JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      id: data.resource.uri.split("/").pop() || data.resource.uri,
      summary: data.resource.name,
      description: data.resource.description || "",
      start: {
        dateTime: data.resource.start_time,
        timeZone: data.resource.timezone || "UTC",
      },
      end: {
        dateTime: data.resource.end_time,
        timeZone: data.resource.timezone || "UTC",
      },
      htmlLink: data.resource.location?.location || data.resource.uri,
    };
  }

  async updateEvent(
    connection: CalendarConnection,
    eventId: string,
    event: CalendarEvent
  ): Promise<CalendarEvent> {
    // Calendly doesn't support event updates via API
    throw new Error("Calendly doesn't support event updates via API");
  }

  async deleteEvent(connection: CalendarConnection, eventId: string): Promise<void> {
    // Calendly API endpoint
    const response = await fetch(`https://api.calendly.com/scheduled_events/${eventId}/cancellation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.api_key!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: "Cancelled via AI Receptionist",
      }),
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      throw new Error(`Failed to cancel Calendly event: ${error.message || JSON.stringify(error)}`);
    }
  }

  async checkAvailability(
    connection: CalendarConnection,
    startTime: Date,
    endTime: Date
  ): Promise<{ available: boolean; conflictingEvents: CalendarEvent[] }> {
    // Calendly availability is checked via their availability API
    // For now, we'll list events and check conflicts
    const events = await this.listEvents(connection, startTime, endTime);
    return {
      available: events.length === 0,
      conflictingEvents: events,
    };
  }

  async listEvents(
    connection: CalendarConnection,
    timeMin: Date,
    timeMax: Date
  ): Promise<CalendarEvent[]> {
    // Calendly API endpoint
    const response = await fetch(
      `https://api.calendly.com/scheduled_events?` +
        `user=${connection.email}&` +
        `min_start_time=${encodeURIComponent(timeMin.toISOString())}&` +
        `max_start_time=${encodeURIComponent(timeMax.toISOString())}`,
      {
        headers: {
          Authorization: `Bearer ${connection.api_key!}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to list Calendly events: ${error.message || JSON.stringify(error)}`);
    }

    const data = await response.json();
    return (data.collection || []).map((item: any) => ({
      id: item.uri.split("/").pop() || item.uri,
      summary: item.name,
      description: item.description || "",
      start: {
        dateTime: item.start_time,
        timeZone: item.timezone || "UTC",
      },
      end: {
        dateTime: item.end_time,
        timeZone: item.timezone || "UTC",
      },
      htmlLink: item.location?.location || item.uri,
    }));
  }
}

// Provider factory
export function getCalendarProvider(provider: CalendarProvider): CalendarProviderAdapter {
  switch (provider) {
    case "google":
      return new GoogleCalendarProvider();
    case "outlook":
      return new OutlookCalendarProvider();
    case "calendly":
      return new CalendlyProvider();
    default:
      throw new Error(`Unsupported calendar provider: ${provider}`);
  }
}

// Helper to ensure token is fresh
export async function ensureFreshToken(
  connection: CalendarConnection,
  adapter: CalendarProviderAdapter
): Promise<string> {
  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

  if (expiresAt.getTime() - now.getTime() < bufferTime) {
    // Token is expired or about to expire, refresh it
    return await adapter.refreshToken(connection);
  }

  return connection.access_token;
}


