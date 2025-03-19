import { TestResult } from "@/lib/tests/test-result";
import TestSuiteClass, { TestSuiteParams } from "@/lib/tests/test-suite";
import { Box, Button, Stack } from "@mui/material";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";



export interface TestSuiteProps {
  suite: TestSuiteClass;
  params?: TestSuiteParams;
  setup?: React.ReactNode;
}

export default function TestSuite(props: TestSuiteProps) {


  const runAll = async () => {
    const results: Record<string, TestResult[]> = {};
    for await (const result of props.suite.runAllTests(props.params)) {
      console.log("Result: ", result);
      for (const key in result) {
        if (!results[key]) {
          results[key] = [];
        }
        results[key].push(result[key]);
      }
    }
    console.log("Results in TestSuite: ", results);
  }

  return (
    <>
      <h2>{props.suite.name}</h2>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{props.suite.description}</Markdown>

      {
        props.setup ? <>{props.setup}</> : null
      }

      <Stack direction="row" spacing={2}>
        <Button variant="contained" color="primary" onClick={() => runAll()}>Run All</Button>
      </Stack>

      <Stack direction="row" spacing={2} sx={{
        borderColor: 'grey.300',
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: 4,
        marginY: 2,
        padding: 2,
      }}>
        Result statistics here
      </Stack>
      
      <Stack direction="column" spacing={2}>
        {
          (props.suite.tests||[]).map((test, index) => {
            return (
              <div key={index}>
                <h3>{test.name}</h3>
                <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{test.description}</Markdown>
              </div>
            );
          })
        }
      </Stack>
    </>
  );
}