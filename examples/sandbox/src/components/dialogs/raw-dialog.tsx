import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import CodeEditor from "../code-editor";

export interface RawOutput {
  title: string;
  data: string;
  language?: string;
}

interface RawOutputDialogProps {
  output: RawOutput | null;
  onClose: () => void;
}

export default function RawOutputDialog({ output, onClose }: RawOutputDialogProps) {
  return (
    <Dialog fullWidth maxWidth="xl" open={output !== null} onClose={onClose}>
      <DialogTitle>{output?.title}</DialogTitle>
      <DialogContent>
        <CodeEditor
          height="75vh"
          defaultLanguage={output?.language ?? "json"}
          value={output?.data ?? ""}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
