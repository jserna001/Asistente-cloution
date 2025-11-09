/**
 * Sistema de Iconos Centralizado
 * Todos los iconos de la aplicación en un solo lugar
 */

import {
  Bot,
  MessageSquare,
  Send,
  Settings,
  LogOut,
  Home,
  BarChart3,
  Calendar,
  FileText,
  Zap,
  Brain,
  Sparkles,
  Loader2,
  Copy,
  Check,
  CheckCircle,
  AlertCircle,
  Info,
  X,
  Menu,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Globe,
  Search,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Upload,
  Download,
  Trash2,
  Edit,
  Plus,
  Minus,
  MoreVertical,
  ExternalLink,
  Link,
  Clock,
  type LucideIcon
} from 'lucide-react';

// Props comunes para todos los iconos
interface IconProps {
  size?: number;
  className?: string;
  color?: string;
  strokeWidth?: number;
}

// Wrapper para iconos con props predeterminadas
const createIcon = (Icon: LucideIcon, defaultSize = 20) => {
  return ({ size = defaultSize, strokeWidth = 2, ...props }: IconProps) => (
    <Icon size={size} strokeWidth={strokeWidth} {...props} />
  );
};

// ============ Iconos de la Aplicación ============

// Chat & Messaging
export const BotIcon = createIcon(Bot);
export const MessageIcon = createIcon(MessageSquare);
export const SendIcon = createIcon(Send, 16);

// Navigation
export const SettingsIcon = createIcon(Settings);
export const LogOutIcon = createIcon(LogOut);
export const HomeIcon = createIcon(Home);

// Actions
export const CopyIcon = createIcon(Copy, 16);
export const CheckIcon = createIcon(Check, 16);
export const CheckCircleIcon = createIcon(CheckCircle);
export const TrashIcon = createIcon(Trash2);
export const EditIcon = createIcon(Edit);
export const PlusIcon = createIcon(Plus);
export const MinusIcon = createIcon(Minus);

// Status & Loading
export const LoaderIcon = createIcon(Loader2);
export const AlertIcon = createIcon(AlertCircle);
export const InfoIcon = createIcon(Info);
export const XIcon = createIcon(X);

// UI Elements
export const MenuIcon = createIcon(Menu);
export const ChevronDownIcon = createIcon(ChevronDown);
export const ChevronRightIcon = createIcon(ChevronRight);
export const ArrowRightIcon = createIcon(ArrowRight, 18);
export const ArrowLeftIcon = createIcon(ArrowLeft, 18);
export const GlobeIcon = createIcon(Globe, 16);
export const MoreIcon = createIcon(MoreVertical);

// Data & Content
export const CalendarIcon = createIcon(Calendar);
export const FileIcon = createIcon(FileText);
export const ChartIcon = createIcon(BarChart3);
export const SearchIcon = createIcon(Search);
export const ClockIcon = createIcon(Clock, 16);

// Models & AI
export const ZapIcon = createIcon(Zap, 16);
export const BrainIcon = createIcon(Brain, 16);
export const SparklesIcon = createIcon(Sparkles, 16);

// User & Auth
export const UserIcon = createIcon(User);
export const MailIcon = createIcon(Mail);
export const LockIcon = createIcon(Lock);
export const EyeIcon = createIcon(Eye);
export const EyeOffIcon = createIcon(EyeOff);

// File Operations
export const UploadIcon = createIcon(Upload);
export const DownloadIcon = createIcon(Download);
export const LinkIcon = createIcon(Link);
export const ExternalLinkIcon = createIcon(ExternalLink);

// ============ Iconos Especiales ============

// Loader con animación
export const SpinnerIcon = ({ size = 20, ...props }: IconProps) => (
  <Loader2
    size={size}
    strokeWidth={2}
    {...props}
    style={{ animation: 'spin 1s linear infinite' }}
  />
);

// Icono de modelo basado en el nombre
export const ModelIcon = ({ model, size = 16 }: { model: string; size?: number }) => {
  if (model.includes('flash')) {
    return <ZapIcon size={size} />;
  } else if (model.includes('gemini')) {
    return <BrainIcon size={size} />;
  } else if (model.includes('claude')) {
    return <BotIcon size={size} />;
  }
  return <SparklesIcon size={size} />;
};

// ============ SVG Icons Personalizados (Google, Notion) ============

export const GoogleIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export const NotionIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M25.75 10.3333H32.5V31.6667H25.75V10.3333Z" fill="#fff"/>
    <path d="M7.5 8.33331C7.5 8.33331 15.8333 8.33331 17.5 8.33331C18.3333 8.33331 22.5 8.33331 22.5 12.5C22.5 16.6667 17.5 15.8333 17.5 15.8333L22.5 25C22.5 29.1667 18.3333 29.1667 17.5 29.1667C15.8333 29.1667 7.5 29.1667 7.5 29.1667V8.33331Z" fill="#fff"/>
    <path d="M12.5 10.3333V26.6666" stroke="#000" strokeWidth="3.33333" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ============ Exportar todo ============

export const Icons = {
  // Chat
  Bot: BotIcon,
  Message: MessageIcon,
  Send: SendIcon,

  // Navigation
  Settings: SettingsIcon,
  LogOut: LogOutIcon,
  Home: HomeIcon,

  // Actions
  Copy: CopyIcon,
  Check: CheckIcon,
  CheckCircle: CheckCircleIcon,
  Trash: TrashIcon,
  Edit: EditIcon,
  Plus: PlusIcon,
  Minus: MinusIcon,

  // Status
  Loader: LoaderIcon,
  Spinner: SpinnerIcon,
  Alert: AlertIcon,
  Info: InfoIcon,
  X: XIcon,

  // UI
  Menu: MenuIcon,
  ChevronDown: ChevronDownIcon,
  ChevronRight: ChevronRightIcon,
  ArrowRight: ArrowRightIcon,
  ArrowLeft: ArrowLeftIcon,
  Globe: GlobeIcon,
  More: MoreIcon,

  // Content
  Calendar: CalendarIcon,
  File: FileIcon,
  Chart: ChartIcon,
  Search: SearchIcon,
  Clock: ClockIcon,

  // AI/Models
  Zap: ZapIcon,
  Brain: BrainIcon,
  Sparkles: SparklesIcon,
  Model: ModelIcon,

  // User
  User: UserIcon,
  Mail: MailIcon,
  Lock: LockIcon,
  Eye: EyeIcon,
  EyeOff: EyeOffIcon,

  // Files
  Upload: UploadIcon,
  Download: DownloadIcon,
  Link: LinkIcon,
  ExternalLink: ExternalLinkIcon,

  // Custom
  Google: GoogleIcon,
  Notion: NotionIcon,
};

export default Icons;
