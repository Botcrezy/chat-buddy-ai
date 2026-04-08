
-- WhatsApp Sessions
CREATE TABLE public.whatsapp_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'disconnected',
  phone_number TEXT,
  qr_code TEXT,
  connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage whatsapp_sessions" ON public.whatsapp_sessions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Contacts
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  category TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage contacts" ON public.contacts FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Conversations
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to UUID,
  is_ai_active BOOLEAN NOT NULL DEFAULT true,
  labels TEXT[] DEFAULT '{}',
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage conversations" ON public.conversations FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  content TEXT,
  direction TEXT NOT NULL DEFAULT 'in',
  sender_type TEXT NOT NULL DEFAULT 'customer',
  media_url TEXT,
  media_type TEXT,
  whatsapp_message_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage messages" ON public.messages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Bot Settings
CREATE TABLE public.bot_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_name TEXT NOT NULL DEFAULT 'مساعد الشركة',
  personality TEXT DEFAULT 'أنت مساعد ذكي ومهذب للشركة. ترد على استفسارات العملاء بشكل احترافي.',
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT true,
  welcome_message TEXT DEFAULT 'مرحباً بك! كيف يمكنني مساعدتك؟',
  working_hours_start TIME DEFAULT '09:00',
  working_hours_end TIME DEFAULT '17:00',
  off_hours_message TEXT DEFAULT 'شكراً لتواصلك. نحن خارج أوقات العمل حالياً، سنرد عليك في أقرب وقت.',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage bot_settings" ON public.bot_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Training Data
CREATE TABLE public.training_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'general',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.training_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage training_data" ON public.training_data FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Quick Replies
CREATE TABLE public.quick_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage quick_replies" ON public.quick_replies FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_contacts_phone ON public.contacts(phone);
CREATE INDEX idx_contacts_category ON public.contacts(category);
CREATE INDEX idx_conversations_contact_id ON public.conversations(contact_id);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
CREATE INDEX idx_training_data_category ON public.training_data(category);

-- Updated_at triggers
CREATE TRIGGER update_whatsapp_sessions_updated_at BEFORE UPDATE ON public.whatsapp_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bot_settings_updated_at BEFORE UPDATE ON public.bot_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_training_data_updated_at BEFORE UPDATE ON public.training_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_quick_replies_updated_at BEFORE UPDATE ON public.quick_replies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default bot settings
INSERT INTO public.bot_settings (bot_name, personality, auto_reply_enabled, welcome_message) VALUES ('مساعد الشركة', 'أنت مساعد ذكي ومهذب للشركة. ترد على استفسارات العملاء بشكل احترافي وودود.', true, 'مرحباً بك! كيف يمكنني مساعدتك اليوم؟');
