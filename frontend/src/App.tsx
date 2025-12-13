import { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import Inicio from "./pages/Inicio";
import Conversas from "./pages/Conversas";
import MensagensAprovadas from "./pages/MensagensAprovadas";
import Campanhas from "./pages/Campanhas";
import NovaCampanha from "./pages/NovaCampanha";
import ConectarWhatsApp from "./pages/ConectarWhatsApp";
import StatusConexao from "./pages/StatusConexao";
import PerfilEmpresa from "./pages/PerfilEmpresa";
import Agencia from "./pages/Agencia";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChooseApi from "./pages/ChooseApi";
import Onboarding from "./pages/Onboarding";
import OnboardingCallback from "./pages/OnboardingCallback";
import { AuthProvider, useAuth } from "./lib/auth";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <AuthProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/choose-api"
              element={
                <ProtectedRoute>
                  <ChooseApi />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />
            <Route path="/onboarding/callback" element={<OnboardingCallback />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
            <Route index element={<Inicio />} />
            <Route path="conversas" element={<Conversas />} />
            <Route path="mensagens-aprovadas" element={<MensagensAprovadas />} />
            <Route path="campanhas" element={<Campanhas />} />
            <Route path="campanhas/nova" element={<NovaCampanha />} />
            <Route path="conectar-whatsapp" element={<ConectarWhatsApp />} />
            <Route path="status-conexao" element={<StatusConexao />} />
            <Route path="perfil-empresa" element={<PerfilEmpresa />} />
            <Route path="agencia" element={<Agencia />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </AuthProvider>
);

export default App;
