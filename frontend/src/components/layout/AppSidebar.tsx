import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Home,
  MessageSquare,
  FileCheck,
  Megaphone,
  PlugZap,
  Wifi,
  Building2,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import headerLogo from "@/assets/header-logo.png";
import markWhite from "@/assets/mark-white.png";

const mainItems = [
  { title: "Painel", url: "/", icon: Home },
  { title: "Conversas", url: "/conversas", icon: MessageSquare },
  { title: "Mensagens Aprovadas", url: "/mensagens-aprovadas", icon: FileCheck },
  { title: "Campanhas", url: "/campanhas", icon: Megaphone },
];

const whatsappItems = [
  { title: "Conectar WhatsApp Oficial", url: "/conectar-whatsapp", icon: PlugZap },
  { title: "Status da Conexão", url: "/status-conexao", icon: Wifi },
];

const settingsItems = [
  { title: "Perfil da Empresa", url: "/perfil-empresa", icon: Building2 },
];

const agencyItems = [
  { title: "Gerenciar Múltiplas Empresas", url: "/agencia", icon: Users },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar className="border-r border-border">
      <SidebarContent className="pt-4">
        {/* Logo */}
        <div className="px-6 mb-6">
          <div className="flex items-center gap-3">
            {open ? (
              <img 
                src={headerLogo} 
                alt="Salva Zap" 
                className="h-10 w-auto object-contain"
              />
            ) : (
              <img 
                src={markWhite} 
                alt="Salva Zap" 
                className="h-10 w-10 object-contain"
              />
            )}
          </div>
        </div>

        {/* Principal */}
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 transition-colors"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* WhatsApp Oficial */}
        <SidebarGroup>
          <SidebarGroupLabel>WhatsApp Oficial</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {whatsappItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 transition-colors"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Configurações */}
        <SidebarGroup>
          <SidebarGroupLabel>Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 transition-colors"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Módulo Agência - Visual Azul */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#0EA5E9]">Módulo Agência</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {agencyItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 transition-colors text-[#0EA5E9] hover:text-[#0EA5E9] hover:bg-[#0EA5E9]/10"
                      activeClassName="bg-[#0EA5E9]/20 text-[#0EA5E9] font-medium"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
