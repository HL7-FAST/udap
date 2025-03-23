import { Button, Stack } from "@mui/material";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import {
  clearSessionTestResultsFromStore,
} from "@/lib/tests/test-store";
import TestDefinitionModel from "@/lib/tests/test-definition";

interface TestDefinitionProps<T extends TestDefinitionModel> {
  test: T;
  children?: React.ReactNode;
}

export default function TestDefinition<T extends TestDefinitionModel>(
  props: TestDefinitionProps<T>,
) {

  function clearResults() {
    // console.log("Clearing results for test: ", props.test.params.suiteKey, props.test.testKey);
    if (props.test.params.suiteKey) {
      clearSessionTestResultsFromStore(
        props.test.params.suiteKey,
        props.test.testKey,
      );
    }
  }

  return (
    <>
      <h3>{props.test.name}</h3>
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={() => clearResults()}>
          Clear Test Results
        </Button>
      </Stack>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {props.test.description}
      </Markdown>
      {props.children}
    </>
  );
}
