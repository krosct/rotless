import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createInvitation } from '@/api/invitations';
import { Mail, Copy, Check, Link as LinkIcon, Send } from 'lucide-react';
import { toast } from 'sonner';

export interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: number;
  householdName: string;
  onSuccess?: () => void;
}

export function InviteModal({ isOpen, onClose, householdId, householdName, onSuccess }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Por favor, informe um e-mail válido.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await createInvitation(householdId, email);
      const fullUrl = `${window.location.origin}/invite/${res.invitation.token}`;
      setInviteUrl(fullUrl);
      toast.success('Convite gerado com sucesso!');
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar convite.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success('Link do convite copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setEmail('');
    setError(null);
    setInviteUrl(null);
    setCopied(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Convidar Membro"
      description={`Convide alguém para gerenciar a despensa "${householdName}".`}
      maxWidth="md"
    >
      {!inviteUrl ? (
        <form onSubmit={handleSendInvite} className="flex flex-col gap-4 text-left">
          <Input
            type="email"
            label="E-mail do convidado"
            placeholder="exemplo@rotless.dev"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            error={error || undefined}
            leftIcon={<Mail className="w-4 h-4" />}
            helperText="O convidado receberá acesso para visualizar e registrar lotes."
          />

          <div className="flex items-center justify-end gap-3 pt-3">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              <Send className="w-4 h-4 mr-1.5" />
              Gerar Convite
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4 text-left">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
            <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium mb-2">
              Convite criado para <strong>{email}</strong>! Compartilhe o link abaixo:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="w-full text-xs font-mono p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 select-all"
              />
              <Button type="button" size="sm" variant="outline" onClick={copyToClipboard} className="shrink-0">
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span className="ml-1 text-xs">{copied ? 'Copiado' : 'Copiar'}</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <Button type="button" variant="primary" onClick={handleClose}>
              Concluir
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
