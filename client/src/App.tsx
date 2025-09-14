import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Stethoscope, User, Lock } from "lucide-react";
import { ThemeProvider } from "@/components/ThemeProvider";
import Dashboard from "@/components/Dashboard";
import NotFound from "@/pages/not-found";

// Mock login component for prototype - todo: remove mock functionality
function LoginPage({ onLogin }: { onLogin: (user: any) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock authentication - todo: remove mock functionality
    const mockUser = {
      firstName: "Dr. Sarah",
      lastName: "Wilson",
      title: "Primary Care Physician",
      orgName: "Metro Health Medical Center"
    };
    onLogin(mockUser);
    console.log('Mock login successful');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Stethoscope className="h-8 w-8" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Welcome to NotesMate</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Sign in to access your medical audio notes
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
            <Button 
              type="submit" 
              className="w-full"
              data-testid="button-login"
            >
              Sign In
            </Button>
          </form>
          <div className="mt-6 p-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
            <strong>Demo Note:</strong> This is a prototype with mock authentication. 
            Enter any username/password to access the system.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);

  const handleLogin = (user: any) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    console.log('User logged out');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="light">
          <Toaster />
          {currentUser ? (
            <Dashboard currentUser={currentUser} onLogout={handleLogout} />
          ) : (
            <LoginPage onLogin={handleLogin} />
          )}
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
