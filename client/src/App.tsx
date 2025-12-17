import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { User, Lock, Building2 } from "lucide-react";
import { ThemeProvider } from "@/components/ThemeProvider";
import Dashboard from "@/components/Dashboard";
import ColorPreview from "@/pages/ColorPreview";
import LogoMockup from "@/pages/LogoMockup";
import NotFound from "@/pages/not-found";

import { api, type LoginResponse } from "./lib/api";

import logoImage from "@assets/NotesMateMD-Logo-New-Image-NoBG_1765432461912.png";
import logoWordmark from "@assets/NotesMateMD-Logo-New-Words-NoBG_1765432453100.png";
import zsplLogo from "@assets/ZSPL-Logo-Symbol-Name-NoBG_1765432873353.png";

function LoginPage({ onLogin }: { onLogin: (loginData: LoginResponse) => void }) {
  const [orgCode, setOrgCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const loginData = await api.login({ 
        org_code: orgCode || undefined, 
        username, 
        password 
      });
      onLogin(loginData);
      console.log('Login successful');
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <img 
                src={logoImage} 
                alt="NotesMate MD Logo" 
                className="h-12 sm:h-16 w-auto object-contain"
                data-testid="img-logo"
              />
              <img 
                src={logoWordmark} 
                alt="NotesMate MD" 
                className="h-8 sm:h-12 w-auto object-contain"
                data-testid="img-wordmark"
              />
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-sm font-medium text-foreground">
                Created by
              </p>
              <img 
                src={zsplLogo} 
                alt="Zapurzaa Systems" 
                className="h-5 w-auto object-contain"
                data-testid="img-zspl-logo"
              />
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mt-2">
              Sign in to access your medical audio notes
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Organization Code</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={orgCode}
                  onChange={(e) => setOrgCode(e.target.value)}
                  placeholder="Enter 4-digit org code (e.g. 1002)"
                  className="pl-10"
                  data-testid="input-org-code"
                  maxLength={4}
                />
              </div>
              <p className="text-xs text-muted-foreground">Leave blank for super admin login</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="pl-10"
                  data-testid="input-username"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pl-10"
                  data-testid="input-password"
                  required
                />
              </div>
            </div>
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                {error}
              </div>
            )}
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          </form>
          <div className="mt-6 p-3 bg-muted/50 rounded-md text-xs text-muted-foreground space-y-1">
            <p><strong>Demo Credentials:</strong></p>
            <p>Org: 1002, User: dr.smith, Pass: simple123</p>
            <p>Super Admin: super.admin, Pass: simple123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/color-preview" component={ColorPreview} />
      <Route path="/logo-mockup" component={LogoMockup} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);

  const handleLogin = (data: LoginResponse) => {
    setLoginData(data);
  };

  const handleLogout = () => {
    setLoginData(null);
    console.log('User logged out');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="light">
          <Toaster />
          {loginData ? (
            <Dashboard loginData={loginData} onLogout={handleLogout} />
          ) : (
            <LoginPage onLogin={handleLogin} />
          )}
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
