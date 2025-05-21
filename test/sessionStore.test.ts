import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionStore, sessionStore } from '../src/server/sessionStore';

describe('SessionStore', () => {
  let store: SessionStore;
  const testSessionId = 'test-session-123';
  const testData = { userId: 'user-123', role: 'admin' };

  beforeEach(() => {
    // Create a new instance for each test to ensure isolation
    store = new SessionStore();
  });

  afterEach(() => {
    // Clean up the singleton instance between tests
  });

  describe('createSession', () => {
    it('should create a new session with the given ID and data', () => {
      store.createSession(testSessionId, testData);
      
      const session = store.getSession(testSessionId);
      expect(session).toBeDefined();
      expect(session?.userId).toBe(testData.userId);
      expect(session?.role).toBe(testData.role);
    });

    it('should throw an error if session already exists', () => {
      store.createSession(testSessionId, testData);
      
      expect(() => {
        store.createSession(testSessionId, testData);
      }).toThrow(`Session with ID ${testSessionId} already exists`);
    });
  });

  describe('getSession', () => {
    it('should return undefined for non-existent session', () => {
      const session = store.getSession('non-existent-id');
      expect(session).toBeUndefined();
    });

    it('should return the session data for an existing session', () => {
      store.createSession(testSessionId, testData);
      const session = store.getSession(testSessionId);
      
      expect(session).toBeDefined();
      expect(session?.userId).toBe(testData.userId);
    });
  });

  describe('updateSession', () => {
    it('should update existing session data', () => {
      store.createSession(testSessionId, testData);
      const originalSession = store.getSession(testSessionId)!;
      
      const updateData = { role: 'user', newField: 'value' };
      store.updateSession(testSessionId, updateData);
      
      const updatedSession = store.getSession(testSessionId)!;
      
      expect(updatedSession.role).toBe('user');
      expect(updatedSession.userId).toBe(testData.userId); // Should preserve existing fields
      expect(updatedSession.newField).toBe('value'); // Should add new fields
    });

    it('should throw an error when updating non-existent session', () => {
      expect(() => {
        store.updateSession('non-existent-id', { role: 'admin' });
      }).toThrow('Session non-existent-id not found');
    });
  });

  describe('deleteSession', () => {
    it('should delete an existing session', () => {
      store.createSession(testSessionId, testData);
      expect(store.hasSession(testSessionId)).toBe(true);
      
      const result = store.deleteSession(testSessionId);
      
      expect(result).toBe(true);
      expect(store.hasSession(testSessionId)).toBe(false);
    });

    it('should return false when trying to delete non-existent session', () => {
      const result = store.deleteSession('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('hasSession', () => {
    it('should return true for existing session', () => {
      store.createSession(testSessionId, testData);
      expect(store.hasSession(testSessionId)).toBe(true);
    });

    it('should return false for non-existent session', () => {
      expect(store.hasSession('non-existent-id')).toBe(false);
    });
  });

  describe('getAllSessionIds', () => {
    it('should return all session IDs', () => {
      const ids = ['session-1', 'session-2', 'session-3'];
      
      ids.forEach((id, index) => {
        store.createSession(id, { userId: `user-${index}` });
      });
      
      const allIds = store.getAllSessionIds();
      
      expect(allIds).toHaveLength(ids.length);
      expect(allIds).toEqual(expect.arrayContaining(ids));
    });

    it('should return an empty array when no sessions exist', () => {
      expect(store.getAllSessionIds()).toEqual([]);
    });
  });

  describe('sessionStore singleton', () => {
    it('should be an instance of SessionStore', () => {
      expect(sessionStore).toBeInstanceOf(SessionStore);
    });
  });
});
