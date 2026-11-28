'use client';

import React from 'react';
import type { DebtBucketType, DebtInstallment, DebtRecord, FriendLedgerGroup } from '@/lib/types';
import { useFeedback } from '@/hooks/use-feedback';
import { FriendCardHeader } from './card/FriendCardHeader';
import { EverydayTabSubsection } from './card/EverydayTabSubsection';
import { LongTermLoansSubsection } from './card/LongTermLoansSubsection';

interface FriendCardProps {
  group: FriendLedgerGroup;
  isExpanded: boolean;
  onToggleExpand: () => void;
  bucketFilter: 'all' | DebtBucketType;
  onOpenNewSplit: (friendName: string) => void;
  onOpenNewLoan: (friendName: string) => void;
  onOpenSettleTab: (group: FriendLedgerGroup) => void;
  onOpenOffset: (group: FriendLedgerGroup) => void;
  onOpenShare: (group: FriendLedgerGroup) => void;
  onEditDebt: (debt: DebtRecord) => void;
  onDeleteDebt: (debtId: string, title: string) => void;
  onRecordPayment: (debt: DebtRecord) => void;
  onTopUp: (debt: DebtRecord) => void;
  onCopyReminder: (debt: DebtRecord) => void;
  expandedLoanIds: Record<string, boolean>;
  onToggleLoanExpand: (loanId: string) => void;
  getDebtInstallments: (debtId: string) => DebtInstallment[];
  onEditInstallment: (debt: DebtRecord, inst: DebtInstallment) => void;
  onDeleteInstallment: (instId: string) => void;
  onToggleBucket: (debt: DebtRecord) => void;
}

export const FriendCard = React.memo(function FriendCard(props: FriendCardProps) {
  const { group, isExpanded, onToggleExpand, bucketFilter, expandedLoanIds, getDebtInstallments } = props;
  const feedback = useFeedback();
  const showEverydaySection = bucketFilter !== 'long_term_loan' && group.everydayRecords.length > 0;
  const showLoansSection = bucketFilter !== 'everyday_split' && group.longTermLoans.length > 0;

  return (
    <div className="cv-auto-lg rounded-2xl border border-border bg-card overflow-hidden shadow-xs transition-colors">
      <FriendCardHeader group={group} isExpanded={isExpanded} onToggleExpand={onToggleExpand} onOpenShare={props.onOpenShare} />
      {isExpanded && (
        <div className="border-t border-border/60 divide-y divide-border/60 bg-muted/10">
          {showEverydaySection && (
            <EverydayTabSubsection
              group={group}
              onOpenNewSplit={props.onOpenNewSplit}
              onOpenSettleTab={props.onOpenSettleTab}
              onOpenOffset={props.onOpenOffset}
              onToggleBucket={props.onToggleBucket}
              onEditDebt={props.onEditDebt}
              onDeleteDebt={props.onDeleteDebt}
              onTapFeedback={() => feedback.tap()}
            />
          )}
          {showLoansSection && (
            <LongTermLoansSubsection
              group={group}
              expandedLoanIds={expandedLoanIds}
              getDebtInstallments={getDebtInstallments}
              onOpenNewLoan={props.onOpenNewLoan}
              onToggleLoanExpand={props.onToggleLoanExpand}
              onRecordPayment={props.onRecordPayment}
              onTopUp={props.onTopUp}
              onToggleBucket={props.onToggleBucket}
              onCopyReminder={props.onCopyReminder}
              onEditDebt={props.onEditDebt}
              onDeleteDebt={props.onDeleteDebt}
              onEditInstallment={props.onEditInstallment}
              onDeleteInstallment={props.onDeleteInstallment}
            />
          )}
        </div>
      )}
    </div>
  );
});
