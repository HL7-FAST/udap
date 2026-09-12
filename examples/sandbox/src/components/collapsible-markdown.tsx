import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { Box, Button, Collapse } from "@mui/material";
import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface CollapsibleDescriptionProps {
  markdown: string;
  /** Character count above which the content starts collapsed. */
  trimLength?: number;
  /** Visible height while collapsed, in pixels. */
  collapsedSize?: number;
}

/**
 * Renders markdown in full and clips it by height while collapsed, so code spans and links
 * are never cut mid-token. The toggle always sits below the content.
 */
export default function CollapsibleMarkdown(props: CollapsibleDescriptionProps) {
  const { markdown = "", trimLength = 100, collapsedSize = 48 } = props;
  const [open, setOpen] = useState(false);
  const collapsible = markdown.length > trimLength;

  const content = (
    <Box sx={{ "& > :first-of-type": { mt: 0 }, "& > :last-child": { mb: 0 } }}>
      <Markdown remarkPlugins={[remarkGfm]}>
        {markdown}
      </Markdown>
    </Box>
  );

  if (!collapsible) {
    return content;
  }

  return (
    <Box>
      <Collapse
        in={open}
        collapsedSize={collapsedSize}
        sx={[
          !open && {
            maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
          },
        ]}
      >
        {content}
      </Collapse>
      <Button
        size="small"
        onClick={() => setOpen(!open)}
        startIcon={open ? <ExpandLess /> : <ExpandMore />}
        sx={{ mt: 0.5, ml: -1 }}
      >
        {open ? "Show less" : "Show more"}
      </Button>
    </Box>
  );
}
