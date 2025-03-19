import TestDefinitionClass, { TestDefinitionParams } from "@/lib/tests/test-definition";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";


export default function TestDefinition(props: { test: TestDefinitionClass, params?: TestDefinitionParams }) {
  return (
    <>
      <h3>{props.test.name}</h3>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{props.test.description}</Markdown>
    </>
  );
}