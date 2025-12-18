import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const OnboardingCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(error);
      toast.error(`OAuth error: ${error}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('No authorization code received');
      toast.error('No authorization code received');
      return;
    }

    // Use the api client instead of raw fetch to ensure correct base URL
    const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
    const url = `${apiBaseUrl}/auth/embedded/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}`;
    
    fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'Accept': 'application/json', // Add this - important for backend to detect API call
        'Content-Type': 'application/json',
      },
    })
      .then(async (response) => {
        // Check if response is a redirect (3xx status) or HTML
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          // Backend redirected - this shouldn't happen when called from frontend
          // But if it does, check the redirect location
          const text = await response.text();
          throw new Error('Backend returned HTML instead of JSON. Check backend logs.');
        }
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ 
            message: `Request failed with status ${response.status}` 
          }));
          throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setStatus('success');
        setMessage('WhatsApp Business Account connected successfully!');
        toast.success('WABA connected successfully');
        setTimeout(() => {
          navigate('/onboarding');
        }, 2000);
      })
      .catch((error) => {
        setStatus('error');
        setMessage(error.message || 'An error occurred');
        toast.error('Failed to process callback');
        console.error('Callback error:', error);
      });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Processing Connection
          </CardTitle>
          <CardDescription className="text-center">
            Please wait while we connect your WhatsApp Business Account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center justify-center py-8">
            {status === 'loading' && (
              <>
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">{message}</p>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 className="h-12 w-12 text-success mb-4" />
                <p className="text-success font-medium">{message}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Redirecting to onboarding...
                </p>
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="h-12 w-12 text-destructive mb-4" />
                <p className="text-destructive font-medium">{message}</p>
                <Button
                  className="mt-4"
                  onClick={() => navigate('/onboarding')}
                >
                  Go Back to Onboarding
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingCallback;

