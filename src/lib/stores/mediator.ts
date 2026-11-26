import { useHabitStore } from './habit-store';
import { useTaskStore } from './task-store';
import { dispatchHabitAction, type MediatorAction } from './mediator/habit-dispatch';
import { evaluateNoSpendDayRulesImpl } from './mediator/no-spend-evaluator';
import { evaluateZeroJunkRulesImpl } from './mediator/zero-junk-evaluator';
import { handleFinanceEventImpl, type FinanceMediatorEvent } from './mediator/finance-event-handler';
import { handleFitnessEventImpl, type FitnessMediatorEvent } from './mediator/fitness-event-handler';

export type { MediatorAction };

export class CrossDomainActionMediator {
  public static async toggleHabitCompletion(habitId: string, date: string) {
    await useHabitStore.getState().toggle(habitId, date);
  }

  public static async toggleTaskCompletion(taskId: string) {
    await useTaskStore.getState().toggleTaskComplete(taskId);
  }

  public static async dispatch(action: MediatorAction) {
    await dispatchHabitAction(action);
  }

  public static async evaluateNoSpendDayRules(targetDate?: string) {
    await evaluateNoSpendDayRulesImpl(
      (action) => CrossDomainActionMediator.dispatch(action),
      targetDate
    );
  }

  public static async evaluateZeroJunkRules(targetDate?: string) {
    await evaluateZeroJunkRulesImpl(
      (action) => CrossDomainActionMediator.dispatch(action),
      targetDate
    );
  }

  public static async onFinanceEvent(event: FinanceMediatorEvent) {
    await handleFinanceEventImpl(event, {
      dispatch: (action) => CrossDomainActionMediator.dispatch(action),
      evaluateNoSpend: (date) => CrossDomainActionMediator.evaluateNoSpendDayRules(date),
      evaluateZeroJunk: (date) => CrossDomainActionMediator.evaluateZeroJunkRules(date),
    });
  }

  public static async onFitnessEvent(event: FitnessMediatorEvent) {
    await handleFitnessEventImpl(event, {
      dispatch: (action) => CrossDomainActionMediator.dispatch(action),
      evaluateZeroJunk: (date) => CrossDomainActionMediator.evaluateZeroJunkRules(date),
    });
  }
}
