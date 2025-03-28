import { ExpandLess, ExpandMore } from "@mui/icons-material";
import {
  Button,
  Collapse,
  Stack,
} from "@mui/material";
import React, { useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

export interface CollapsibleDescriptionProps {
  markdown: string;
  trimLength?: number;
}

export default function CollapsibleMarkdown(
  props: CollapsibleDescriptionProps,
) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const {
    markdown = "",
    trimLength = 100,
  } = props;

  return (
    // <Alert
    //   severity={severity}
    //   variant={variant}
    //   sx={{ marginY: 2, minWidth: 1 }}
    //   icon={props.icon}
    // >
    //   <AlertTitle>{title}</AlertTitle>
    // </Alert>

    <Stack direction="row" spacing={2} alignItems="self-end">
      {!descriptionOpen ? (
        <>
          <Stack direction="column" spacing={2}>
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {markdown
                ? markdown?.slice(0, trimLength) +
                  (markdown?.length > trimLength ? "..." : "")
                : ""}
            </Markdown>
          </Stack>
          {markdown && markdown.length > trimLength && (
            <Button
              onClick={() => setDescriptionOpen(true)}
              startIcon={<ExpandMore />}
              variant="text"
            >
              Read More
            </Button>
          )}
        </>
      ) : (
        <Collapse in={descriptionOpen} sx={{ marginY: 2 }}>
          <>
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {markdown}
            </Markdown>
            <Button
              onClick={() => setDescriptionOpen(false)}
              startIcon={<ExpandLess />}
              variant="text"
            >
              Read Less
            </Button>
          </>
        </Collapse>
      )}
    </Stack>

  );
}
