import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { DialogProps } from "@toolpad/core";
import Editor from '@monaco-editor/react';


interface RawOutputDialogPayload {
  title: string;
  data: string;
  language?: string;
}

export default function RawOutputDialog({payload, open, onClose}: DialogProps<RawOutputDialogPayload>) {
  const { title, data, language = "json" } = payload;

  return (

    <Dialog fullWidth maxWidth="xl" open={open} onClose={() => onClose()}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        
        <Editor width="100%" height="75vh"
          defaultLanguage={language ?? "json"} 
          defaultValue={data} />

      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}