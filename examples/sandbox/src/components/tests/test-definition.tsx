import {
  Alert,
  AlertTitle,
  Button,
  Collapse,
  Container,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useDialogs, useLocalStorageState } from "@toolpad/core";
import { ReactNode, useEffect, useState } from "react";
import {
  Check,
  Dangerous,
  DataObject,
  DescriptionOutlined,
  Info,
  Input,
  Output,
  QuestionMark,
  Science,
  SkipNext,
  Warning,
} from "@mui/icons-material";
import RawOutputDialog from "../dialogs/raw-dialog";
import CollapsibleMarkdown from "../collapsible-markdown";
import {
  TestResult,
  TestResultStatus,
  TestStepResult,
} from "@/lib/tests/test-result";
import {
  CURRENT_TEST_KEY_STORE_ID,
  CURRENT_TEST_SESSION_ID_STORE_ID,
  LAST_TEST_RESULT_ID_STORE_ID,
  TEST_SESSION_STORE_ID,
} from "@/lib/constants";
import TestDefinitionModel from "@/lib/tests/test-definition";
import {
  TestSessionStore,
  clearSessionTestResultsFromStore,
  getTestResultsForSession,
  testResultStoreOptions,
} from "@/lib/tests/test-store";

interface TestDefinitionProps<T extends TestDefinitionModel> {
  test: T;
  results?: TestResult[];
}

export default function TestDefinition<T extends TestDefinitionModel>(
  props: TestDefinitionProps<T>,
) {
  const [resultStore] = useLocalStorageState<TestSessionStore>(
    TEST_SESSION_STORE_ID,
    null,
    testResultStoreOptions,
  );
  const [currentTestSessionId] = useLocalStorageState<string>(
    CURRENT_TEST_SESSION_ID_STORE_ID,
  );
  const [currentTestKey] = useLocalStorageState<string>(
    CURRENT_TEST_KEY_STORE_ID,
  );
  const [currentTestStepKey] = useLocalStorageState<string>(
    CURRENT_TEST_KEY_STORE_ID,
  );
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [lastTestResultId] = useLocalStorageState<string>(
    LAST_TEST_RESULT_ID_STORE_ID,
  );
  const [openTestResults, setOpenIndexes] = useState<number[]>([]);

  const dialog = useDialogs();

  useEffect(() => {
    setTestResults([]);
    if (!currentTestSessionId) {
      return;
    }
    const results = getTestResultsForSession(
      currentTestSessionId,
      props.test.testKey,
    );
    if (results) {
      setTestResults(results);
    }
  }, [
    props.test.testKey,
    currentTestKey,
    currentTestStepKey,
    currentTestSessionId,
    lastTestResultId,
    resultStore,
  ]);

  function clearResults() {
    if (props.test.params.suiteKey) {
      clearSessionTestResultsFromStore(
        props.test.params.suiteKey,
        props.test.testKey,
      );
    }
  }

  function toggleTestResultCollapse(index: number) {
    setOpenIndexes((prevOpenIndexes) =>
      prevOpenIndexes.includes(index)
        ? prevOpenIndexes.filter((i) => i !== index)
        : [...prevOpenIndexes, index],
    );
  }

  function getTestResultIcon(status: TestResultStatus): ReactNode {
    switch (status) {
      case "pass":
        return <Check color="success" />;
      case "warn":
        return <Warning color="warning" />;
      case "fail":
        return <Dangerous color="error" />;
      case "skip":
        return <SkipNext color="info" />;
      default:
        return <QuestionMark color="info" />;
    }
  }

  function getTestStepResultIcon(status: TestStepResult): ReactNode {
    switch (status) {
      case "pass":
        return <Check color="success" />;
      case "warn":
        return <Warning color="warning" />;
      case "fail":
        return <Dangerous color="error" />;
      case "skip":
        return <SkipNext color="info" />;
      case "info":
        return <Info color="info" />;
      default:
        return <QuestionMark color="info" />;
    }
  }

  function viewOutput(data: unknown, title: string): void {
    const formattedData = JSON.stringify(data, null, 2);
    dialog.open(RawOutputDialog, {
      title: title,
      data: formattedData,
    });
  }

  return (
    <>
      <h3>{props.test.name}</h3>

      <Alert
        severity="info"
        variant="outlined"
        sx={{ marginY: 2, minWidth: 1 }}
        icon={<Science />}
      >
        <AlertTitle>Test Description</AlertTitle>
        <CollapsibleMarkdown
          markdown={
            props.test.description || "No description for this test provided."
          }
        />
      </Alert>
      {
        <Container
          maxWidth="xl"
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            padding: 1,
          }}
        >
          {(testResults || []).map((result, i) => (
            <List
              key={i}
              component="div"
              sx={{ width: "100%", bgcolor: "background.paper" }}
            >
              <ListItemButton onClick={() => toggleTestResultCollapse(i)}>
                <Stack direction="row" spacing={2} width="100%">
                  {getTestResultIcon(result.status)}
                  {/* <span>{result.id}</span> */}
                  <span>
                    {result.dateStarted.toLocaleString()} -{" "}
                    {result.dateCompleted?.toLocaleString() || "In Progress"}
                  </span>
                  <span>
                    {(result.messages || []).join("\n").slice(0, 100) ||
                      `${(result.steps || []).length} steps` ||
                      `No steps or messages`}
                  </span>
                </Stack>
              </ListItemButton>
              <Collapse in={openTestResults.includes(i)} unmountOnExit>
                <Stack direction="column" spacing={2} sx={{ marginY: 2 }}>
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="contained"
                      onClick={() => viewOutput(result, "Test Result Data")}
                      startIcon={<DataObject />}
                    >
                      View Test Result Data
                    </Button>
                  </Stack>
                  <List component="div" disablePadding>
                    {(result.steps || []).map((step, j) => (
                      <ListItem
                        key={j}
                        sx={{
                          borderColor: "grey.300",
                          borderWidth: 1,
                          borderStyle: "solid",
                          borderRadius: 4,
                          marginY: 2,
                          padding: 2,
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={2}
                          alignItems="flex-start"
                          width={1}
                        >
                          <Stack
                            direction="column"
                            spacing={2}
                            alignItems="flex-start"
                          >
                            <Tooltip
                              title={
                                step.result
                                  ? "View step result"
                                  : "No step result available"
                              }
                            >
                              <span>
                                <IconButton
                                  disabled={!step.result}
                                  onClick={() =>
                                    viewOutput(step, "Step Result Data")
                                  }
                                >
                                  {getTestStepResultIcon(step.result)}
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip
                              title={
                                step.input
                                  ? "View step input"
                                  : "No step input available"
                              }
                            >
                              <span>
                                <IconButton
                                  disabled={!step.input}
                                  onClick={() =>
                                    viewOutput(step.input, "Step Input")
                                  }
                                >
                                  <Input />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip
                              title={
                                step.output
                                  ? "View step output"
                                  : "No step output available"
                              }
                            >
                              <span>
                                <IconButton
                                  disabled={!step.output}
                                  onClick={() =>
                                    viewOutput(step.output, "Step Output")
                                  }
                                >
                                  <Output />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>

                          <Stack
                            direction="column"
                            spacing={2}
                            alignItems="flex-start"
                            width={1}
                          >
                            <Typography variant="h6">{step.name}</Typography>
                            <Alert
                              severity="info"
                              variant="outlined"
                              sx={{ marginY: 2, minWidth: 1 }}
                              icon={<DescriptionOutlined />}
                            >
                              <AlertTitle>Step Result</AlertTitle>
                              <CollapsibleMarkdown
                                markdown={step.description}
                                trimLength={100}
                              />
                            </Alert>
                            <CollapsibleMarkdown
                              markdown={step.message || "No message provided."}
                              trimLength={250}
                            />
                          </Stack>
                        </Stack>
                      </ListItem>
                    ))}
                  </List>
                </Stack>
              </Collapse>
            </List>
          ))}

          {testResults.length === 0 && (
            <Typography variant="h6">No results for this test yet.</Typography>
          )}
        </Container>
      }
    </>
  );
}
