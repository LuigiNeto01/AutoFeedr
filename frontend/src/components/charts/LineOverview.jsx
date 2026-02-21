import * as React from "react";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LineChart } from "@mui/x-charts/LineChart";

export default function LineOverview({ isDarkMode = false, dataset = [] }) {
  const isMobile = useMediaQuery("(max-width:640px)");
  const muiTheme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDarkMode ? "dark" : "light",
          background: {
            default: isDarkMode ? "#020617" : "#f8fafc",
            paper: isDarkMode ? "#0f172a" : "#ffffff",
          },
        },
      }),
    [isDarkMode],
  );

  return (
    <ThemeProvider theme={muiTheme}>
      <Box
        sx={{
          width: "100%",
          borderRadius: 2,
          border: "1px solid",
          borderColor: isDarkMode ? "rgba(148,163,184,0.22)" : "rgba(15,23,42,0.12)",
          bgcolor: isDarkMode ? "rgba(15,23,42,0.78)" : "rgba(248,250,252,0.85)",
          px: { xs: 1, sm: 1.5 },
          py: 1,
        }}
      >
        <Typography
          textAlign="center"
          color={isDarkMode ? "grey.300" : "text.primary"}
          variant="body2"
        >
          Execucoes AutoFeedr por status (ultimas 24h)
        </Typography>

        <LineChart
          margin={{ top: 24, right: 24, bottom: 34, left: 46 }}
          grid={{ horizontal: true }}
          height={isMobile ? 260 : 320}
          dataset={dataset}
          series={[
            {
              id: "success",
              dataKey: "success",
              label: "Sucesso",
              color: "#22c55e",
              showMark: false
            },
            {
              id: "failed",
              dataKey: "failed",
              label: "Falha",
              color: "#ef4444",
              showMark: false
            },
            {
              id: "running",
              dataKey: "running",
              label: "Em andamento",
              color: "#3b82f6",
              showMark: false
            },
            {
              id: "pending",
              dataKey: "pending",
              label: "Pendente",
              color: "#94a3b8",
              showMark: false
            },
          ]}
          xAxis={[
            {
              scaleType: "time",
              dataKey: "date",
              tickNumber: isMobile ? 3 : 6,
              valueFormatter: (date, context) => {
                if (context.location !== "tick") {
                  return date.toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                }
                return date.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              }
            },
          ]}
          yAxis={[
            {
              scaleType: "linear",
              label: isMobile ? undefined : "Quantidade de jobs",
              valueFormatter: (value) => String(Math.round(value ?? 0)),
              width: isMobile ? 42 : 55,
              position: "left"
            },
          ]}
          slotProps={{
            legend: { position: { vertical: "top", horizontal: "middle" } },
          }}
        />
      </Box>
    </ThemeProvider>
  );
}
