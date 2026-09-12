"use client";

import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import React, { useState } from "react";
import RawOutputDialog, { RawOutput } from "../dialogs/raw-dialog";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
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
  const [, setLastTestResultId] = useLocalStorageState<string>(LAST_TEST_RESULT_ID_STORE_ID);
  const [cancelRequested, setCancelRequested] = useState(false);
  // const [isRunning, setIsRunning] = useState(false);
  const currentSuite = props.suite;

  const [rawOutput, setRawOutput] = useState<RawOutput | null>(null);

  async function runTests(
    sessionId: string,
    tests: AsyncGenerator<{ testKey: string; result: TestResult }>,
  ) {
    let waiting = false;
    // Iterate over the tests and add results to the store as they arrive
    for await (const res of tests) {
      if (cancelRequested) {
        console.log("Tests have been cancelled.");
        break;
      }

      addTestResultToStore(sessionId, res.testKey, res.result);
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
    setRawOutput({ title: "Test Session Data", data: formattedData });
  }

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => (
                <Typography variant="body1" sx={{ "&:not(:last-child)": { mb: 2 } }}>
                  {children}
                </Typography>
              ),
            }}
          >
            {props.suite.description}
          </Markdown>
        </CardContent>
      </Card>

      {props.setup}

      <Card sx={{ mt: 3, mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => runAllTests()}
              disabled={!!testIsRunning}
              sx={{ minWidth: 120 }}
            >
              Run Tests
            </Button>
            <Button variant="text" onClick={() => cancelTests()} disabled={!testIsRunning}>
              Cancel
            </Button>
          </Stack>
          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Button variant="outlined" onClick={() => viewSessionData()}>
              View Session Data
            </Button>
            <Button variant="outlined" onClick={() => createNewSession()} disabled={!!testIsRunning}>
              New Session
            </Button>
            <Button variant="outlined" onClick={() => clearSessionData(currentTestSessionId)}>
              Clear Session
            </Button>
            <Button variant="text" color="error" onClick={() => clearAllSessions()}>
              Clear All
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
          <Stack direction="row" spacing={4} sx={{ flexWrap: "wrap", rowGap: 1 }}>
            {[
              ["Session ID", currentTestSessionId],
              ["Current Test", currentTestKey],
              ["Current Step", currentTestStepKey],
            ].map(([label, value]) => (
              <Typography key={label} variant="body2" color="text.secondary">
                <strong>{label}:</strong> {value || "None"}
              </Typography>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {props.suite.tests.map((c, i) => {
        return <span key={i}>{c.component}</span>;
      })}

      <RawOutputDialog output={rawOutput} onClose={() => setRawOutput(null)} />
    </>
  );
}
