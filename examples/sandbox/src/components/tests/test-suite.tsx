"use client";

import { Button, Stack } from "@mui/material";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { useDialogs, useLocalStorageState } from "@toolpad/core";
import React, { useEffect, useState } from "react";
import RawOutputDialog from "../dialogs/raw-dialog";
import {
  CURRENT_TEST_KEY_STORE_ID,
  CURRENT_TEST_SESSION_ID_STORE_ID,
  CURRENT_TEST_STEP_KEY_STORE_ID,
  LAST_TEST_RESULT_ID_STORE_ID,
  TEST_IS_RUNNING_STORE_ID,
  TEST_SESSION_STORE_ID,
} from "@/lib/constants";
import { TestSuiteModel } from "@/lib/tests/test-suite";
import {
  TestSession,
  TestSessionStore,
  addTestResultToStore,
  clearAllTestResultsFromStore,
  clearSessionFromStore,
  createTestSession,
  getResultStore,
  getTestSession,
  setCurrentTestKey,
  setCurrentTestSessionParams,
  setCurrentTestStepKey,
  testResultStoreOptions,
} from "@/lib/tests/test-store";
import { TestResult } from "@/lib/tests/test-result";

export interface TestSuiteProps<T> {
  suite: T;
  setup?: React.ReactNode;
}

export default function TestSuite<T extends TestSuiteModel>(props: TestSuiteProps<T>) {
  const [resultStore] = useLocalStorageState<TestSessionStore>(
    TEST_SESSION_STORE_ID,
    null,
    testResultStoreOptions,
  );
  const [currentTestSessionId, setCurrentTestSessionId] = useLocalStorageState<string>(
    CURRENT_TEST_SESSION_ID_STORE_ID,
  );
  const [testIsRunning, setTestIsRunning] = useLocalStorageState<boolean>(
    TEST_IS_RUNNING_STORE_ID,
    false,
    {
      codec: {
        parse: (data) => {
          return data === "true";
        },
        stringify: (data) => {
          return data ? "true" : "false";
        },
      },
    },
  );
  const [currentTestKey] = useLocalStorageState<string>(CURRENT_TEST_KEY_STORE_ID);
  const [currentTestStepKey] = useLocalStorageState<string>(CURRENT_TEST_STEP_KEY_STORE_ID);
  const [, setLastTestResultId] = useLocalStorageState<string>(
    LAST_TEST_RESULT_ID_STORE_ID,
  );
  const [cancelRequested, setCancelRequested] = useState(false);
  // const [isRunning, setIsRunning] = useState(false);
  const [currentSuite, setCurrentSuite] = useState<T>(props.suite);

  const dialog = useDialogs();

  useEffect(() => {
    setCurrentSuite(props.suite);
  }, [props.suite]);

  async function runTests(
    sessionId: string,
    tests: AsyncGenerator<{ testKey: string; result: TestResult }>,
  ) {
    let waiting = false;
    // Iterate over the tests and add results to the store as they arrive
    for await (const res of await tests) {
      if (cancelRequested) {
        console.log("Tests have been cancelled.");
        break;
      }

      await addTestResultToStore(sessionId, res.testKey, res.result);
      setLastTestResultId(res.result.id);

      // If the test is waiting, stop running additional tests
      if (res.result.status === "waiting") {
        console.log("Test is waiting for user action.");
        waiting = true;
        break;
      }
    }

    if (!waiting) {
      stopTests();
    }
  }

  /**
   * Runs all tests in the suite.
   * @returns void
   */
  async function runAllTests() {
    console.log("Running all tests in suite: ", currentSuite.tests, currentTestSessionId);

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

    startTests();

    // Async generator to run all tests in the suite
    const tests = currentSuite.runAllTests((currentSuite.tests || []).map((t) => t.model));
    runTests(testSession.id, tests);
  }

  function cancelTests() {
    setCancelRequested(true);
    stopTests();
  }

  function startTests() {
    setCurrentTestKey("");
    setCurrentTestStepKey("");
    setTestIsRunning(true);
  }

  function stopTests() {
    setTestIsRunning(false);
    setCancelRequested(false);
    setCurrentTestKey("");
    setCurrentTestStepKey("");
  }

  function clearSessionData(currentSessionId: string | null): void {
    if (!currentSessionId) {
      return;
    }

    clearSessionFromStore(currentSessionId);
    setCurrentTestSessionId(null);
    setTestIsRunning(false);
  }

  function clearAllSessions(): void {
    clearAllTestResultsFromStore();
    setCurrentTestSessionId(null);
    setTestIsRunning(false);
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

  function viewSessionData(): void {
    const formattedData = JSON.stringify(resultStore, null, 2);
    dialog.open(RawOutputDialog, {
      title: "Test Session Data",
      data: formattedData,
    });
  }

  return (
    <>
      <h2>{props.suite.name}</h2>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {props.suite.description}
      </Markdown>

      {props.setup}

      <Stack direction="row" spacing={2} sx={{ marginY: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => runAllTests()}
          disabled={!!testIsRunning}
        >
          Run Tests
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => cancelTests()}
          disabled={!testIsRunning}
        >
          Cancel
        </Button>
      </Stack>
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={() => viewSessionData()}>
          View All Session Data
        </Button>
        <Button variant="contained" onClick={() => createNewSession()} disabled={!!testIsRunning}>
          Create New Session
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => clearSessionData(currentTestSessionId)}
        >
          Clear Session Data
        </Button>
        <Button variant="contained" color="error" onClick={() => clearAllSessions()}>
          Clear All Sessions
        </Button>
        {/* <div>Running: { testIsRunning?.toString() } -- { (!!testIsRunning)?.toString() } -- { cancelRequested }</div> */}
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
        <div>Current test: {currentTestKey}</div>
        <div>Current test step: {currentTestStepKey}</div>
        {/* <div>Suite params: {JSON.stringify(currentSuite.params)}</div> */}
        {/* <div>Session Params: {JSON.stringify(resultStore?.data.find(s => s.id === currentTestSessionId)?.params)}</div> */}
      </Stack>

      {props.suite.tests.map((c, i) => {
        return <span key={i}>{c.component}</span>;
      })}

      {/* <div>
        <pre>{JSON.stringify(resultStore, null, 2)}</pre>
      </div> */}
    </>
  );
}
