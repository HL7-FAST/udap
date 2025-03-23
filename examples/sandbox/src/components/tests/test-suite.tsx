"use client";

import { Button, Stack } from "@mui/material";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { useLocalStorageState } from "@toolpad/core";
import React, { useEffect, useState } from "react";
import {
  CURRENT_TEST_SESSION_ID_STORE_ID,
  TEST_RESULT_STORE_ID,
} from "@/lib/constants";
import { TestSuiteModel } from "@/lib/tests/test-suite";
import {
  TestSession,
  TestSessionStore,
  addTestResultToStore,
  clearAllTestResultsFromStore,
  clearSessionFromStore,
  createTestSession,
  getCurrentTestSessionParam,
  getResultStore,
  getTestSession,
  setCurrentTestSessionParams,
  testResultStoreOptions,
} from "@/lib/tests/test-store";

export interface TestSuiteProps<T> {
  suite: T;
  setup?: React.ReactNode;
}

export default function TestSuite<T extends TestSuiteModel>(
  props: TestSuiteProps<T>,
) {
  const [resultStore] = useLocalStorageState<TestSessionStore>(
    TEST_RESULT_STORE_ID,
    null,
    testResultStoreOptions,
  );
  const [currentTestSessionId, setCurrentTestSessionId] = useLocalStorageState<string>(
    CURRENT_TEST_SESSION_ID_STORE_ID,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [currentSuite, setCurrentSuite] = useState<T>(props.suite);

  useEffect(() => {
    setCurrentSuite(props.suite);
  }, [props.suite]);

  /**
   * Runs all tests in the suite.
   * @returns void
   */
  async function runAllTests() {
    console.log(
      "Running all tests in suite: ",
      currentSuite.tests,
      currentTestSessionId,
    );

    const resultStore = getResultStore();

    if (!resultStore) {
      console.error("No test result store available.");
      return;
    }

    // Create a new session if we don't currently have one
    let testSession: TestSession;
    if (!currentTestSessionId) {
      testSession = createTestSession(currentSuite.params, currentSuite.suiteKey);
      if (!testSession) {
        console.error("Failed to create a new test session.");
        return;
      }
      setCurrentTestSessionId(testSession.id);
    } 
    // Otherwise, get the existing session and update the session params
    else {
      const existingSession = getTestSession(currentTestSessionId);
      if (!existingSession) {
        console.error("Failed to retrieve the current test session.");
        return;
      }
      testSession = existingSession;
      setCurrentTestSessionParams(currentSuite.params);
    }

    setIsRunning(true);

    // Async generator to run all tests in the suite
    const tests = currentSuite.runAllTests(
      (currentSuite.tests || []).map((t) => t.model),
    );

    // Iterate over the tests and add results to the store as they arrive
    for await (const res of await tests) {
      await addTestResultToStore(testSession.id, res.testKey, res.result);
    }

    setIsRunning(false);
  }

  function clearSessionData(currentSessionId: string|null): void {
    if (!currentSessionId) {
      return;
    }

    clearSessionFromStore(currentSessionId);
    setCurrentTestSessionId(null);
  }

  function clearAllSessions(): void {
    clearAllTestResultsFromStore();
    setCurrentTestSessionId(null);
  }

  function createNewSession(): void {
    setCurrentTestSessionId(null);
    const testSession = createTestSession(currentSuite.params, currentSuite.suiteKey);
    if (!testSession) {
      console.error("Failed to create a new test session.");
      return;
    }
    setCurrentTestSessionId(testSession.id);
  }

  return (
    <>
      <h2>{props.suite.name}</h2>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {props.suite.description}
      </Markdown>

      {props.setup}

      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={() => createNewSession()} disabled={isRunning}>
          Create New Session
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => runAllTests()}
          disabled={isRunning}
        >
          Run Tests
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => clearSessionData(currentTestSessionId)}
        >
          Clear Session Data
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => clearAllSessions()}
        >
          Clear All Sessions
        </Button>
        <div>Running: {isRunning ? "true" : "false"}</div>
      </Stack>

      <Stack
        direction="column"
        spacing={2}
        sx={{
          borderColor: "grey.300",
          borderWidth: 1,
          borderStyle: "solid",
          borderRadius: 4,
          marginY: 2,
          padding: 2,
        }}
      >
        <div>Test session ID: {currentTestSessionId}</div>
        <div>Suite params: {JSON.stringify(currentSuite.params)}</div>
        <div>Session Params: {JSON.stringify(resultStore?.data.find(s => s.id === currentTestSessionId)?.params)}</div>
        <div>fhirServer: {getCurrentTestSessionParam("fhirServer")?.toString()}</div>
      </Stack>

      {props.suite.tests.map((c, i) => {
        return <span key={i}>{c.component}</span>;
      })}

      <div>
        <pre>{JSON.stringify(resultStore, null, 2)}</pre>
      </div>
    </>
  );
}
