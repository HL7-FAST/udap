"use client";
import Editor, { EditorProps } from "@monaco-editor/react";
import { Paper } from "@mui/material";
import { useColorScheme } from "@mui/material/styles";

/** Read-only Monaco editor that follows the MUI color scheme and sits in an outlined surface. */
export default function CodeEditor(props: EditorProps) {
  const { mode, systemMode } = useColorScheme();
  const dark = (mode === "system" ? systemMode : mode) === "dark";

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Editor
        defaultLanguage="json"
        theme={dark ? "vs-dark" : "light"}
        {...props}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderLineHighlight: "none",
          fontSize: 13,
          padding: { top: 12, bottom: 12 },
          ...props.options,
        }}
      />
    </Paper>
  );
}
