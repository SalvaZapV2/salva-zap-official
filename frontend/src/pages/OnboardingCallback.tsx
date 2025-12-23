import { useEffect, useState, useRef } from "react";
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
  const processedRef = useRef<string | null>(null); // Track processed codes

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

    // Prevent processing the same code twice
    if (processedRef.current === code) {
      console.log('Code already processed, skipping...');
      return;
    }

    // Check if this code was already processed (stored in sessionStorage)
    const processedCodes = JSON.parse(sessionStorage.getItem('processed_oauth_codes') || '[]');
    if (processedCodes.includes(code)) {
      setStatus('error');
      setMessage('This authorization code has already been used. Please try connecting again.');
      toast.error('Authorization code already used');
      setTimeout(() => {
        navigate('/onboarding');
      }, 3000);
      return;
    }

    // Mark as processing
    processedRef.current = code;

    // Use the api client instead of raw fetch to ensure correct base URL
    const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
    const url = `${apiBaseUrl}/auth/embedded/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}`;
    
    fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })
      .then(async (response) => {
        // Check if response is a redirect (3xx status) or HTML
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          const text = await response.text();
          throw new Error('Backend returned HTML instead of JSON. Check backend logs.');
        }
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ 
            message: `Request failed with status ${response.status}` 
          }));
          
          // Handle "code already used" error specifically
          if (errorData.error_description?.includes('authorization code has been used') || 
              errorData.error?.includes('authorization code has been used')) {
            // Mark code as processed to prevent retries
            const processedCodes = JSON.parse(sessionStorage.getItem('processed_oauth_codes') || '[]');
            if (!processedCodes.includes(code)) {
              processedCodes.push(code);
              sessionStorage.setItem('processed_oauth_codes', JSON.stringify(processedCodes));
            }
            throw new Error('This authorization code has already been used. Please try connecting again from the onboarding page.');
          }
          
          throw new Error(errorData.error_description || errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Mark code as successfully processed
        const processedCodes = JSON.parse(sessionStorage.getItem('processed_oauth_codes') || '[]');
        if (!processedCodes.includes(code)) {
          processedCodes.push(code);
          sessionStorage.setItem('processed_oauth_codes', JSON.stringify(processedCodes));
        }
        
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
        toast.error(error.message || 'Failed to process callback');
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

