import { useState } from 'react';
import { HouseholdMember } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { InviteModal } from './InviteModal';
import { UserPlus, Users, Crown, Shield } from 'lucide-react';

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
  const [isInviteOpen, setIsInviteOpen] = useState(false);

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
        {members.map((member) => (
          <div
            key={member.id}
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
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={member.role === 'owner' ? 'owner' : 'member'} size="sm">
                {member.role === 'owner' ? (
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
            </div>
          </div>
        ))}
      </div>

      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        householdId={householdId}
        householdName={householdName}
        onSuccess={onRefresh}
      />
    </div>
  );
}
