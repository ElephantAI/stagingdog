
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export type SessionTransport = StreamableHTTPServerTransport

/**
 * Interface defining the shape of session data stored in the SessionStore.
 */
export interface SessionData {
  [key: string]: unknown;
}

export interface Session {
  id: string,
  transport: SessionTransport,
  data: SessionData
}

/**
 * In-memory session store for managing MCP sessions.
 * Uses a Map to store session data with session IDs as keys.
 */
export class SessionStore {
  private readonly sessions: Map<string, Session> = new Map();

  /**
   * Creates a new session with the given session ID and optional initial data.
   * @param sessionId - Unique identifier for the session
   * @param initialData - Optional initial data to store in the session
   * @throws {Error} If a session with the same ID already exists
   */
  public createSession(sessionId: string, transport: SessionTransport, initialData: SessionData = {}): Session {
    if (this.hasSession(sessionId)) {
      throw new Error(`Session with ID ${sessionId} already exists`);
    }

    const newSession:Session = { id:sessionId, transport, data: initialData }
    this.sessions.set(sessionId, newSession );
    return newSession
  }

  /**
   * Retrieves session data for the given session ID.
   * @param sessionId - The ID of the session to retrieve
   * @returns The session data, or undefined if not found
   */
  public getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Updates session data for the given session ID.
   * @param sessionId - The ID of the session to update
   * @param data - Partial data to update in the session
   * @throws {Error} If the session does not exist
   */
  public updateSession(sessionId: string, data: Partial<SessionData>): void {
    if (!this.hasSession(sessionId)) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const session:Session = this.getSession(sessionId)!;
    const updatedSessionData: SessionData = { ...session, ...data };
    session.data=updatedSessionData

  }

  /**
   * Deletes a session with the given session ID.
   * @param sessionId - The ID of the session to delete
   * @returns true if the session was deleted, false if it didn't exist
   */
  public deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Checks if a session with the given ID exists.
   * @param sessionId - The ID of the session to check
   * @returns true if the session exists, false otherwise
   */
  public hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Gets all session IDs currently stored in the session store.
   * @returns An array of all session IDs
   */
  public getAllSessionIds(): readonly string[] {
    return Array.from(this.sessions.keys());
  }
}

/**
 * Singleton instance of the SessionStore.
 * This should be used throughout the application to maintain a single source of truth for sessions.
 */
export const sessionStore = new SessionStore();
