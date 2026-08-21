import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { ReactNode, useMemo, useState } from "react";
import {
  Check,
  Dangerous,
  DataObject,
  ExpandMore,
  Info,
  Input,
  Output,
  QuestionMark,
  SkipNext,
  Warning,
} from "@mui/icons-material";
import RawOutputDialog, { RawOutput } from "../dialogs/raw-dialog";
import CollapsibleMarkdown from "../collapsible-markdown";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import { TestResult, TestResultStatus, TestStepResult } from "@/lib/tests/test-result";
import {
  CURRENT_TEST_KEY_STORE_ID,
  CURRENT_TEST_SESSION_ID_STORE_ID,
  CURRENT_TEST_STEP_KEY_STORE_ID,
  LAST_TEST_RESULT_ID_STORE_ID,
  TEST_SESSION_STORE_ID,
} from "@/lib/constants";
import TestDefinitionModel from "@/lib/tests/test-definition";
import {
  TestSessionStore,
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
  const [currentTestSessionId] = useLocalStorageState<string>(CURRENT_TEST_SESSION_ID_STORE_ID);
  const [currentTestKey] = useLocalStorageState<string>(CURRENT_TEST_KEY_STORE_ID);
  const [currentTestStepKey] = useLocalStorageState<string>(CURRENT_TEST_STEP_KEY_STORE_ID);
  const [lastTestResultId] = useLocalStorageState<string>(LAST_TEST_RESULT_ID_STORE_ID);

  const [rawOutput, setRawOutput] = useState<RawOutput | null>(null);

  const testResults = useMemo<TestResult[]>(
    () =>
      currentTestSessionId
        ? (getTestResultsForSession(currentTestSessionId, props.test.testKey) ?? [])
        : [],
    // The key and result id values are not read here, but a change in any of them means the
    // session store has new results to show.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      props.test.testKey,
      currentTestKey,
      currentTestStepKey,
      currentTestSessionId,
      lastTestResultId,
      resultStore,
    ],
  );

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
    setRawOutput({ title, data: formattedData });
  }

  function iconAction(title: string, icon: ReactNode, data: unknown, dialogTitle: string) {
    return (
      <Tooltip title={data ? title : `No ${title.toLowerCase()} available`}>
        <span>
          <IconButton size="small" disabled={!data} onClick={() => viewOutput(data, dialogTitle)}>
            {icon}
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardHeader
        title={props.test.name}
        subheader={
          <CollapsibleMarkdown
            markdown={props.test.description || "No description for this test provided."}
          />
        }
        slotProps={{
          title: { variant: "h6", component: "h2" },
          subheader: { component: "div", variant: "body2", sx: { mt: 0.5 } },
        }}
      />
      <Divider />

      {testResults.length === 0 && (
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            No results for this test yet.
          </Typography>
        </CardContent>
      )}

      {testResults.map((result, i) => (
        <Accordion
          key={result.id ?? i}
          disableGutters
          square
          elevation={0}
          sx={{
            "&:before": { display: "none" },
            "&:not(:last-of-type)": { borderBottom: 1, borderColor: "divider" },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", minWidth: 0 }}>
              {getTestResultIcon(result.status)}
              <Typography variant="body2">
                {new Date(result.dateStarted).toLocaleString()}
                {" \u2013 "}
                {result.dateCompleted
                  ? new Date(result.dateCompleted).toLocaleTimeString()
                  : "In progress"}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {(result.messages || []).join(" ").slice(0, 100) ||
                  `${(result.steps || []).length} steps`}
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Button
              size="small"
              startIcon={<DataObject />}
              onClick={() => viewOutput(result, "Test Result Data")}
            >
              View result data
            </Button>
            <List disablePadding>
              {(result.steps || []).map((step, j, steps) => (
                <ListItem
                  key={step.id ?? j}
                  disableGutters
                  divider={j < steps.length - 1}
                  sx={{ alignItems: "flex-start", pr: 14 }}
                  secondaryAction={
                    <Stack direction="row">
                      {iconAction("Step result", <DataObject />, step.result, "Step Result Data")}
                      {iconAction("Step input", <Input />, step.input, "Step Input")}
                      {iconAction("Step output", <Output />, step.output, "Step Output")}
                    </Stack>
                  }
                >
                  <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
                    {getTestStepResultIcon(step.result)}
                  </ListItemIcon>
                  <ListItemText
                    primary={step.name}
                    secondary={
                      <>
                        <Typography variant="caption" color="text.secondary" component="p">
                          {step.description}
                        </Typography>
                        <CollapsibleMarkdown
                          markdown={step.message || "No message provided."}
                          trimLength={250}
                        />
                      </>
                    }
                    slotProps={{
                      primary: { variant: "subtitle2" },
                      secondary: { component: "div", sx: { mt: 0.5 } },
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}
      <RawOutputDialog output={rawOutput} onClose={() => setRawOutput(null)} />
    </Card>
  );
}
