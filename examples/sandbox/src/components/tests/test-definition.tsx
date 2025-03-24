import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Container,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import {
  clearSessionTestResultsFromStore,
  getTestResultsForSession,
  testResultStoreOptions,
  TestSessionStore,
} from "@/lib/tests/test-store";
import TestDefinitionModel from "@/lib/tests/test-definition";
import { useDialogs, useLocalStorageState } from "@toolpad/core";
import {
  CURRENT_TEST_KEY_STORE_ID,
  CURRENT_TEST_SESSION_ID_STORE_ID,
  LAST_TEST_RESULT_ID_STORE_ID,
  TEST_SESSION_STORE_ID,
} from "@/lib/constants";
import { ReactNode, useEffect, useState } from "react";
import {
  TestResult,
  TestResultStatus,
  TestStepResult,
} from "@/lib/tests/test-result";
import {
  Check,
  Dangerous,
  DataObject,
  ExpandLess,
  ExpandMore,
  Info,
  QuestionMark,
  SkipNext,
  Warning,
} from "@mui/icons-material";
import RawOutputDialog from "../dialogs/raw-dialog";
import CollapsibleDescription from "./description";

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
  const [descriptionOpen, setDescriptionOpen] = useState(false);
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
      <CollapsibleDescription description={props.test.description || "No description for this test provided."} />
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
                        >
                          <Stack
                            direction="row"
                            spacing={2}
                            alignItems="center"
                          >
                            {getTestStepResultIcon(step.result)}
                            <IconButton
                              onClick={() =>
                                viewOutput(step, "Step Result Data")
                              }
                            >
                              <DataObject />
                            </IconButton>
                          </Stack>

                          <Stack
                            direction="column"
                            spacing={2}
                            alignItems="flex-start"
                          >
                            <Typography variant="h6">{step.name}</Typography>
                            {/* <Alert severity="info" variant="outlined">
                              <AlertTitle>Step Description</AlertTitle>
                              <Markdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw]}
                              >
                                {step.description}
                              </Markdown>
                            </Alert> */}
                            <CollapsibleDescription description={step.description} length={20} />

                            <Markdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeRaw]}
                            >
                              {step.message}
                            </Markdown>
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
