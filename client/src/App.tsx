import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AgentsPage from "./features/agents/AgentsPage";
import AgentEditorPage from "./features/agents/AgentEditorPage";
import KnowledgePage from "./features/knowledge/KnowledgePage";
import ToolsPage from "./features/tools/ToolsPage";
import PlaygroundPage from "./features/playground/PlaygroundPage";
import DeployPage from "./features/deployment/DeployPage";
import SettingsPage from "./features/settings/SettingsPage";
import CopilotDashboard from "./pages/CopilotDashboard";
import { PersonalizedCopilot } from "./personalization";

/**
 * Rutas del producto. Flujo principal:
 * Agents → Knowledge → Tools → Playground → Deploy
 */
function Router() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/agents" />
      </Route>
      <Route path="/agents" component={AgentsPage} />
      <Route path="/agents/:id" component={AgentEditorPage} />
      <Route path="/knowledge" component={KnowledgePage} />
      <Route path="/tools" component={ToolsPage} />
      <Route path="/playground" component={PlaygroundPage} />
      <Route path="/deploy" component={DeployPage} />
      <Route path="/settings" component={SettingsPage} />

      {/* Módulos legados, accesibles desde Settings */}
      <Route path="/copilot" component={CopilotDashboard} />
      <Route path="/personalized" component={PersonalizedCopilot} />

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
