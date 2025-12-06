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

    // Call backend to handle the callback
    // Note: Backend callback endpoint is at /auth/embedded/callback
    // We need to call it from the backend since it needs to exchange the code
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/auth/embedded/callback?code=${code}&state=${state || ''}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) {
          setStatus('success');
          setMessage('WhatsApp Business Account connected successfully!');
          toast.success('WABA connected successfully');
          // Refresh shops to get updated WABA accounts
          setTimeout(() => {
            navigate('/onboarding');
          }, 2000);
        } else {
          setStatus('error');
          setMessage(data.message || data.error || 'Failed to connect account');
          toast.error(data.message || 'Failed to connect account');
        }
      })
      .catch((error) => {
        setStatus('error');
        setMessage(error.message || 'An error occurred');
        toast.error('Failed to process callback');
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

