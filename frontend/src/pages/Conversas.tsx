import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Send,
  CheckCheck,
  Check,
  Clock,
  User,
  MessageSquare,
} from "lucide-react";
import { api } from "@/lib/api";
import { useActiveWaba } from "@/hooks/use-active-waba";
import type { Conversation, Message } from "@/lib/types";

const Conversas = () => {
  const queryClient = useQueryClient();
  const { activeWaba, isLoading: wabaLoading } = useActiveWaba();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");

  const {
    data: conversationResponse,
    isLoading: conversationsLoading,
    isError: conversationsError,
  } = useQuery({
    queryKey: ["conversations", activeWaba?.id],
    queryFn: () => api.getConversations(activeWaba!.id, 1, 50),
    enabled: !!activeWaba?.id,
  });

  const conversations = useMemo<Conversation[]>(() => {
    if (!conversationResponse) return [];
    return conversationResponse.data.map((conv) => ({
      ...conv,
    }));
  }, [conversationResponse]);

  useEffect(() => {
    if (!selectedConversationId && conversations.length) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  const {
    data: messagesResponse,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ["conversation-messages", selectedConversationId],
    queryFn: () => api.getConversationMessages(selectedConversationId!, 1, 50),
    enabled: !!selectedConversationId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!activeWaba || !selectedConversationId) return;
      const conversation = conversations.find((c) => c.id === selectedConversationId);
      if (!conversation) return;
      const to = conversation.contactNumber;
      return api.sendMessage(activeWaba.id, to, newMessage);
    },
    onSuccess: () => {
      setNewMessage("");
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ["conversations", activeWaba?.id] });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "read":
        return <CheckCheck className="h-4 w-4 text-info" />;
      case "delivered":
        return <CheckCheck className="h-4 w-4 text-muted-foreground" />;
      case "sent":
        return <Check className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversationId) return;
    sendMessageMutation.mutate();
  };

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.contactNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedMessages: Message[] = messagesResponse?.data ?? [];

  if (!activeWaba && !wabaLoading) {
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground space-y-3">
          <MessageSquare className="h-10 w-10 mx-auto" />
          <p>Conecte um número oficial para visualizar as conversas.</p>
          <Button onClick={() => (window.location.href = "/conectar-whatsapp")}>
            Conectar WhatsApp
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Conversas</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie suas conversas com clientes
        </p>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Lista de Conversas */}
        <Card className="w-80 flex flex-col bg-card border-border">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversationId(conv.id)}
                className={`p-4 border-b border-border cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedConversationId === conv.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium truncate">{conv.contactNumber}</h4>
                      <span className="text-xs text-muted-foreground">
                        {conv.lastMessageAt
                          ? new Date(conv.lastMessageAt).toLocaleTimeString("pt-BR")
                          : ""}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.lastMessage || "Sem mensagens"}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <Badge className="bg-[#25D366]">{conv.unreadCount}</Badge>
                  )}
                </div>
              </div>
            ))}
            {!conversationsLoading && !filteredConversations.length && (
              <div className="p-4 text-sm text-muted-foreground">Nenhuma conversa encontrada.</div>
            )}
          </ScrollArea>
        </Card>

        {/* Thread de Mensagens */}
        <Card className="flex-1 flex flex-col bg-card border-border">
          {selectedConversationId ? (
            <>
              {/* Header da Conversa */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {conversations.find((c) => c.id === selectedConversationId)?.contactNumber}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {conversations.find((c) => c.id === selectedConversationId)?.lastMessageAt
                        ? new Date(
                            conversations.find((c) => c.id === selectedConversationId)!.lastMessageAt
                          ).toLocaleString("pt-BR")
                        : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mensagens */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {selectedMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.direction === "outbound" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          msg.direction === "outbound"
                            ? "bg-[#25D366] text-white"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <div
                          className={`flex items-center justify-end gap-1 mt-1 ${
                            msg.direction === "outbound"
                              ? "text-white/70"
                              : "text-muted-foreground"
                          }`}
                        >
                          <span className="text-xs">
                            {new Date(msg.timestamp).toLocaleTimeString("pt-BR")}
                          </span>
                          {msg.direction === "outbound" && getStatusIcon(msg.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {messagesLoading && (
                    <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
                  )}
                </div>
              </ScrollArea>

              {/* Input de Mensagem */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    className="flex-1"
                    disabled={sendMessageMutation.isPending}
                  />
                  <Button
                    onClick={handleSendMessage}
                    className="bg-[#25D366] hover:bg-[#25D366]/90"
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Mensagens de sessão podem ser enviadas dentro da janela de 24h
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecione uma conversa para visualizar</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Conversas;
