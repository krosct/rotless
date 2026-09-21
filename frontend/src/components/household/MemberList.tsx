import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HouseholdMember } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InviteModal } from './InviteModal';
import { removeMember } from '@/api/households';
import { formatDate } from '@/utils/format';
import { UserPlus, Users, Crown, Shield, Activity, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export interface MemberListProps {
  householdId: number;
  householdName: string;
  members: HouseholdMember[];
  isOwner: boolean;
  onRefresh?: () => void;
}

export function MemberList({
  householdId,
  householdName,
  members,
  isOwner,
  onRefresh,
}: MemberListProps) {
  const navigate = useNavigate();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<HouseholdMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;

    setIsRemoving(true);
    try {
      await removeMember(householdId, memberToRemove.id);
      toast.success(`${memberToRemove.name} foi removido da despensa.`);
      setMemberToRemove(null);
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover membro.';
      toast.error(msg);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#2d6a4f] dark:text-emerald-400" />
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
            Membros da Despensa
          </h3>
          <span className="text-xs text-stone-500">({members.length})</span>
        </div>

        {isOwner && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsInviteOpen(true)}
            className="border-[#2d6a4f]/40 text-[#2d6a4f] dark:text-emerald-400 hover:bg-[#2d6a4f]/10"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1" />
            Convidar
          </Button>
        )}
      </div>

      <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-2xl bg-white dark:bg-stone-900 overflow-hidden">
        {members.map((member) => {
          const isMemberOwner = member.role === 'owner';

          return (
            <div
              key={member.id}
              data-testid="member-row"
              className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-stone-50/50 dark:hover:bg-stone-800 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-xs font-bold text-stone-700 dark:text-stone-300 shrink-0">
                  {member.name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                    {member.name}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                    {member.email}
                  </p>
                  {member.joined_at && (
                    <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                      Entrou em {formatDate(member.joined_at)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isOwner && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/households/${householdId}/activities?user=${member.id}`)
                    }
                    title="Ver atividades deste membro"
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:scale-105 active:scale-95 transition-all duration-150"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>{member.operations_count ?? 0}</span>
                  </button>
                )}

                <Badge variant={isMemberOwner ? 'owner' : 'member'} size="sm">
                  {isMemberOwner ? (
                    <>
                      <Crown className="w-3 h-3 text-amber-500" />
                      Proprietário
                    </>
                  ) : (
                    <>
                      <Shield className="w-3 h-3 text-stone-400" />
                      Membro
                    </>
                  )}
                </Badge>

                {isOwner && !isMemberOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMemberToRemove(member)}
                    title="Remover membro"
                    className="h-8 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="sr-only">Remover</span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        householdId={householdId}
        householdName={householdName}
        onSuccess={onRefresh}
      />

      <ConfirmDialog
        isOpen={!!memberToRemove}
        title="Remover membro"
        description={`Tem certeza que deseja remover ${memberToRemove?.name ?? 'este membro'} da despensa "${householdName}"? Ele perderá o acesso aos lotes.`}
        confirmLabel="Remover"
        isLoading={isRemoving}
        onConfirm={handleConfirmRemove}
        onClose={() => setMemberToRemove(null)}
      />
    </div>
  );
}
