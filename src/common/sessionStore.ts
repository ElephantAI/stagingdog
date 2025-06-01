
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export type SessionTransport = StreamableHTTPServerTransport

/**
 * Interface defining the shape of session data stored in the SessionStore.
 */
export interface SessionData {
  [key: string]: unknown;
}


export class Session {
  id: string;
  transport: SessionTransport;
  data: SessionData;
  // @ts-ignore
  touchedAt: number

  constructor(id: string, transport: SessionTransport, data: SessionData = {}) {
    this.id = id;
    this.transport = transport;
    this.data = data;
    this.touch()
  }

  touch() {
    this.touchedAt = Date.now();
  }

}

/**
 * In-memory session store for managing MCP sessions.
 * Uses a Map to store session data with session IDs as keys.
 */
export class SessionStore {
  private readonly sessions: Map<string, Session> = new Map();


  public add(session:Session) {
    if (this.hasSession(session.id)) {
      throw new Error(`Session with ID ${session.id} already exists`);
    }
    this.sessions.set(session.id, session );
    session.touch()
  }

  /**
   * Creates a new session with the given session ID and optional initial data.
   * @param sessionId - Unique identifier for the session
   * @param initialData - Optional initial data to store in the session
   * @throws {Error} If a session with the same ID already exists
   */
  public createSession(sessionId: string, transport: SessionTransport, initialData: SessionData = {}): Session {
    const newSession:Session = new Session(sessionId, transport , initialData );
    this.add(newSession)
    return newSession
  }


  /**
   * Retrieves session data for the given session ID.
   * @param sessionId - The ID of the session to retrieve
   * @returns The session data, or undefined if not found
   */
  public getSession(sessionId: string): Session | undefined {
    const session: Session|undefined = this.sessions.get(sessionId);
    if (session) { session.touch() }
    return session
  }

  public expiredSessions(maxAge:number) : Array<Session> {
    const minTouchTime = Date.now() - maxAge;
    return Array.from(this.sessions.values()).filter(session => session.touchedAt < minTouchTime)
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
    session.touch()

  }

  /**
   * Deletes a session with the given session ID.
   * @param sessionId - The ID of the session to delete
   * @returns true if the session was deleted, false if it didn't exist
   */
  public async deleteSession(sessionId: string): Promise<boolean> {
    const s = this.getSession(sessionId);

    if (s) {
        return this.sessions.delete(sessionId);
    } else {
      return false
    }
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
