import { StorageStateOptions } from "@toolpad/core/persistence";
import {
  CURRENT_TEST_KEY_STORE_ID,
  CURRENT_TEST_SESSION_ID_STORE_ID,
  CURRENT_TEST_STEP_KEY_STORE_ID,
  TEST_IS_RUNNING_STORE_ID,
  TEST_SESSION_STORE_ID,
} from "../constants";
import { TestResult } from "./test-result";

export interface TestSession {
  id: string;
  suiteKey: string;
  params: TestSessionParams;
  results: TestSessionResults;
}

export interface TestSessionParams {
  initial: Record<string, unknown>;
  current: Record<string, unknown>;
}

export interface TestSessionStore {
  data: TestSession[];
}

/**
 * Data structure for storing test results.
 */
export interface TestSessionResults {
  [testDefinitionKey: string]: TestResult[];
}

/**
 * Configuration options for storing test results in local storage as a single JSON object containing test results.
 */
export const testResultStoreOptions: StorageStateOptions<TestSessionStore> = {
  codec: {
    parse: (data) => {
      try {
        return JSON.parse(data) as TestSessionStore;
      } catch {
        return { data: [] };
      }
    },
    stringify: JSON.stringify,
  },
};

export function getResultStore(): TestSessionStore {
  const resultStore = localStorage.getItem(TEST_SESSION_STORE_ID);
  if (!resultStore) {
    return { data: [] };
  }
  return JSON.parse(resultStore) as TestSessionStore;
}

export function setResultStore(resultStore: TestSessionStore) {
  localStorage.setItem(TEST_SESSION_STORE_ID, JSON.stringify(resultStore));
}

export function createTestSession(
  initialParams: Record<string, unknown>,
  suiteKey: string,
): TestSession {
  const resultStore = getResultStore();

  if (!resultStore) {
    throw new Error("No test result store available.");
  }

  const newSession = {
    id: crypto.randomUUID(),
    params: {
      initial: initialParams,
      current: { ...initialParams },
    },
    suiteKey,
    results: {},
  };

  resultStore.data.push(newSession);
  setResultStore(resultStore);

  return newSession;
}

/**
 * Get a test session by ID.
 */
export function getTestSession(testSessionId: string): TestSession | undefined {
  const resultStore = getResultStore();
  if (!resultStore) {
    console.error("No test result store provided.");
    return undefined;
  }

  if (!testSessionId) {
    console.error("No test session ID provided.");
    return undefined;
  }

  const testSession = resultStore.data.find((session) => session.id === testSessionId);
  if (!testSession) {
    console.error("No test session found with ID: ", testSessionId);
    return undefined;
  }

  return testSession;
}

/**
 * Get the current test session ID if one is set.
 */
export function getCurrentTestSessionId(): string | null {
  return localStorage.getItem(CURRENT_TEST_SESSION_ID_STORE_ID);
}

/**
 * Set the current test session ID.
 */
export function setCurrentTestSessionId(testSessionId: string) {
  localStorage.setItem(CURRENT_TEST_SESSION_ID_STORE_ID, testSessionId);
}

/**
 * Get the current test session if one is set.
 */
export function getCurrentTestSession(): TestSession | undefined {
  const currentSessionId = getCurrentTestSessionId();
  if (!currentSessionId) {
    return undefined;
  }

  return getTestSession(currentSessionId);
}

/**
 * Get the current test session parameters.
 */
export function getCurrentTestSessionParams(): TestSessionParams | undefined {
  const currentSession = getCurrentTestSession();
  if (!currentSession) {
    return undefined;
  }

  return currentSession.params;
}

/**
 * Get the current test session parameter with the given name.
 */
export function getCurrentTestSessionParam(name: string): unknown | undefined {
  const currentSession = getCurrentTestSession();
  if (!currentSession) {
    return undefined;
  }

  return currentSession.params.current[name];
}

/**
 * Set the current test session parameter with the given name.
 */
export function setCurrentTestSessionParam(name: string, value: unknown) {
  const currentSession = getCurrentTestSession();
  if (!currentSession) {
    return;
  }

  currentSession.params.current[name] = value;
  setCurrentTestSessionParams(currentSession.params.current);
}

/**
 * Set the current test session with new parameters.
 */
export function setCurrentTestSessionParams(
  params: Record<string, unknown>,
  clear: boolean = false,
) {
  const currentSession = getCurrentTestSession();
  if (!currentSession) {
    return;
  }

  currentSession.params.current = clear
    ? { ...currentSession.params.initial }
    : { ...currentSession.params.current, ...params };

  const resultStore = getResultStore();
  resultStore.data = resultStore.data.map((session) => {
    if (session.id === currentSession.id) {
      return currentSession;
    }
    return session;
  });
  setResultStore(resultStore);
}

/**
 * Get the current test key in this session if one is set.
 */
export function getCurrentTestKey(): string | null {
  return localStorage.getItem(CURRENT_TEST_KEY_STORE_ID);
}

/**
 * Set the current test key in this session.
 */
export function setCurrentTestKey(testKey: string) {
  localStorage.setItem(CURRENT_TEST_KEY_STORE_ID, testKey);
}

/**
 * Get the current test step key in this session if one is set.
 */
export function getCurrentTestStepKey(): string | null {
  return localStorage.getItem(CURRENT_TEST_STEP_KEY_STORE_ID);
}

/**
 * Set the current test step key in this session.
 */
export function setCurrentTestStepKey(testStepKey: string) {
  localStorage.setItem(CURRENT_TEST_STEP_KEY_STORE_ID, testStepKey);
}

/**
 * Get the test is running value in this session.
 */
export function getTestIsRunning(): boolean {
  const isRunning = localStorage.getItem(TEST_IS_RUNNING_STORE_ID);
  return isRunning === "true";
}

/**
 * Set the test is running value in this session.
 */
export function setTestIsRunning(isRunning: boolean) {
  localStorage.setItem(TEST_IS_RUNNING_STORE_ID, isRunning.toString());
}

/**
 *
 */
export function getTestResultsForSession(
  sessionId: string,
  testKey: string,
): TestResult[] | undefined {
  const session = getTestSession(sessionId);
  if (!session) {
    return undefined;
  }

  return session.results[testKey];
}

/**
 * Add a test result to the given store.
 */
export function addTestResultToStore(testSessionId: string, testKey: string, result: TestResult) {
  const resultStore = getResultStore();

  const testSession = getTestSession(testSessionId);
  if (!testSession) {
    return;
  }

  if (!testSession.results[testKey]) {
    testSession.results[testKey] = [];
  }

  // Deep clone the result to avoid reference issues when the test continues to modify objects
  testSession.results[testKey].push(JSON.parse(JSON.stringify(result)));

  resultStore.data = resultStore.data.map((session) => {
    if (session.id === testSessionId) {
      return testSession;
    }
    return session;
  });
  setResultStore(resultStore);
}

/**
 * Clear all test results for a given test definition from the store.
 */
export function clearSessionTestResultsFromStore(testSessionId: string, testDefinitionKey: string) {
  const resultStore = getResultStore();

  const testSession = getTestSession(testSessionId);
  if (!testSession) {
    return;
  }

  if (testSession.results[testDefinitionKey]) {
    delete testSession.results[testDefinitionKey];
    resultStore.data = resultStore.data.map((session) => {
      if (session.id === testSessionId) {
        return testSession;
      }
      return session;
    });
    setResultStore(resultStore);
  }
}

/**
 * Clear all test results for a given test session from the store.
 */
export function clearSessionFromStore(testSessionId: string) {
  const resultStore = getResultStore();

  const testSession = getTestSession(testSessionId);
  if (!testSession) {
    return;
  }

  resultStore.data = resultStore.data.filter((session) => session.id !== testSessionId);
  setResultStore(resultStore);
}

/**
 * Clear all test results from the store.
 */
export function clearAllTestResultsFromStore() {
  const resultStore = getResultStore();
  resultStore.data = [];
  setResultStore({ data: [] });
}
