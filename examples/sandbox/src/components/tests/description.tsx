import { Alert, AlertTitle, Button, Collapse, Stack } from "@mui/material";
import { useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

export interface CollapsibleDescriptionProps {
  description: string;
  length?: number;
}

export default function CollapsibleDescription(
  props: CollapsibleDescriptionProps = {
    description: "",
    length: 100,
  },
) {
  
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const trimLength = props.length || 100;

  return (

    <Alert severity="info" variant="outlined" sx={{ marginY: 2, minWidth: "100%" }}>
      <AlertTitle>Test Description</AlertTitle>
      <Stack direction="row" spacing={2} alignItems="center">
        {!descriptionOpen ? (
          <>
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {props.description
                ? props.description?.slice(0, trimLength) +
                  (props.description?.length > trimLength ? "..." : "")
                : "No description for this test provided."}
            </Markdown>
            {props.description && props.description.length > 100 && (
              <Button onClick={() => setDescriptionOpen(true)}>
                Read More
              </Button>
            )}
          </>
        ) : (
          <Collapse in={descriptionOpen} sx={{ marginY: 2 }}>
            <>
              <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {props.description || "No description for this test provided."}
              </Markdown>
              <Button onClick={() => setDescriptionOpen(false)}>
                Read Less
              </Button>
            </>
          </Collapse>
        )}
      </Stack>
    
    </Alert>
  );
}
