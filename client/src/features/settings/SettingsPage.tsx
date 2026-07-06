/**
 * Settings — cuenta y acceso a módulos legados fuera del flujo principal.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { History, LogOut, User } from "lucide-react";
import { useLocation } from "wouter";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Tu cuenta y módulos adicionales.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Cuenta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm">
              <p className="font-medium">{user?.name ?? "Usuario"}</p>
              <p className="text-muted-foreground">{user?.email ?? ""}</p>
            </div>
            <Separator />
            <Button variant="outline" onClick={() => logout()}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Módulos legados
            </CardTitle>
            <CardDescription>
              Funcionalidades previas a la plataforma de agentes, mantenidas fuera del flujo principal.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setLocation("/copilot")}>
              Copiloto Maestro (reglas y patrones)
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation("/personalized")}>
              Copiloto personalizado
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
