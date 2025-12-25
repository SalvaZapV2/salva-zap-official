import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import translations from "@/i18n/pt-BR.json";
import { api } from "@/lib/api";

const OnboardingCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const t = (translations as any).onboardingCallback;
  const [message, setMessage] = useState(t?.processing || 'Processando...');
  const [signupUrl, setSignupUrl] = useState<string | null>(null);
  const processedRef = useRef<string | null>(null); // Track processed codes

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(error);
      toast.error(t?.oauthError ? t.oauthError.replace('{{error}}', error) : `Erro OAuth: ${error}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage(t?.noAuthCodeReceived || 'Nenhum código de autorização recebido');
      toast.error(t?.noAuthCodeReceived || 'Nenhum código de autorização recebido');
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
      setMessage(t?.authCodeAlreadyUsed || 'Este código de autorização já foi utilizado. Por favor, tente conectar novamente.');
      toast.error(t?.authorizationCodeUsedShortToast || 'Código de autorização já utilizado');
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
            throw new Error(t?.authCodeAlreadyUsed || 'Este código de autorização já foi utilizado. Por favor, tente conectar novamente.');
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
        
        // Handle the case where Meta indicates the user needs to complete the Embedded Signup
        if (data.needsEmbeddedSignup && data.signupUrl) {
          // Instead of auto-redirecting (which can be confusing), show an explicit CTA so the user
          // is aware they need to complete the Embedded Signup flow in Meta.
          setStatus('success');
          setMessage(t?.needsEmbeddedSignup || 'Sua conta do Facebook precisa concluir o Cadastro Incorporado do Meta para criar uma WABA. Clique no botão abaixo para abrir o fluxo no Meta.');
          setSignupUrl(data.signupUrl);
          toast(t?.openMetaToast || 'Abra o Meta para concluir a criação da WABA');
          return; // stop further processing
        }

        // Check if phone numbers are needed
        if (data.needsPhoneNumber || !data.hasPhoneNumbers) {
          setStatus('success');
          setMessage(t?.wabaConnectedNoPhone || 'Conta do WhatsApp conectada com sucesso!\n\n⚠️ IMPORTANTE: Nenhum número de telefone encontrado na sua conta WABA.\n\nPara adicionar um número:\n1. Acesse https://business.facebook.com/\n2. Vá para sua Conta Oficial do WhatsApp\n3. Adicione um número pelo painel do Meta\n4. Retorne aqui e atualize sua conexão\n\nVocê ainda pode usar a plataforma, mas os recursos de envio serão limitados até que um número seja adicionado.');
          toast.success(t?.wabaConnectedNoPhone || 'Conta do WhatsApp conectada com sucesso! (número necessário)');
        } else {
          setStatus('success');
          setMessage(t?.wabaConnectedSuccess || 'Conta do WhatsApp conectada com sucesso!');
          toast.success(t?.wabaConnectedSuccess || 'Conta do WhatsApp conectada com sucesso!');
        }
        
        setTimeout(() => {
          navigate('/onboarding');
        }, data.needsPhoneNumber ? 5000 : 2000);
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
            {t?.processingTitle || 'Processando Conexão'}
          </CardTitle>
          <CardDescription className="text-center">
            {t?.processingDescription || 'Aguarde enquanto conectamos sua Conta Oficial do WhatsApp'}
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
                <div className="text-success font-medium text-center space-y-2 max-h-96 overflow-y-auto w-full">
                  {message.split('\n').map((line, idx) => (
                    <p 
                      key={idx} 
                      className={
                        line.startsWith('⚠️') || line.toUpperCase().includes('IMPORTANTE') || 
                        line.startsWith('Para adicionar') || /^[1-4]\.\s/.test(line) || line.startsWith('Você')
                          ? 'text-left text-sm text-amber-600' 
                          : (line.toLowerCase().includes('conect') && line.toLowerCase().includes('sucesso'))
                          ? 'text-lg font-bold text-success'
                          : line.trim() === ''
                          ? 'hidden'
                          : 'text-sm'
                      }
                    >
                      {line}
                    </p>
                  ))}
                </div>
                {signupUrl ? (
                  <div className="mt-4 flex flex-col items-center">
                    <p className="text-sm text-muted-foreground mb-3">{t?.needsEmbeddedSignup || 'Sua conta do Facebook precisa concluir o Cadastro Incorporado do Meta para criar uma WABA. Clique no botão abaixo para abrir o fluxo no Meta.'}</p>
                    <Button onClick={() => { window.location.href = signupUrl; }} className="bg-[#25D366] hover:bg-[#25D366]/90">{t?.openMetaButton || 'Ir para o Meta'}</Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">{t?.redirectingToOnboarding || 'Redirecionando para o onboarding...'}</p>
                )}
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="h-12 w-12 text-destructive mb-4" />
                <div className="text-destructive font-medium text-center space-y-2">
                  {message.split('\n').map((line, idx) => (
                    <p key={idx} className={(line.toUpperCase().startsWith('SOLUTION') || line.toUpperCase().startsWith('SOLUÇÃO') || /^[1-4]\.\s/.test(line)) ? 'text-left' : ''}>
                      {line}
                    </p>
                  ))}
                </div>
                <Button
                  className="mt-4"
                  onClick={() => navigate('/onboarding')}
                >
                  {t?.goBackToOnboarding || 'Voltar para Onboarding'}
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

