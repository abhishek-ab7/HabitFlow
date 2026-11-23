import { describe, it, expect } from 'vitest';
import {
  detectIntent,
  parseExpenseNaturalLanguage,
  parseTaskNaturalLanguage,
} from '../parser';

describe('quick-capture parser', () => {
  describe('detectIntent', () => {
    it('detects expenses from spending keywords and amounts', () => {
      expect(detectIntent('spent 180 on coffee with Rahul split')).toBe('expense');
      expect(detectIntent('₹500 swiggy dinner')).toBe('expense');
      expect(detectIntent('bought groceries 1200 rs')).toBe('expense');
      expect(detectIntent('uber cab 350')).toBe('expense');
    });

    it('detects tasks from action verbs and scheduling keywords', () => {
      expect(detectIntent('call landlord tomorrow at 6pm')).toBe('task');
      expect(detectIntent('finish report by Friday urgent')).toBe('task');
      expect(detectIntent('review quarterly goals')).toBe('task');
      expect(detectIntent('send invoice to client')).toBe('task');
    });

    it('classifies future bill reminders without explicit currency as tasks and explicit amounts as expenses', () => {
      expect(detectIntent('pay electricity bill tomorrow at 6pm')).toBe('task');
      expect(detectIntent('pay electricity bill')).toBe('task');
      expect(detectIntent('call landlord at 6:00')).toBe('task');
      expect(detectIntent('remind me to pay wifi bill tomorrow')).toBe('task');
      expect(detectIntent('pay bill ₹750')).toBe('expense');
      expect(detectIntent('pay 500 for electricity bill')).toBe('expense');
      expect(detectIntent('pay electricity bill 1200')).toBe('expense');
      expect(detectIntent('shoes 3500')).toBe('expense');
    });
  });

  describe('parseExpenseNaturalLanguage', () => {
    it('extracts amount, title, category, and friend split', () => {
      const parsed = parseExpenseNaturalLanguage('spent 180 on coffee with Rahul split');
      expect(parsed.amount).toBe(180);
      expect(parsed.title.toLowerCase()).toContain('coffee');
      expect(parsed.categorySlug).toBe('food-dining');
      expect(parsed.isSplit).toBe(true);
      expect(parsed.splitWithFriend).toBe('Rahul');
      expect(parsed.splitAmount).toBe(90);
    });

    it('extracts groceries and delivery services correctly', () => {
      const parsed = parseExpenseNaturalLanguage('₹650 zepto groceries');
      expect(parsed.amount).toBe(650);
      expect(parsed.categorySlug).toBe('groceries-household');
      expect(parsed.isSplit).toBe(false);
    });

    it('extracts transport cabs correctly', () => {
      const parsed = parseExpenseNaturalLanguage('uber 420 to airport');
      expect(parsed.amount).toBe(420);
      expect(parsed.categorySlug).toBe('transport-fuel');
    });

    it('parses comma-formatted amounts cleanly without leaving stray commas in title', () => {
      const parsed1 = parseExpenseNaturalLanguage('Groceries 1,200');
      expect(parsed1.amount).toBe(1200);
      expect(parsed1.title).toBe('Groceries');
      expect(parsed1.title).not.toContain(',');

      const parsed2 = parseExpenseNaturalLanguage('Laptop repair 12,500.50 rs');
      expect(parsed2.amount).toBe(12500.5);
      expect(parsed2.title).toBe('Laptop repair');
      expect(parsed2.title).not.toContain(',');
    });

    it('prevents false-positive splits for non-person phrases like with milk or with card', () => {
      const parsedMilk = parseExpenseNaturalLanguage('Coffee with milk 150');
      expect(parsedMilk.amount).toBe(150);
      expect(parsedMilk.isSplit).toBe(false);
      expect(parsedMilk.splitWithFriend).toBeUndefined();
      expect(parsedMilk.title.toLowerCase()).toContain('coffee with milk');

      const parsedCard = parseExpenseNaturalLanguage('Dinner with card 450');
      expect(parsedCard.amount).toBe(450);
      expect(parsedCard.isSplit).toBe(false);
      expect(parsedCard.splitWithFriend).toBeUndefined();
    });

    it('correctly detects explicit friend splits and strips friend name from title', () => {
      const parsed = parseExpenseNaturalLanguage('Dinner with Rahul split 1200');
      expect(parsed.amount).toBe(1200);
      expect(parsed.isSplit).toBe(true);
      expect(parsed.splitWithFriend).toBe('Rahul');
      expect(parsed.splitAmount).toBe(600);
      expect(parsed.title).toBe('Dinner');

      const parsedFifty = parseExpenseNaturalLanguage('Dinner with Rahul 50/50 1200');
      expect(parsedFifty.amount).toBe(1200);
      expect(parsedFifty.isSplit).toBe(true);
      expect(parsedFifty.splitWithFriend).toBe('Rahul');
      expect(parsedFifty.splitAmount).toBe(600);
      expect(parsedFifty.title).toBe('Dinner');
    });
  });

  describe('parseTaskNaturalLanguage', () => {
    it('extracts title, due date, due time, and priority', () => {
      const parsed = parseTaskNaturalLanguage('pay electricity bill tomorrow at 6pm urgent');
      expect(parsed.title.toLowerCase()).toContain('electricity bill');
      expect(parsed.dueDate).toBeDefined();
      expect(parsed.dueTime).toBe('18:00');
      expect(parsed.priority).toBe('high');
    });

    it('handles simple task without time', () => {
      const parsed = parseTaskNaturalLanguage('submit quarterly tax filing');
      expect(parsed.title).toContain('Submit quarterly tax filing');
      expect(parsed.priority).toBe('medium');
    });
  });
});
