import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { register, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      // Register user - this will set the token via api.setToken() in the register function
      await register(email, password);
      
      // Token should now be in localStorage (set by api.register which calls api.setToken)
      // Verify token is available
      let token = localStorage.getItem('auth_token');
      let retries = 0;
      while (!token && retries < 5) {
        await new Promise(resolve => setTimeout(resolve, 100));
        token = localStorage.getItem('auth_token');
        retries++;
      }
      
      if (!token) {
        console.error("Token not found after registration after retries");
        toast.error("Cadastro realizado, mas a autenticação falhou. Por favor, faça login novamente.");
        navigate("/login");
        return;
      }

      // Auto-create a default shop for the new user
      // Token is now definitely set, so shop creation should work
      try {
        const shop = await api.createShop("Minha Empresa");
        console.log("Shop created successfully:", shop);
        // Invalidate shops query so all pages refresh
        queryClient.invalidateQueries({ queryKey: ['shops'] });
        toast.success("Cadastro realizado com sucesso! Empresa padrão criada.");
      } catch (shopError: any) {
        // Shop creation failed, but user is registered
        console.error("Failed to create shop:", shopError);
        const errorMessage = shopError?.message || shopError?.error || "Erro desconhecido";
        console.error("Shop creation error details:", {
          message: errorMessage,
          error: shopError,
          token: token ? "Token exists" : "No token",
          status: shopError?.response?.status,
          statusText: shopError?.response?.statusText
        });
        toast.warning(`Cadastro realizado com sucesso! Falha ao criar empresa: ${errorMessage}. Você pode criar uma depois.`);
      }
      
      navigate("/");
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error(error.message || "Falha no cadastro");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-5xl flex flex-col md:flex-row items-center gap-8">
        {/* Logo Section */}
        <div className="w-full md:w-1/2 flex items-center justify-center">
          <img 
            src={logo} 
            alt="Logo" 
            className="w-full max-w-md h-auto object-contain"
          />
        </div>
        
        {/* Form Section */}
        <Card className="w-full md:w-1/2 max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Criar uma conta</CardTitle>
          <CardDescription className="text-center">
            Digite suas informações para começar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90"
              disabled={isLoading || loading || isAuthenticated}
            >
              {isLoading ? "Criando conta..." : "Cadastrar"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Entrar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Register;


