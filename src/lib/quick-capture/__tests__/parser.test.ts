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
