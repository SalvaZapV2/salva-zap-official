import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { format, formatDistanceToNow } from "date-fns";
import {
  Search,
  Send,
  Paperclip,
  MoreVertical,
  Clock,
  CheckCheck,
  Tag,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const Inbox = () => {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [wabaAccountId, setWabaAccountId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  // Use React Query for shops to enable automatic refresh
  const { data: shops = [] } = useQuery({
    queryKey: ['shops'],
    queryFn: () => api.getShops(),
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    // Get first shop's WABA account
    if (shops.length > 0 && shops[0].waba && shops[0].waba.length > 0) {
      setWabaAccountId(shops[0].waba[0].id);
    }
  }, [shops]);

  const { data: conversationsData, isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', wabaAccountId],
    queryFn: () => wabaAccountId ? api.getConversations(wabaAccountId) : Promise.resolve({ data: [], pagination: {} }),
    enabled: !!wabaAccountId,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedConversation],
    queryFn: () => selectedConversation ? api.getConversationMessages(selectedConversation) : Promise.resolve({ data: [], pagination: {} }),
    enabled: !!selectedConversation,
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConversation || !wabaAccountId || !messageText.trim()) return;
      const conv = conversationsData?.data?.find((c: any) => c.id === selectedConversation);
      if (!conv) return;
      return api.sendMessage(wabaAccountId, conv.contactNumber, messageText);
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['conversations', wabaAccountId] });
      toast.success("Message sent");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send message");
    },
  });

  const conversations = conversationsData?.data || [];
  const messages = messagesData?.data || [];
  const selectedConv = conversations.find((c: any) => c.id === selectedConversation);

  const filteredConversations = conversations.filter((conv: any) =>
    conv.contactNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSend = () => {
    if (!messageText.trim() || !selectedConversation) return;
    sendMessageMutation.mutate();
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Conversations List */}
      <div className="w-96 border-r border-border flex flex-col bg-card/30">
        <div className="p-4 border-b border-border space-y-4">
          <h2 className="text-xl font-bold">Inbox</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-10 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <div className="p-4 text-center text-muted-foreground">Loading conversations...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No conversations found</div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredConversations.map((conv: any) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={`w-full p-4 rounded-lg text-left transition-all hover:bg-muted/50 ${
                    selectedConversation === conv.id
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-background/50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{conv.contactNumber}</h3>
                        {conv.unreadCount > 0 && (
                          <Badge className="bg-primary text-xs px-1.5 py-0.5">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.contactNumber}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mb-2">
                    {conv.lastMessage || "No messages"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        {selectedConv ? (
          <div className="h-16 border-b border-border px-6 flex items-center justify-between bg-card/50">
            <div>
              <h3 className="font-semibold">{selectedConv.contactNumber}</h3>
              <p className="text-xs text-muted-foreground">{selectedConv.contactNumber}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Tag className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-16 border-b border-border px-6 flex items-center justify-center bg-card/50">
            <p className="text-muted-foreground">Select a conversation</p>
          </div>
        )}

        {/* Messages */}
        {selectedConversation ? (
          <ScrollArea className="flex-1 p-6">
            {messagesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No messages yet</div>
            ) : (
              <div className="space-y-4 max-w-4xl mx-auto">
                {messages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        msg.direction === "outbound"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <span className="text-xs opacity-70">
                          {format(new Date(msg.timestamp), "HH:mm")}
                        </span>
                        {msg.direction === "outbound" && (
                          <CheckCheck className="h-3 w-3 opacity-70" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Select a conversation to start messaging</p>
          </div>
        )}

        {/* Message Input */}
        {selectedConversation && (
          <div className="border-t border-border p-4 bg-card/50">
            <div className="max-w-4xl mx-auto">
              <Card className="p-3 bg-background border-border">
                <div className="flex gap-3">
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <Textarea
                    placeholder="Type your message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="min-h-[60px] resize-none border-0 focus-visible:ring-0 bg-transparent"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={sendMessageMutation.isPending}
                  />
                  <Button
                    size="icon"
                    className="shrink-0 bg-gradient-primary hover:opacity-90"
                    onClick={handleSend}
                    disabled={sendMessageMutation.isPending || !messageText.trim()}
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2 px-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Within 24h window</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Press Enter to send, Shift+Enter for new line
                  </span>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;
