import { Chip, Stack, Typography } from "@mui/material";
import { ReactNode } from "react";

export type FlowColor = "primary" | "secondary" | "success";

interface PageHeaderProps {
  icon: ReactNode;
  title: ReactNode;
  /** Short label for the OAuth flow or page category, shown as an outlined chip. */
  tag?: string;
  color?: FlowColor;
  description?: ReactNode;
  children?: ReactNode;
}

export default function PageHeader({
  icon,
  title,
  tag,
  color = "primary",
  description,
  children,
}: PageHeaderProps) {
  return (
    <Stack spacing={1.5} sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Stack sx={{ color: `${color}.main`, "& svg": { fontSize: 28 } }}>{icon}</Stack>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        {tag && <Chip label={tag} color={color} variant="outlined" size="small" />}
      </Stack>
      {description && (
        <Typography variant="body1" color="text.secondary">
          {description}
        </Typography>
      )}
      {children}
    </Stack>
  );
}
